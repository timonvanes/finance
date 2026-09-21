import Link from "next/link";
import { getReclaims } from "@/actions/reclaims";
import { WbwCard, type WbwGroup } from "./wbw-card";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function WbwPage() {
  const reclaims = await getReclaims();

  const groups = new Map<string, WbwGroup>();
  for (const r of reclaims) {
    if (r.status !== "requested" || r.settlement_method !== "external_app") continue;
    const tx = one(r.transactions);
    const person = one(r.people as { name: string } | { name: string }[] | null);
    const total = r.source_total_amount ?? (tx?.amount != null ? Math.abs(tx.amount) : r.computed_amount);
    const group: WbwGroup = groups.get(r.transaction_id) ?? {
      id: r.transaction_id,
      title: tx?.counterparty_name ?? "Onbekend",
      date: tx?.booking_date ?? null,
      total,
      ownShare: 0,
      people: [],
      reclaimIds: [],
    };
    group.people.push({ name: person?.name ?? "Onbekend", amount: r.computed_amount });
    group.reclaimIds.push(r.id);
    groups.set(r.transaction_id, group);
  }

  const list = [...groups.values()]
    .map((g) => ({ ...g, ownShare: Math.max(0, g.total - g.people.reduce((s, p) => s + p.amount, 0)) }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/terugvorderen"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Nog in WieBetaaltWat</h1>
      </div>

      <a
        href="https://www.wiebetaaltwat.nl"
        target="_blank"
        rel="noreferrer"
        className="flex min-h-[52px] items-center justify-center rounded-xl border border-gray-300 bg-white text-base font-medium text-gray-900 active:bg-gray-50"
      >
        WieBetaaltWat openen
      </a>

      {list.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Alles staat al in WieBetaaltWat.
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((g) => (
            <WbwCard key={g.id} group={g} />
          ))}
        </ul>
      )}
    </div>
  );
}
