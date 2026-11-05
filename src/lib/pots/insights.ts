import { isoDate, periodRange, periodStartFor } from "@/lib/month";
import { computeRequiredMonthlyDeposit } from "@/lib/pots/balance";

export interface PotForInsights {
  created_at?: string;
  opening_balance: number;
  opening_balance_date: string;
  target_amount: number | null;
  target_date: string | null;
  monthly_amount: number | null;
  monthly_auto?: boolean;
  plan_start_date?: string | null;
  // Day of the month the monthly deposit is due; null = start of the user's month.
  schedule_day?: number | null;
  pot_period_decisions?: { period_start: string; decision: string }[];
  pot_entries: PotEntryForInsights[];
}

export interface PotEntryForInsights {
  amount: number;
  entry_date: string;
  // Withdrawals: "yes" = spent on the goal (the goal was lowered by it, whole or
  // `goal_spend_amount`), "no" = not for the goal, null = not answered yet.
  goal_spend?: string | null;
  goal_spend_amount?: number | null;
}

const counted = (pot: PotForInsights) =>
  pot.pot_entries.filter((e) => e.entry_date >= pot.opening_balance_date);

// What was spent on the goal itself; that lowered the target, so the plan is
// measured against the original target and the money counts as still "saved".
const goalSpentOf = (entries: PotEntryForInsights[]) =>
  entries
    .filter((e) => e.goal_spend === "yes")
    .reduce((sum, e) => sum + Number(e.goal_spend_amount ?? Math.abs(e.amount)), 0);

// What was put into the pot (deposits only) during one budget period.
export function depositedInPeriod(pot: PotForInsights, monthsAgo: number, startDay: number): number {
  const { start, end } = periodRange(monthsAgo, startDay);
  return counted(pot)
    .filter((e) => e.amount > 0 && e.entry_date >= start && e.entry_date < end)
    .reduce((sum, e) => sum + e.amount, 0);
}

