"use server";

import { createClient } from "@/lib/supabase/server";
import { detectRecurringPayments } from "@/lib/dashboard/recurring";
import { getContributionAdjustments, netExpenseAmount, netIncomeAmount } from "@/lib/contributions/net-amount";
import { periodKey, periodRange } from "@/lib/month";
import { getMonthStartDay } from "@/lib/settings";

async function spendByCategoryForRange(start: string, end: string, direction: "expense" | "income" = "expense") {
  const supabase = await createClient();
  let query = supabase
    .from("visible_transactions")
    .select("id, amount, category_id, categories(name)");
  query = direction === "expense" ? query.lt("amount", 0) : query.gt("amount", 0);
  const { data, error } = await query
    .eq("is_transfer", false)
    .gte("booking_date", start)
    .lt("booking_date", end);
  if (error) throw error;

  const adjustments = await getContributionAdjustments(supabase, (data ?? []).map((tx) => tx.id));

  const totals = new Map<string, number>();
  for (const tx of data ?? []) {
    const category = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories;
    const name = category?.name ?? "Ongecategoriseerd";
    const counted =
      direction === "expense"
        ? netExpenseAmount(tx.id, tx.amount, adjustments)
        : netIncomeAmount(tx.id, tx.amount, adjustments);
    totals.set(name, (totals.get(name) ?? 0) + counted);
  }
  return totals;
}

// Same as the spend per category, for money coming in (only what is really
// yours: passed-on and netted amounts are already taken out).
export async function getMonthlyIncomeByCategory(monthsAgo: number = 0) {
  const startDay = await getMonthStartDay();
  const { start, end } = periodRange(monthsAgo, startDay);
  const { start: prevStart, end: prevEnd } = periodRange(monthsAgo + 1, startDay);

  const [totals, previousTotals] = await Promise.all([
    spendByCategoryForRange(start, end, "income"),
    spendByCategoryForRange(prevStart, prevEnd, "income"),
  ]);

  const names = new Set([...totals.keys(), ...previousTotals.keys()]);
  return [...names]
    .map((name) => ({ name, total: totals.get(name) ?? 0, previousTotal: previousTotals.get(name) ?? 0 }))
    .filter((c) => c.total > 0 || c.previousTotal > 0)
    .sort((a, b) => b.total - a.total);
}

// Includes each category's total for the previous month too, so the
// dashboard can show "€50 meer dan vorige maand" style comparisons.
export async function getMonthlySpendByCategory(monthsAgo: number = 0) {
  const startDay = await getMonthStartDay();
  const { start, end } = periodRange(monthsAgo, startDay);
  const { start: prevStart, end: prevEnd } = periodRange(monthsAgo + 1, startDay);

  const [totals, previousTotals] = await Promise.all([
    spendByCategoryForRange(start, end),
    spendByCategoryForRange(prevStart, prevEnd),
  ]);

  const names = new Set([...totals.keys(), ...previousTotals.keys()]);
  return [...names]
    .map((name) => ({
      name,
      total: totals.get(name) ?? 0,
      previousTotal: previousTotals.get(name) ?? 0,
    }))
    .filter((c) => c.total > 0 || c.previousTotal > 0)
    .sort((a, b) => b.total - a.total);
}

export async function getDashboardSummary(monthsAgo: number = 0) {
  const supabase = await createClient();
  const startDay = await getMonthStartDay();
  const { start, end } = periodRange(monthsAgo, startDay);

  const { start: prevStart, end: prevEnd } = periodRange(monthsAgo + 1, startDay);

  const [{ count: unreviewedCount }, { count: uncategorizedCount }, { data: openReclaims }, { data: monthTx }, { data: prevMonthTx }] =
    await Promise.all([
      supabase
        .from("visible_transactions")
        .select("id", { count: "exact", head: true })
        .eq("reviewed", false),
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
      // For the "t.o.v. vorige maand" comparison.
      supabase
        .from("visible_transactions")
        .select("id, amount")
        .eq("is_transfer", false)
        .gte("booking_date", prevStart)
        .lt("booking_date", prevEnd),
    ]);

  const outstandingReclaimsTotal = (openReclaims ?? []).reduce(
    (sum, r) => sum + r.computed_amount,
    0
  );

  const [adjustments, prevAdjustments] = await Promise.all([
    getContributionAdjustments(supabase, (monthTx ?? []).map((tx) => tx.id)),
    getContributionAdjustments(supabase, (prevMonthTx ?? []).map((tx) => tx.id)),
  ]);
  const monthIncome = (monthTx ?? [])
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + netIncomeAmount(tx.id, tx.amount, adjustments), 0);
  const monthExpense = (monthTx ?? [])
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + netExpenseAmount(tx.id, tx.amount, adjustments), 0);
  // What came in but is not counted as your income (passed on, netted, paid back).
  const monthIncomeNotCounted = (monthTx ?? [])
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + Math.min(tx.amount, adjustments.sourceReduction.get(tx.id) ?? 0), 0);
  const previousMonthExpense = (prevMonthTx ?? [])
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + netExpenseAmount(tx.id, tx.amount, prevAdjustments), 0);

  return {
    unreviewedCount: unreviewedCount ?? 0,
    uncategorizedCount: uncategorizedCount ?? 0,
    outstandingReclaimsTotal,
    monthIncome,
    monthIncomeNotCounted,
    monthExpense,
    previousMonthExpense,
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
  const startDay = await getMonthStartDay();
  const rangeStart = periodRange(FREE_TO_SPEND_LOOKBACK_MONTHS, startDay).start;
  const rangeEnd = periodRange(0, startDay).start;

  const { data: transactions, error } = await supabase
    .from("visible_transactions")
    .select("id, amount, booking_date")
    .eq("is_transfer", false)
    .gte("booking_date", rangeStart)
    .lt("booking_date", rangeEnd);
  if (error) throw error;
  if (!transactions || transactions.length === 0) return null;

  const adjustments = await getContributionAdjustments(supabase, transactions.map((tx) => tx.id));

  const perMonth = new Map<string, number>();
  for (const tx of transactions) {
    const key = periodKey(tx.booking_date, startDay);
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
