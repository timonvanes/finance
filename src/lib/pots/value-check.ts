// When the value of a pot (shares, say) has to be updated by hand again.
export function valueCheckStatus(everyMonths: number | null | undefined, lastIso: string | null | undefined, today: string) {
  if (!everyMonths) return { next: null as string | null, due: false };
  if (!lastIso) return { next: null as string | null, due: true };
  const d = new Date(lastIso);
  d.setMonth(d.getMonth() + everyMonths);
  const next = d.toISOString().slice(0, 10);
  return { next, due: next <= today };
}
