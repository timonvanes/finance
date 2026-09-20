import { periodRange } from "@/lib/month";
import { computeRequiredMonthlyDeposit } from "@/lib/pots/balance";

export interface PotForInsights {
  created_at?: string;
  opening_balance: number;
  opening_balance_date: string;
  target_amount: number | null;
  target_date: string | null;
  monthly_amount: number | null;
  monthly_auto?: boolean;
  pot_entries: { amount: number; entry_date: string }[];
}

const counted = (pot: PotForInsights) =>
  pot.pot_entries.filter((e) => e.entry_date >= pot.opening_balance_date);

// What was put into the pot (deposits only) during one budget period.
export function depositedInPeriod(pot: PotForInsights, monthsAgo: number, startDay: number): number {
  const { start, end } = periodRange(monthsAgo, startDay);
  return counted(pot)
    .filter((e) => e.amount > 0 && e.entry_date >= start && e.entry_date < end)
    .reduce((sum, e) => sum + e.amount, 0);
}

// Average net deposit per period over the last few completed periods (a
// younger pot only averages over the periods it has existed).
export function averageMonthlyNet(pot: PotForInsights, startDay: number, lookback = 3): number {
  const entries = counted(pot);
  if (entries.length === 0) return 0;
  const first = entries.map((e) => e.entry_date).sort()[0];
  let periods = 0;
  let total = 0;
  for (let m = 1; m <= lookback; m++) {
    const { start, end } = periodRange(m, startDay);
    if (end <= first) break; // this period ended before the pot had any activity
    periods++;
    total += entries.filter((e) => e.entry_date >= start && e.entry_date < end).reduce((sum, e) => sum + e.amount, 0);
  }
  return periods > 0 ? total / periods : 0;
}

export type ScheduleStatus = "ahead" | "on_track" | "behind" | "done" | "none";

export interface Schedule {
  status: ScheduleStatus;
  // Positive = ahead of the straight-line plan, negative = behind.
  difference: number;
  expectedNow: number;
}

// Straight line from the starting balance (at the pot's start) to the target
// on the target date, compared with where the pot actually is today.
export function computeSchedule(pot: PotForInsights, balance: number, now = new Date()): Schedule {
  if (!pot.target_amount || !pot.target_date) return { status: "none", difference: 0, expectedNow: balance };
  if (balance >= pot.target_amount) return { status: "done", difference: balance - pot.target_amount, expectedNow: pot.target_amount };

  // The plan starts when the pot was created, from whatever it held then.
  // (The opening-balance date can lie far in the past — e.g. pulled back to
  // the first matching transaction — and must not make a brand-new pot look
  // months behind.)
  const createdAt = pot.created_at ? new Date(pot.created_at) : now;
  const createdDay = createdAt.toISOString().slice(0, 10);
  const startBalance =
    pot.opening_balance +
    counted(pot)
      .filter((e) => e.entry_date <= createdDay)
      .reduce((sum, e) => sum + e.amount, 0);
  const end = new Date(pot.target_date);
  const span = end.getTime() - createdAt.getTime();
  const fraction = span <= 0 ? 1 : Math.min(1, Math.max(0, (now.getTime() - createdAt.getTime()) / span));
  const expectedNow = startBalance + (pot.target_amount - startBalance) * fraction;
  const difference = balance - expectedNow;
  const tolerance = Math.max(5, pot.target_amount * 0.02);
  const status: ScheduleStatus =
    difference > tolerance ? "ahead" : difference < -tolerance ? "behind" : "on_track";
  return { status, difference, expectedNow };
}

// When the target is reached if the recent pace continues; null = never at this pace.
export function projectedFinish(balance: number, target: number | null, monthlyPace: number, now = new Date()): Date | null {
  if (!target || balance >= target || monthlyPace <= 0) return null;
  const months = Math.ceil((target - balance) / monthlyPace);
  return new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
}

// What was put in or taken out (net) during one budget period.
export function netInPeriod(pot: PotForInsights, monthsAgo: number, startDay: number): number {
  const { start, end } = periodRange(monthsAgo, startDay);
  return counted(pot)
    .filter((e) => e.entry_date >= start && e.entry_date < end)
    .reduce((sum, e) => sum + e.amount, 0);
}

// The monthly amount to save: either the fixed plan, or — when the plan is
// automatic — whatever it takes to reach the target by the target date
// (rounded up to whole euros). baseBalance should be the balance at the
// start of the period so the amount doesn't shrink as you deposit into it.
export function effectiveMonthly(pot: PotForInsights, baseBalance: number): number | null {
  if (pot.monthly_auto && pot.target_amount && pot.target_date) {
    const required = computeRequiredMonthlyDeposit(baseBalance, pot.target_amount, pot.target_date);
    return required && required > 0 ? Math.ceil(required) : null;
  }
  return pot.monthly_amount ? Number(pot.monthly_amount) : null;
}
