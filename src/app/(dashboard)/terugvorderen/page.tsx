import Link from "next/link";
import { getQueuedTransactions, getReclaims } from "@/actions/reclaims";
import { getPaymentRequests } from "@/actions/payment-requests";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const euro = (n: number) =>
  n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export default async function TerugvorderenPage() {
  const [reclaims, paymentRequests, queued] = await Promise.all([
    getReclaims(),
    getPaymentRequests(),
    getQueuedTransactions(),
  ]);

  const perPerson = new Map<string, { name: string; total: number; count: number }>();
  const add = (personId: string, name: string, amount: number) => {
    const entry = perPerson.get(personId) ?? { name, total: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    perPerson.set(personId, entry);
  };

  for (const r of reclaims) {
    if (r.status !== "requested") continue;
    const person = Array.isArray(r.people) ? r.people[0] : r.people;
    add(r.person_id, person?.name ?? "Onbekend", r.computed_amount);
  }
  for (const pr of paymentRequests) {
    if (pr.status !== "requested") continue;
    const person = Array.isArray(pr.people) ? pr.people[0] : pr.people;
    const total = (Array.isArray(pr.reclaims) ? pr.reclaims : []).reduce(
      (sum, r) => sum + r.computed_amount,
      0
    );
    add(pr.person_id, person?.name ?? "Onbekend", total);
  }

  const doneCount =
    reclaims.filter((r) => r.status !== "requested").length +
    paymentRequests.filter((pr) => pr.status !== "requested").length;

  const people = [...perPerson.entries()].sort((a, b) => b[1].total - a[1].total);
  const outstanding = people.reduce((sum, [, p]) => sum + p.total, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Terugvorderen</h1>
        <Link
          href="/terugvorderen/nieuw"
          className="flex min-h-[48px] items-center rounded-full bg-gray-900 px-5 text-base font-medium text-white active:bg-gray-700"
        >
          + Nieuw
        </Link>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <p className="text-sm text-gray-500">Nog te ontvangen</p>
        <p className="mt-1 text-4xl font-semibold text-gray-900">{euro(outstanding)}</p>
      </div>

      {queued.length > 0 && (
        <Link
          href="/terugvorderen/te-verdelen"
          className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-amber-50 px-5 py-4 ring-1 ring-amber-200 active:bg-amber-100"
        >
          <span className="flex-1 text-lg font-medium text-amber-900">
            {queued.length} betaling{queued.length > 1 ? "en" : ""} te verdelen
          </span>
          <span className="text-2xl text-amber-700">›</span>
        </Link>
      )}

      {people.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Niemand die je nog iets verschuldigd is.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
          {people.map(([personId, p]) => (
            <li key={personId} className="border-b border-gray-100 last:border-b-0">
              <Link
                href={`/terugvorderen/${personId}`}
                className="flex min-h-[72px] items-center gap-4 px-5 py-3 active:bg-gray-50"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-base font-medium text-blue-700">
                  {initials(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-medium text-gray-900">{p.name}</span>
                  <span className="block text-sm text-gray-500">{p.count} openstaand</span>
                </span>
                <span className="text-lg font-medium text-gray-900">{euro(p.total)}</span>
                <span className="text-2xl text-gray-300">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/terugvorderen/afgerond"
        className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-white px-5 py-3 ring-1 ring-gray-200 active:bg-gray-50"
      >
        <span className="flex-1 text-lg text-gray-900">Afgerond ({doneCount})</span>
        <span className="text-2xl text-gray-300">›</span>
      </Link>

      <Link
        href="/reclaims"
        className="block pt-2 text-center text-sm text-gray-400 underline"
      >
        Terug naar de oude versie
      </Link>
    </div>
  );
}
