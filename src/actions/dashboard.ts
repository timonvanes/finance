"use server";

import { createClient } from "@/lib/supabase/server";
import { detectRecurringPayments } from "@/lib/dashboard/recurring";
import { getContributionAdjustments, netExpenseAmount, netIncomeAmount } from "@/lib/contributions/net-amount";

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  return { start, end };
}

export async function getMonthlySpendByCategory() {
  const supabase = await createClient();
  const { start, end } = currentMonthRange();

  const { data, error } = await supabase
    .from("visible_transactions")
    .select("id, amount, category_id, categories(name)")
    .lt("amount", 0)
    .eq("is_transfer", false)
    .gte("booking_date", start)
    .lt("booking_date", end);
  if (error) throw error;

  const adjustments = await getContributionAdjustments(supabase, (data ?? []).map((tx) => tx.id));

  const totals = new Map<string, number>();
  for (const tx of data ?? []) {
    const category = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories;
    const name = category?.name ?? "Ongecategoriseerd";
    totals.set(name, (totals.get(name) ?? 0) + netExpenseAmount(tx.id, tx.amount, adjustments));
  }

  return [...totals.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

export async function getDashboardSummary() {
  const supabase = await createClient();
  const { start, end } = currentMonthRange();

  const [{ count: unreviewedCount }, { count: uncategorizedCount }, { data: openReclaims }, { data: monthTx }] =
    await Promise.all([
      supabase
        .from("visible_transactions")
        .select("id", { count: "exact", head: true })
        .eq("reviewed", false)
        .lt("amount", 0),
      supabase
        .from("visible_transactions")
        .select("id", { count: "exact", head: true })
        .eq("category_source", "none")
        .eq("is_transfer", false),
      // "requested" only — written-off reclaims aren't really outstanding.
      supabase.from("reclaims").select("computed_amount").eq("status", "requested"),
      supabase
        .from("visible_transactions")
        .select("id, amount")
        .eq("is_transfer", false)
        .gte("booking_date", start)
        .lt("booking_date", end),
    ]);

  const outstandingReclaimsTotal = (openReclaims ?? []).reduce(
    (sum, r) => sum + r.computed_amount,
    0
  );

  const adjustments = await getContributionAdjustments(supabase, (monthTx ?? []).map((tx) => tx.id));
  const monthIncome = (monthTx ?? [])
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + netIncomeAmount(tx.id, tx.amount, adjustments), 0);
  const monthExpense = (monthTx ?? [])
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + netExpenseAmount(tx.id, tx.amount, adjustments), 0);

  return {
    unreviewedCount: unreviewedCount ?? 0,
    uncategorizedCount: uncategorizedCount ?? 0,
    outstandingReclaimsTotal,
    monthIncome,
    monthExpense,
  };
}

export async function getRecurringPayments() {
  const supabase = await createClient();
  return detectRecurringPayments(supabase);
}

// Balances are cached on bank_accounts, refreshed during sync — savings
// accounts aren't included here since PSD2 doesn't expose them at all
// (only payment/checking accounts can be linked).
export async function getAccountBalances() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, display_name, current_balance, balance_updated_at, currency, bank_connections(institution_name)")
    .not("current_balance", "is", null);
  if (error) throw error;

  const accounts = (data ?? []).map((a) => {
    const connection = Array.isArray(a.bank_connections) ? a.bank_connections[0] : a.bank_connections;
    return {
      id: a.id,
      institutionName: connection?.institution_name ?? "Onbekend",
      displayName: a.display_name,
      balance: a.current_balance as number,
      currency: a.currency ?? "EUR",
      updatedAt: a.balance_updated_at as string | null,
    };
  });

  return { accounts, total: accounts.reduce((sum, a) => sum + a.balance, 0) };
}

const FREE_TO_SPEND_LOOKBACK_MONTHS = 3;

// Rough "vrije ruimte per maand": average net (income minus expense) over
// the last few *completed* months (the current, still-running month is
// excluded since it isn't comparable yet).
export async function getFreeToSpendPerMonth(): Promise<number | null> {
  const supabase = await createClient();
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - FREE_TO_SPEND_LOOKBACK_MONTHS, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: transactions, error } = await supabase
    .from("visible_transactions")
    .select("id, amount, booking_date")
    .eq("is_transfer", false)
    .gte("booking_date", rangeStart.toISOString().slice(0, 10))
    .lt("booking_date", rangeEnd.toISOString().slice(0, 10));
  if (error) throw error;
  if (!transactions || transactions.length === 0) return null;

  const adjustments = await getContributionAdjustments(supabase, transactions.map((tx) => tx.id));

  const perMonth = new Map<string, number>();
  for (const tx of transactions) {
    const d = new Date(tx.booking_date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const net =
      tx.amount > 0
        ? netIncomeAmount(tx.id, tx.amount, adjustments)
        : -netExpenseAmount(tx.id, tx.amount, adjustments);
    perMonth.set(key, (perMonth.get(key) ?? 0) + net);
  }

  const months = [...perMonth.values()];
  if (months.length === 0) return null;
  return months.reduce((sum, v) => sum + v, 0) / months.length;
}
