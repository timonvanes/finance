"use server";

import { createClient } from "@/lib/supabase/server";
import { dayIndexInPeriod, isoDate, periodKey, periodRange } from "@/lib/month";
import { getMonthStartDay } from "@/lib/settings";
import { getContributionAdjustments, netExpenseAmount } from "@/lib/contributions/net-amount";

export async function getBudgets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("id, category_id, monthly_limit, period, categories(name)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

// Upserts when a limit is given, deletes the budget when cleared.
export type BudgetPeriod = "month" | "quarter" | "year";

export async function setBudget(categoryId: string, monthlyLimit: number | null, period: BudgetPeriod = "month") {
  const supabase = await createClient();

  if (monthlyLimit == null || monthlyLimit <= 0) {
    const { error } = await supabase.from("budgets").delete().eq("category_id", categoryId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("budgets")
    .upsert(
      { category_id: categoryId, monthly_limit: monthlyLimit, period },
      { onConflict: "user_id,category_id" }
    );
  if (error) throw error;
}

export interface BudgetStatus {
  categoryId: string;
  categoryName: string;
  monthlyLimit: number; // the limit for its period
  period: BudgetPeriod;
  periodLabel: string;
  spent: number;
  pctUsed: number; // 0-100+, can exceed 100
  pctOfMonthElapsed: number; // how far the budget's own period has progressed
  aheadOfPace: boolean; // burning budget faster than the period is passing
  overBudget: boolean;
}

const PERIOD_LABEL: Record<BudgetPeriod, string> = {
  month: "deze maand",
  quarter: "dit kwartaal",
  year: "dit jaar",
};

// Range of a budget's period that contains today. Months follow the user's
// month start day; quarters and years are calendar quarters and years.
function rangeFor(period: BudgetPeriod, startDay: number, now: Date) {
  if (period === "year") {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
  }
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return { start: new Date(now.getFullYear(), q, 1), end: new Date(now.getFullYear(), q + 3, 1) };
  }
  const r = periodRange(0, startDay, now);
  return { start: r.startDate, end: r.endDate };
}

export async function getBudgetStatus(): Promise<BudgetStatus[]> {
  const supabase = await createClient();

  const now = new Date();
  const startDay = await getMonthStartDay();

  const { data: budgets, error: budgetsError } = await supabase
    .from("budgets")
    .select("category_id, monthly_limit, period, categories(name)");
  if (budgetsError) throw budgetsError;
  if (!budgets || budgets.length === 0) return [];

  const ranges = budgets.map((b) => rangeFor((b.period as BudgetPeriod) ?? "month", startDay, now));
  const earliest = new Date(Math.min(...ranges.map((r) => r.start.getTime())));
  const latest = new Date(Math.max(...ranges.map((r) => r.end.getTime())));

  const { data: txs, error: txError } = await supabase
    .from("visible_transactions")
    .select("id, amount, category_id, booking_date")
    .lt("amount", 0)
    .eq("is_transfer", false)
    .gte("booking_date", isoDate(earliest))
    .lt("booking_date", isoDate(latest));
  if (txError) throw txError;

  // Adjustments are looked up in chunks: a year of transactions overflows one URL.
  const expenseReduction = new Map<string, number>();
  const sourceReduction = new Map<string, number>();
  const all = txs ?? [];
  for (let i = 0; i < all.length; i += 100) {
    const ids = all.slice(i, i + 100).map((tx) => tx.id);
    const set = new Set(ids);
    const adj = await getContributionAdjustments(supabase, ids);
    adj.expenseReduction.forEach((v, k) => set.has(k) && expenseReduction.set(k, v));
    adj.sourceReduction.forEach((v, k) => set.has(k) && sourceReduction.set(k, v));
  }
  const adjustments = { expenseReduction, sourceReduction };

  return budgets
    .map((b, idx) => {
      const period = ((b.period as BudgetPeriod) ?? "month") as BudgetPeriod;
      const range = ranges[idx];
      const startIso = isoDate(range.start);
      const endIso = isoDate(range.end);
      let spent = 0;
      for (const tx of all) {
        if (tx.category_id !== b.category_id) continue;
        if (tx.booking_date < startIso || tx.booking_date >= endIso) continue;
        spent += netExpenseAmount(tx.id, tx.amount, adjustments);
      }
      const category = Array.isArray(b.categories) ? b.categories[0] : b.categories;
      const pctUsed = (spent / b.monthly_limit) * 100;
      const elapsed = Math.min(
        100,
        Math.max(0, ((now.getTime() - range.start.getTime()) / (range.end.getTime() - range.start.getTime())) * 100)
      );
      return {
        categoryId: b.category_id,
        categoryName: category?.name ?? "Onbekend",
        monthlyLimit: Number(b.monthly_limit),
        period,
        periodLabel: PERIOD_LABEL[period],
        spent,
        pctUsed,
        pctOfMonthElapsed: elapsed,
        aheadOfPace: pctUsed < 100 && pctUsed > elapsed + 10,
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
  const startDay = await getMonthStartDay();
  const today = isoDate(now);
  const currentDayIndex = dayIndexInPeriod(today, startDay);
  const lookbackStart = periodRange(ANOMALY_LOOKBACK_MONTHS, startDay).start;

  const { data: transactions, error } = await supabase
    .from("visible_transactions")
    .select("id, amount, booking_date")
    .lt("amount", 0)
    .eq("is_transfer", false)
    .gte("booking_date", lookbackStart);
  if (error) throw error;

  const adjustments = await getContributionAdjustments(supabase, (transactions ?? []).map((tx) => tx.id));

  const currentMonthKey = periodKey(today, startDay);
  const perMonth = new Map<string, number>();

  for (const tx of transactions ?? []) {
    // Only count the same number of days into each period as the current
    // period has had so far, so every period is compared over the same window.
    if (dayIndexInPeriod(tx.booking_date, startDay) > currentDayIndex) continue;
    const key = periodKey(tx.booking_date, startDay);
    perMonth.set(key, (perMonth.get(key) ?? 0) + netExpenseAmount(tx.id, tx.amount, adjustments));
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
