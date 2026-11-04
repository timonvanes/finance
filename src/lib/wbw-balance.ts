import { isoDate, periodStartFor } from "@/lib/month";

// WieBetaaltWat bookkeeping, as pure functions.
//
// Your WBW saldo moves for three reasons between two moments you looked at it:
//  - you fronted money for others            -> saldo goes up (the app knows: reclaims)
//  - you squared up (Tikkie / transfer)       -> saldo moves toward 0 (the app knows: settlements)
//  - others fronted money for you             -> saldo goes down (the app does NOT know)
// So what others fronted for you is whatever the first two cannot explain:
//   expected = saldo_before + fronted_by_you - settlements_received
//   others_fronted = expected - saldo_after

export interface WbwEntry {
  entry_date: string; // YYYY-MM-DD
  kind: "balance" | "settlement";
  amount: number; // balance: saldo; settlement: + received / - paid
  created_at: string;
}

export interface WbwFrontedByYou {
  booking_date: string;
  amount: number;
}

export interface WbwInterval {
  from: string;
  to: string;
  fromBalance: number;
  toBalance: number;
  frontedByYou: number;
  settled: number; // net received (+) / paid (-)
  othersFronted: number; // may be slightly negative from timing noise
}

const parse = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);
const round2 = (n: number) => Math.round(n * 100) / 100;

const dayBefore = (iso: string) => {
  const d = parse(iso);
  return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
};

// A saldo counts as the state at the end of its day, except one filled in on the
// first day of a period: that closes the period that just ended, so it counts
// as the end of the day before.
function effectiveDay(entryDate: string, startDay: number | null) {
  return startDay != null && parse(entryDate).getDate() === startDay ? dayBefore(entryDate) : entryDate;
}

// One balance per day: filling in again the same day corrects the earlier one.
function balancesOf(entries: WbwEntry[], startDay: number | null) {
  const byDay = new Map<string, WbwEntry>();
  for (const e of [...entries].filter((x) => x.kind === "balance").sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    byDay.set(e.entry_date, e);
  }
  return [...byDay.values()]
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    .map((e) => ({ ...e, eff: effectiveDay(e.entry_date, startDay) }));
}

type EffIntervalInput = ReturnType<typeof balancesOf>[number];

function intervalsWithDays(
  entries: WbwEntry[],
  fronted: WbwFrontedByYou[],
  startDay: number | null
): (WbwInterval & { a: EffIntervalInput; b: EffIntervalInput })[] {
  const balances = balancesOf(entries, startDay);
  const settlements = entries.filter((e) => e.kind === "settlement");
  const out: (WbwInterval & { a: EffIntervalInput; b: EffIntervalInput })[] = [];
  for (let i = 1; i < balances.length; i++) {
    const a = balances[i - 1];
    const b = balances[i];
    // End-of-day: things dated after A's day up to and including B's day.
    const inside = (d: string) => d > a.eff && d <= b.eff;
    const frontedByYou = fronted.filter((f) => inside(f.booking_date)).reduce((s, f) => s + f.amount, 0);
    const settled = settlements.filter((s) => inside(s.entry_date)).reduce((s, e) => s + e.amount, 0);
    const expected = a.amount + frontedByYou - settled;
    out.push({
      from: a.entry_date,
      to: b.entry_date,
      fromBalance: a.amount,
      toBalance: b.amount,
      frontedByYou: round2(frontedByYou),
      settled: round2(settled),
      othersFronted: round2(expected - b.amount),
      a,
      b,
    });
  }
  return out;
}

export function wbwIntervals(entries: WbwEntry[], fronted: WbwFrontedByYou[], startDay: number | null = null): WbwInterval[] {
  return intervalsWithDays(entries, fronted, startDay).map((iv) => ({
    from: iv.from,
    to: iv.to,
    fromBalance: iv.fromBalance,
    toBalance: iv.toBalance,
    frontedByYou: iv.frontedByYou,
    settled: iv.settled,
    othersFronted: iv.othersFronted,
  }));
}

// What others fronted for you, per budget period. Each interval's amount is
// spread over its days, so a saldo filled in on the period's first day closes
// the previous period exactly, and any other day splits the amount by days.
export function wbwFrontedByPeriod(
  entries: WbwEntry[],
  fronted: WbwFrontedByYou[],
  startDay: number
): { period_start: string; amount: number }[] {
  const perPeriod = new Map<string, number>();
  for (const iv of intervalsWithDays(entries, fronted, startDay)) {
    const start = parse(iv.a.eff);
    const end = parse(iv.b.eff);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000);
    if (days < 1) {
      // Two fill-ins that count for the same day: it all happened on that day.
      const key = isoDate(periodStartFor(end, startDay));
      perPeriod.set(key, (perPeriod.get(key) ?? 0) + iv.othersFronted);
      continue;
    }
    const share = iv.othersFronted / days;
    for (let i = 1; i <= days; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = isoDate(periodStartFor(d, startDay));
      perPeriod.set(key, (perPeriod.get(key) ?? 0) + share);
    }
  }
  // A period can only cost something, never give back. A small negative (a
  // reclaim counted a fill-in earlier or later than WBW did) is carried to the
  // next period instead of being lost.
  const result: { period_start: string; amount: number }[] = [];
  let carry = 0;
  for (const key of [...perPeriod.keys()].sort()) {
    const value = (perPeriod.get(key) ?? 0) + carry;
    if (value < 0) {
      carry = value;
      continue;
    }
    carry = 0;
    if (round2(value) > 0) result.push({ period_start: key, amount: round2(value) });
  }
  return result;
}