// Average net deposit per period over the last few completed periods (a
// younger pot only averages over the periods it has existed). The running
// period counts too as soon as something happened in it (a deposit or a
// withdrawal): without it a young pot is judged on a single old period and the
// pace looks far too low, while an empty period that has only just begun would
// pull it down for no reason, so that one is left out.
export function averageMonthlyNet(pot: PotForInsights, startDay: number, lookback = 3): number {
  const entries = counted(pot);
  if (entries.length === 0) return 0;
  const first = entries.map((e) => e.entry_date).sort()[0];
  let periods = 0;
  let total = 0;
  const running = periodRange(0, startDay);
  const runningNet = entries
    .filter((e) => e.entry_date >= running.start && e.entry_date < running.end)
    .reduce((sum, e) => sum + e.amount, 0);
  if (runningNet !== 0) {
    periods++;
    total += runningNet;
  }
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

// Saving happens once per period, so with a deposit day the plan is a staircase:
// one equal installment on that day each month between the pot's creation and
// the target date. The deposit day is the pot's own (schedule_day) or else the
// start of the user's month. Around each deposit day there is some slack: from
// `graceDays` before to `graceDays` after, depositing or not both count as on
// schedule, so a transfer a few days early or late does not change the status.
// Without a day (or no deposit day fits) it is a straight line.
const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_GRACE_DAYS = 3;

function installmentDates(createdAt: Date, end: Date, day: number): Date[] {
  const dates: Date[] = [];
  let s = periodStartFor(createdAt, day);
  for (let i = 0; i < 240; i++) {
    s = new Date(s.getFullYear(), s.getMonth() + 1, day);
    if (s > end) break;
    dates.push(s);
  }
  return dates;
}

// Compares where the pot is today with where the plan says it should be.
export function computeSchedule(
  pot: PotForInsights,
  balance: number,
  now = new Date(),
  startDay?: number,
  graceDays = DEFAULT_GRACE_DAYS
): Schedule {
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

  // Money spent on the goal lowered the target; undo that on both sides so it
  // does not look like falling behind.
  const goalSpent = goalSpentOf(counted(pot));
  const target = pot.target_amount + goalSpent;
  const adjBalance = balance + goalSpent;

  const depositDay = pot.schedule_day ?? startDay;
  const installments = depositDay != null ? installmentDates(createdAt, end, depositDay) : [];
  let expectedNow: number;
  if (installments.length > 0) {
    const perInstallment = (target - startBalance) / installments.length;
    const graceMs = Math.max(0, graceDays) * DAY_MS;
    let due = 0; // certainly due: the slack after the deposit day has passed
    let inSlack = 0; // within the slack around the deposit day: either way is fine
    for (const d of installments) {
      const t = d.getTime();
      if (now.getTime() >= t + graceMs + DAY_MS) due++;
      else if (now.getTime() >= t - graceMs) inSlack++;
    }
    const low = startBalance + perInstallment * due;
    const high = startBalance + perInstallment * (due + inSlack);
    expectedNow = Math.min(target, Math.min(high, Math.max(low, adjBalance)));
  } else {
    const span = end.getTime() - createdAt.getTime();
    const fraction = span <= 0 ? 1 : Math.min(1, Math.max(0, (now.getTime() - createdAt.getTime()) / span));
    expectedNow = startBalance + (target - startBalance) * fraction;
  }
  const difference = adjBalance - expectedNow;
  const tolerance = Math.max(5, pot.target_amount * 0.02);
  const status: ScheduleStatus =
    difference > tolerance ? "ahead" : difference < -tolerance ? "behind" : "on_track";
  return { status, difference, expectedNow: expectedNow - goalSpent };
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

// What to put in during the period that starts at `periodStart`, so the pot is
// on its schedule again afterwards: the period's installment plus whatever is
// still missing from before, such as money taken out that was not for the goal
// (it is added in full to the next deposit, not spread over the remaining
// months). `regular` is the installment alone. Undefined when there is no
// schedule to measure against yet.
function scheduleNeed(
  pot: PotForInsights,
  baseBalance: number,
  periodStart: Date,
  startDay: number
): { needed: number; regular: number } | undefined {
  if (!pot.target_amount || !pot.target_date) return undefined;
  const createdAt = pot.created_at ? new Date(pot.created_at) : periodStart;
  const createdDay = createdAt.toISOString().slice(0, 10);
  const entries = counted(pot);
  const startBalance =
    pot.opening_balance + entries.filter((e) => e.entry_date <= createdDay).reduce((sum, e) => sum + e.amount, 0);

  const installments = installmentDates(createdAt, new Date(pot.target_date), pot.schedule_day ?? startDay);
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, startDay);
  const dueByPeriodEnd = installments.filter((d) => d < periodEnd).length;
  if (installments.length === 0 || dueByPeriodEnd === 0) return undefined;

  const target = pot.target_amount + goalSpentOf(entries);
  const perInstallment = (target - startBalance) / installments.length;
  const expectedAfter = Math.min(target, startBalance + perInstallment * dueByPeriodEnd);
  const base = baseBalance + goalSpentOf(entries.filter((e) => e.entry_date < isoDate(periodStart)));
  return { needed: expectedAfter - base, regular: perInstallment };
}

function amountToGetOnSchedule(
  pot: PotForInsights,
  baseBalance: number,
  periodStart: Date,
  startDay: number
): number | undefined {
  return scheduleNeed(pot, baseBalance, periodStart, startDay)?.needed;
}

// What the automatic plan asks for this period, split into the regular monthly
// amount and what is put back on top of it (null without a schedule). Whole
// euros, rounded up, like the plan itself.
export function autoPlanBreakdown(
  pot: PotForInsights,
  baseBalance: number,
  periodStart: Date,
  startDay: number
): { total: number; regular: number } | null {
  const n = scheduleNeed(pot, baseBalance, periodStart, startDay);
  if (!n || n.needed <= 0.005) return null;
  const total = Math.ceil(n.needed - 0.005);
  const regular = Math.min(total, Math.ceil(n.regular - 0.005));
  return { total, regular };
}

// How much the pot really grows per month: what it gained since it started,
// divided by the deposit days that have passed (the same days the schedule
// uses), so money taken out and put back counts for nothing and the first euro
// of a pot does not add a month of its own. Falls back to the average of the
// periods while no deposit day has passed yet.
export function monthlyPace(
  pot: PotForInsights,
  balance: number,
  startDay: number,
  graceDays = DEFAULT_GRACE_DAYS,
  now = new Date()
): number {
  if (pot.created_at) {
    const createdAt = new Date(pot.created_at);
    const createdDay = createdAt.toISOString().slice(0, 10);
    // A deposit day counts once its slack has passed, so the pace does not dip on
    // the day itself while the transfer is still on its way.
    const passed = installmentDates(createdAt, now, pot.schedule_day ?? startDay).filter(
      (d) => d.getTime() + (Math.max(0, graceDays) + 1) * DAY_MS <= now.getTime()
    ).length;
    if (passed >= 1) {
      const startBalance =
        pot.opening_balance +
        counted(pot)
          .filter((e) => e.entry_date <= createdDay)
          .reduce((sum, e) => sum + e.amount, 0);
      return (balance - startBalance) / passed;
    }
  }
  return averageMonthlyNet(pot, startDay);
}

// The monthly amount to save: either the fixed plan, or — when the plan is
// automatic — whatever it takes to reach the target by the target date
// (rounded up to whole euros). baseBalance should be the balance at the
// start of the period so the amount doesn't shrink as you deposit into it.
export function effectiveMonthly(
  pot: PotForInsights,
  baseBalance: number,
  ref: Date = new Date(),
  startDay?: number
): number | null {
  if (pot.monthly_auto && pot.target_amount && pot.target_date) {
    if (startDay != null) {
      const needed = amountToGetOnSchedule(pot, baseBalance, ref, startDay);
      if (needed !== undefined) return needed > 0.005 ? Math.ceil(needed - 0.005) : null;
    }
    const required = computeRequiredMonthlyDeposit(baseBalance, pot.target_amount, pot.target_date, ref);
    return required && required > 0 ? Math.ceil(required) : null;
  }
  return pot.monthly_amount ? Number(pot.monthly_amount) : null;
}

export interface PendingPeriod {
  periodStart: string;
  // A date inside the period, for naming its month.
  labelDate: string;
  missing: number;
}

// Running score of a fixed monthly plan: what should have gone in over the
// completed periods since the plan started (periods the user chose to skip
// excluded) against everything deposited since. What is short is carried to
// the next period. Undecided short periods are listed so the user can choose
// "meenemen" or "overslaan"; until then they count as carried over.
export function planCatchUp(pot: PotForInsights, startDay: number, now = new Date()) {
  const monthly = pot.monthly_amount && !pot.monthly_auto ? Number(pot.monthly_amount) : 0;
  if (!monthly || !pot.plan_start_date) return { shortfall: 0, pending: [] as PendingPeriod[] };

  const first = periodStartFor(new Date(`${pot.plan_start_date}T00:00:00`), startDay);
  const current = periodStartFor(now, startDay);
  const decisions = new Map((pot.pot_period_decisions ?? []).map((d) => [d.period_start, d.decision]));
  const entries = counted(pot).filter((e) => e.amount > 0);

  let expected = 0;
  const pending: PendingPeriod[] = [];
  for (
    let s = new Date(first);
    s < current;
    s = new Date(s.getFullYear(), s.getMonth() + 1, startDay)
  ) {
    const next = new Date(s.getFullYear(), s.getMonth() + 1, startDay);
    const key = isoDate(s);
    const end = isoDate(next);
    const decision = decisions.get(key);
    if (decision === "skip") continue;
    expected += monthly;
    const deposited = entries.filter((e) => e.entry_date >= key && e.entry_date < end).reduce((sum, e) => sum + e.amount, 0);
    if (!decision && deposited < monthly - 0.005) {
      pending.push({
        periodStart: key,
        labelDate: isoDate(new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1)),
        missing: monthly - deposited,
      });
    }
  }

  const deposited = entries.filter((e) => e.entry_date >= isoDate(first)).reduce((sum, e) => sum + e.amount, 0);
  // Money taken out in an earlier period that was not for the goal has to go
  // back in as well, on top of the plan.
  const takenOut = counted(pot)
    .filter((e) => e.amount < 0 && e.goal_spend === "no" && e.entry_date >= isoDate(first) && e.entry_date < isoDate(current))
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const shortfall = Math.max(0, expected + takenOut - deposited);
  return { shortfall, pending: shortfall > 0.5 ? pending : [] };
}

// The planned amount for the current budget period. It is worked out from the
// balance at the START of the period and the period's start date, so
// depositing during the month never changes what was expected for that month.
export function periodMonthly(pot: PotForInsights, balance: number, startDay: number): number | null {
  const range = periodRange(0, startDay);
  return effectiveMonthly(pot, balance - netInPeriod(pot, 0, startDay), range.startDate, startDay);
}
