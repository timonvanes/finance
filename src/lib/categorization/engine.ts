import type { SupabaseClient } from "@supabase/supabase-js";

const LEGAL_SUFFIXES = /\b(b\.?v\.?|n\.?v\.?|gmbh|ltd|inc)\b/g;

export function normalizeCounterparty(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Applies learned category_rules to freshly-synced transactions that don't
// have a category yet. Only touches the given transaction ids so it never
// overrides a category the user (or an earlier rule) already assigned.
export async function applyCategoryRules(
  supabase: SupabaseClient,
  transactionIds: string[]
) {
  if (transactionIds.length === 0) return;

  const { data: rules } = await supabase
    .from("category_rules")
    .select("id, match_pattern, category_id");
  if (!rules || rules.length === 0) return;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, counterparty_name")
    .in("id", transactionIds)
    .eq("category_source", "none");
  if (!transactions) return;

  // Group by matched rule so a first-time sync (potentially hundreds of
  // rows, e.g. many Albert Heijn transactions) does a couple of batched
  // updates instead of two round-trips per transaction.
  const txIdsByRule = new Map<string, string[]>();
  for (const tx of transactions) {
    const normalized = normalizeCounterparty(tx.counterparty_name);
    if (!normalized) continue;
    const match = rules.find((rule) => normalized.includes(rule.match_pattern));
    if (!match) continue;
    if (!txIdsByRule.has(match.id)) txIdsByRule.set(match.id, []);
    txIdsByRule.get(match.id)!.push(tx.id);
  }

  const now = new Date().toISOString();
  for (const [ruleId, txIds] of txIdsByRule) {
    const rule = rules.find((r) => r.id === ruleId)!;
    await Promise.all([
      supabase
        .from("transactions")
        .update({ category_id: rule.category_id, category_source: "rule" })
        .in("id", txIds),
      supabase.from("category_rules").update({ last_applied_at: now }).eq("id", ruleId),
    ]);
  }
}
