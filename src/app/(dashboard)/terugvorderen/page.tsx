import Link from "next/link";
import { getQueuedTransactions, getReclaims } from "@/actions/reclaims";
import { getPaymentRequests } from "@/actions/payment-requests";
import { CombineSuggestion } from "./combine-suggestion";

const euro = (n: number) =>
  n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function TerugvorderenPage() {
  const [reclaims, paymentRequests, queued] = await Promise.all([
    getReclaims(),
    getPaymentRequests(),
    getQueuedTransactions(),
  ]);

  type PersonRef = { name: string; person_groups: { name: string } | { name: string }[] | null };
  const groupOf = (person: PersonRef | null) => one(person?.person_groups ?? null)?.name ?? "Overig";
  const perPerson = new Map<string, { name: string; group: string; total: number }>();
  const add = (personId: string, name: string, group: string, amount: number) => {
    const entry = perPerson.get(personId) ?? { name, group, total: 0 };
    entry.total += amount;
    perPerson.set(personId, entry);
  };

  // Open reclaims grouped per transaction: who owes how much of each payment.
  type TxGroup = {
    id: string;
    title: string;
    date: string | null;
    txAmount: number | null;
    sourceTotal: number | null;
    method: string;
    people: { name: string; amount: number }[];
  };
  const byTransaction = new Map<string, TxGroup>();
  const looseBankByPerson = new Map<string, { name: string; ids: string[]; total: number }>();

  for (const r of reclaims) {
    if (r.status !== "requested") continue;
    const personRef = one(r.people as PersonRef | PersonRef[] | null);
    const personName = personRef?.name ?? "Onbekend";
    add(r.person_id, personName, groupOf(personRef), r.computed_amount);

    const tx = one(r.transactions);
    const group: TxGroup = byTransaction.get(r.transaction_id) ?? {
      id: r.transaction_id,
      title: tx?.counterparty_name ?? "Onbekend",
      date: tx?.booking_date ?? null,
      txAmount: tx?.amount ?? null,
      sourceTotal: r.source_total_amount,
      method: r.settlement_method,
      people: [],
    };
    group.people.push({ name: personName, amount: r.computed_amount });
    byTransaction.set(r.transaction_id, group);

    if (r.settlement_method === "bank") {
      const entry: { name: string; ids: string[]; total: number } = looseBankByPerson.get(r.person_id) ?? {
        name: personName,
        ids: [],
        total: 0,
      };
      entry.ids.push(r.id);
      entry.total += r.computed_amount;
      looseBankByPerson.set(r.person_id, entry);
    }
  }

  const openRequests: { id: string; person: string; personId: string; total: number; count: number }[] = [];
  for (const pr of paymentRequests) {
    if (pr.status !== "requested") continue;
    const personRef = one(pr.people as PersonRef | PersonRef[] | null);
    const personName = personRef?.name ?? "Onbekend";
    const lines = Array.isArray(pr.reclaims) ? pr.reclaims : [];
    const total = lines.reduce((sum, r) => sum + r.computed_amount, 0);
    add(pr.person_id, personName, groupOf(personRef), total);
    openRequests.push({ id: pr.id, person: personName, personId: pr.person_id, total, count: lines.length });
  }

  const doneCount =
    reclaims.filter((r) => r.status !== "requested").length +
    paymentRequests.filter((pr) => pr.status !== "requested").length;

  const people = [...perPerson.entries()].sort((a, b) => b[1].total - a[1].total);
  const outstanding = people.reduce((sum, [, p]) => sum + p.total, 0);
  const groupMap = new Map<string, [string, { name: string; group: string; total: number }][]>();
  for (const entry of people) {
    if (!groupMap.has(entry[1].group)) groupMap.set(entry[1].group, []);
    groupMap.get(entry[1].group)!.push(entry);
  }
  const groups = [...groupMap.entries()].sort(([a], [b]) => (a === "Overig" ? 1 : b === "Overig" ? -1 : a.localeCompare(b)));
  const transactions = [...byTransaction.values()].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? "")
  );
  const suggestions = [...looseBankByPerson.values()].filter((p) => p.ids.length >= 2);
  const wbwCount = [...byTransaction.values()].filter((t) => t.method === "external_app").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Terugvorderen</h1>
        <Link
          href="/terugvorderen/nieuw"
          prefetch
          className="flex min-h-[48px] items-center rounded-full bg-gray-900 px-5 text-base font-medium text-white active:bg-gray-700"
        >
          + Nieuw
        </Link>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <p className="text-sm text-gray-500">Nog te ontvangen</p>
        <p className="mt-1 text-4xl font-semibold text-gray-900">{euro(outstanding)}</p>
        {people.length > 0 && (
          <div className="mt-4 space-y-3">
            {groups.map(([groupName, members]) => (
              <div key={groupName}>
                {groups.length > 1 && (
                  <p className="mb-1 flex items-baseline justify-between text-sm text-gray-500">
                    <span>{groupName}</span>
                    <span>{euro(members.reduce((sum, [, m]) => sum + m.total, 0))}</span>
                  </p>
                )}
                <ul className="flex flex-wrap gap-2">
                  {members.map(([personId, p]) => (
                    <li key={personId}>
                      <Link
                        href={`/terugvorderen/${personId}`}
                        prefetch
                        className="flex min-h-[44px] items-center rounded-full bg-gray-100 px-4 text-base text-gray-800 active:bg-gray-200"
                      >
                        {p.name} · <span className="ml-1 font-semibold">{euro(p.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {wbwCount > 0 && (
        <Link
          href="/terugvorderen/wbw"
          prefetch
          className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-teal-50 px-5 py-4 ring-1 ring-teal-100 active:bg-teal-100"
        >
          <span className="flex-1 text-lg font-medium text-teal-900">
            {wbwCount} uitgave{wbwCount > 1 ? "n" : ""} nog in WieBetaaltWat zetten
          </span>
          <span className="text-2xl text-teal-700">›</span>
        </Link>
      )}

      {queued.length > 0 && (
        <Link
          href="/terugvorderen/te-verdelen"
          prefetch
          className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-amber-50 px-5 py-4 ring-1 ring-amber-200 active:bg-amber-100"
        >
          <span className="flex-1 text-lg font-medium text-amber-900">
            {queued.length} betaling{queued.length > 1 ? "en" : ""} te verdelen
          </span>
          <span className="text-2xl text-amber-700">›</span>
        </Link>
      )}

      {suggestions.map((s) => (
        <CombineSuggestion key={s.ids.join(",")} personName={s.name} reclaimIds={s.ids} total={s.total} />
      ))}

      {openRequests.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-lg font-semibold text-gray-900">Gecombineerd</h2>
          <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {openRequests.map((r) => (
              <li key={r.id} className="border-b border-gray-100 last:border-b-0">
                <Link
                  href={`/terugvorderen/${r.personId}`}
                  className="flex min-h-[64px] items-center gap-3 px-5 py-3 active:bg-gray-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-gray-900">{r.person}</span>
                    <span className="block text-sm text-gray-500">{r.count} afschrijvingen samen</span>
                  </span>
                  <span className="text-base font-semibold text-gray-900">{euro(r.total)}</span>
                  <span className="text-2xl text-gray-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="px-1 text-lg font-semibold text-gray-900">Per transactie</h2>
        {transactions.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
            Geen losse openstaande terugvorderingen.
          </p>
        ) : (
          <ul className="space-y-3">
            {transactions.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/terugvorderen/t/${t.id}`}
                  className="block space-y-2 rounded-2xl bg-white p-5 ring-1 ring-gray-200 active:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-medium text-gray-900">{t.title}</p>
                      <p className="text-sm text-gray-500">
                        {t.date && new Date(t.date).toLocaleDateString("nl-NL")}
                        {t.method === "external_app" && " · WieBetaaltWat"}
                      </p>
                    </div>
                    {t.txAmount != null && (
                      <p className="shrink-0 text-lg font-semibold text-gray-900">
                        {euro(Math.abs(t.txAmount))}
                      </p>
                    )}
                  </div>
                  <ul className="divide-y divide-gray-100 border-t border-gray-100">
                    {t.people.map((p, i) => (
                      <li key={i} className="flex min-h-[44px] items-center justify-between text-base">
                        <span className="text-gray-700">{p.name}</span>
                        <span className="font-medium text-gray-900">{euro(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/terugvorderen/afgerond"
        prefetch
        className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-white px-5 py-3 ring-1 ring-gray-200 active:bg-gray-50"
      >
        <span className="flex-1 text-lg text-gray-900">Afgerond ({doneCount})</span>
        <span className="text-2xl text-gray-300">›</span>
      </Link>

    </div>
  );
}
