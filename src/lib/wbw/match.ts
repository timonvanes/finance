import type { WbwMember } from "@/lib/wbw/client";

// Names compared without capitals, accents or punctuation, so "Teun de Vries"
// and "teun  de vries" are the same person.
export const normName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Links one of your people to a member of a WieBetaaltWat list: first on the
// full name, then on the nickname. Members who left the list never match.
export function matchMember(personName: string, members: WbwMember[]): WbwMember | null {
  const n = normName(personName);
  if (!n) return null;
  const active = members.filter((m) => !m.archived);
  return (
    active.find((m) => normName(m.fullName) === n) ?? active.find((m) => normName(m.nickname) === n) ?? null
  );
}

// The shares of one expense: what each chosen person owes, and the rest is
// yours (you paid the whole bill). Two people linked to the same member are
// added up. Returns an error text when the amounts do not fit the bill.
export function buildShares(args: {
  totalCents: number;
  others: { memberId: string; cents: number }[];
  myMemberId: string;
}): { shares: { memberId: string; cents: number }[] } | { error: string } {
  const perMember = new Map<string, number>();
  for (const o of args.others) {
    if (!Number.isInteger(o.cents) || o.cents <= 0) return { error: "Een bedrag voor een deelnemer klopt niet." };
    perMember.set(o.memberId, (perMember.get(o.memberId) ?? 0) + o.cents);
  }
  if (perMember.has(args.myMemberId)) {
    return { error: "Je kunt jezelf niet als deelnemer aanslaan. Kies iemand anders." };
  }
  const othersTotal = [...perMember.values()].reduce((a, b) => a + b, 0);
  if (args.totalCents <= 0) return { error: "Het totaalbedrag klopt niet." };
  if (othersTotal > args.totalCents) {
    return { error: "De bedragen van de anderen samen zijn hoger dan de hele uitgave." };
  }
  const shares = [...perMember].map(([memberId, cents]) => ({ memberId, cents }));
  const mine = args.totalCents - othersTotal;
  if (mine > 0) shares.push({ memberId: args.myMemberId, cents: mine });
  return { shares };
}
