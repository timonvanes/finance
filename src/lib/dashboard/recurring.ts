import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCounterparty } from "@/lib/categorization/engine";

const LOOKBACK_DAYS = 90;
const MIN_OCCURRENCES = 2;
const MAX_RELATIVE_SPREAD = 0.15; // amounts within ~15% of their average

export interface RecurringPayment {
  counterpartyName: string;
  averageAmount: number;
  occurrences: number;
}

// A lightweight "looks like a fixed cost" heuristic: the same counterparty
// paid multiple times in the lookback window for a similar amount each time.
// No cron/background job needed — cheap enough to compute per dashboard
// load given personal-scale transaction volumes.
export async function detectRecurringPayments(
  supabase: SupabaseClient
): Promise<RecurringPayment[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: transactions } = await supabase
    .from("visible_transactions")
    .select("counterparty_name, amount, booking_date")
    .lt("amount", 0)
    .eq("is_transfer", false)
    .gte("booking_date", since);

  if (!transactions || transactions.length === 0) return [];

  const groups = new Map<string, { displayName: string; amounts: number[] }>();
  for (const tx of transactions) {
    if (!tx.counterparty_name) continue;
    const key = normalizeCounterparty(tx.counterparty_name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { displayName: tx.counterparty_name, amounts: [] });
    groups.get(key)!.amounts.push(Math.abs(tx.amount));
  }

  const results: RecurringPayment[] = [];
  for (const { displayName, amounts } of groups.values()) {
    if (amounts.length < MIN_OCCURRENCES) continue;
    const average = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const maxDeviation = Math.max(...amounts.map((a) => Math.abs(a - average)));
    if (average > 0 && maxDeviation / average <= MAX_RELATIVE_SPREAD) {
      results.push({ counterpartyName: displayName, averageAmount: average, occurrences: amounts.length });
    }
  }

  return results.sort((a, b) => b.averageAmount - a.averageAmount);
}
