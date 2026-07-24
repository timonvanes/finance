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
