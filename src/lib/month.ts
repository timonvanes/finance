// Budget "months" don't have to start on the 1st: with a start day of 25 the
// period runs from the 25th to the 24th of the next month (e.g. salary day).

const pad = (n: number) => String(n).padStart(2, "0");

export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const clampStartDay = (day: number) => Math.min(28, Math.max(1, Math.round(day) || 1));

// Start of the period that contains `ref`.
export function periodStartFor(ref: Date, startDay: number): Date {
  const offset = ref.getDate() >= startDay ? 0 : -1;
  return new Date(ref.getFullYear(), ref.getMonth() + offset, startDay);
}

// monthsAgo 0 = the current period, 1 = the one before, etc.
export function periodRange(monthsAgo: number, startDay: number, ref: Date = new Date()) {
  const current = periodStartFor(ref, startDay);
  const startDate = new Date(current.getFullYear(), current.getMonth() - monthsAgo, startDay);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDay);
  const lastDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1);
  return {
    start: isoDate(startDate),
    end: isoDate(endDate),
    startDate,
    endDate,
    // The period is named after the month it mostly belongs to: the one it ends in.
    labelDate: lastDay,
  };
}

const parseLocal = (dateStr: string) => new Date(`${dateStr.slice(0, 10)}T00:00:00`);

export function periodKey(dateStr: string, startDay: number): string {
  const s = periodStartFor(parseLocal(dateStr), startDay);
  return `${s.getFullYear()}-${s.getMonth()}`;
}

// How many days into its period a date falls (0 = first day).
export function dayIndexInPeriod(dateStr: string, startDay: number): number {
  const d = parseLocal(dateStr);
  const s = periodStartFor(d, startDay);
  return Math.round((d.getTime() - s.getTime()) / 86400000);
}
