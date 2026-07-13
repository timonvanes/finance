"use server";

import { createClient } from "@/lib/supabase/server";

export async function getBudgets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("id, category_id, monthly_limit, categories(name)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

// Upserts when a limit is given, deletes the budget when cleared.
export async function setBudget(categoryId: string, monthlyLimit: number | null) {
  const supabase = await createClient();

  if (monthlyLimit == null || monthlyLimit <= 0) {
    const { error } = await supabase.from("budgets").delete().eq("category_id", categoryId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("budgets")
    .upsert(
      { category_id: categoryId, monthly_limit: monthlyLimit },
      { onConflict: "user_id,category_id" }
    );
  if (error) throw error;
}

export interface BudgetStatus {
  categoryId: string;
  categoryName: string;
  monthlyLimit: number;
  spent: number;
  pctUsed: number; // 0-100+, can exceed 100
  pctOfMonthElapsed: number;
  aheadOfPace: boolean; // burning budget faster than the month is passing
  overBudget: boolean;
}

export async function getBudgetStatus(): Promise<BudgetStatus[]> {
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toISOString()
    .slice(0, 10);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const pctOfMonthElapsed = (now.getDate() / daysInMonth) * 100;

  const [{ data: budgets, error: budgetsError }, { data: monthTx, error: txError }] =
    await Promise.all([
      supabase.from("budgets").select("category_id, monthly_limit, categories(name)"),
      supabase
        .from("visible_transactions")
        .select("amount, category_id")
        .lt("amount", 0)
        .eq("is_transfer", false)
        .gte("booking_date", monthStart)
        .lt("booking_date", nextMonthStart),
    ]);
  if (budgetsError) throw budgetsError;
  if (txError) throw txError;

  const spentPerCategory = new Map<string, number>();
  for (const tx of monthTx ?? []) {
    if (!tx.category_id) continue;
    spentPerCategory.set(
      tx.category_id,
      (spentPerCategory.get(tx.category_id) ?? 0) + Math.abs(tx.amount)
    );
  }

  return (budgets ?? [])
    .map((b) => {
      const category = Array.isArray(b.categories) ? b.categories[0] : b.categories;
      const spent = spentPerCategory.get(b.category_id) ?? 0;
      const pctUsed = (spent / b.monthly_limit) * 100;
      return {
        categoryId: b.category_id,
        categoryName: category?.name ?? "Onbekend",
        monthlyLimit: b.monthly_limit,
        spent,
        pctUsed,
        pctOfMonthElapsed,
        // "12e van de maand maar al over 50% heen" — flag when budget burn
        // runs meaningfully ahead of how far the month has progressed.
        aheadOfPace: pctUsed < 100 && pctUsed > pctOfMonthElapsed + 10,
        overBudget: pctUsed >= 100,
      };
    })
    .sort((a, b) => b.pctUsed - a.pctUsed);
}

const ANOMALY_LOOKBACK_MONTHS = 4;
const ANOMALY_THRESHOLD = 1.25; // 25% above your usual pace
const ANOMALY_MIN_SPEND = 100; // ignore tiny amounts

export interface SpendingAnomaly {
  monthToDateSpend: number;
  usualMonthToDateSpend: number;
  pctAbove: number;
}

// Compares this month's spend-so-far against the average spend over the
// same day range (1st through today's day-of-month) in previous months.
export async function getSpendingAnomaly(): Promise<SpendingAnomaly | null> {
  const supabase = await createClient();

  const now = new Date();
  const dayOfMonth = now.getDate();
  const lookbackStart = new Date(now.getFullYear(), now.getMonth() - ANOMALY_LOOKBACK_MONTHS, 1)
    .toISOString()
    .slice(0, 10);

  const { data: transactions, error } = await supabase
    .from("visible_transactions")
    .select("amount, booking_date")
    .lt("amount", 0)
    .eq("is_transfer", false)
    .gte("booking_date", lookbackStart);
  if (error) throw error;

  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const perMonth = new Map<string, number>();

  for (const tx of transactions ?? []) {
    const d = new Date(tx.booking_date);
    // Only count days 1..dayOfMonth so every month is compared over the
    // same window as the current month-to-date.
    if (d.getDate() > dayOfMonth) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    perMonth.set(key, (perMonth.get(key) ?? 0) + Math.abs(tx.amount));
  }

  const monthToDateSpend = perMonth.get(currentMonthKey) ?? 0;
  perMonth.delete(currentMonthKey);

  const previousMonths = [...perMonth.values()];
  if (previousMonths.length < 2) return null; // not enough history to compare

  const usualMonthToDateSpend =
    previousMonths.reduce((sum, v) => sum + v, 0) / previousMonths.length;

  if (
    usualMonthToDateSpend > 0 &&
    monthToDateSpend >= ANOMALY_MIN_SPEND &&
    monthToDateSpend > usualMonthToDateSpend * ANOMALY_THRESHOLD
  ) {
    return {
      monthToDateSpend,
      usualMonthToDateSpend,
      pctAbove: ((monthToDateSpend - usualMonthToDateSpend) / usualMonthToDateSpend) * 100,
    };
  }
  return null;
}
