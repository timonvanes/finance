import Link from "next/link";
import { getReclaims, getUnlinkedIncomingTransactions } from "@/actions/reclaims";
import { getPaymentRequests } from "@/actions/payment-requests";
import { ItemCard, type OpenItem } from "../item-card";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function PersonPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  const [reclaims, paymentRequests, incoming] = await Promise.all([
    getReclaims(),
    getPaymentRequests(),
    getUnlinkedIncomingTransactions(),
  ]);

  let personName = "Onbekend";
  const open: OpenItem[] = [];
  const done: { id: string; title: string; amount: number; status: string }[] = [];

  for (const r of reclaims) {
    if (r.person_id !== personId) continue;
    personName = one(r.people)?.name ?? personName;
    const tx = one(r.transactions);
    const title = tx?.counterparty_name ?? "Onbekend";
    if (r.status === "requested") {
      open.push({
        kind: "reclaim",
        id: r.id,
        title,
        subtitle: [
          tx?.booking_date ? new Date(tx.booking_date).toLocaleDateString("nl-NL") : null,
          r.settlement_method === "external_app" ? "WieBetaaltWat" : "Bank / Tikkie",
        ]
          .filter(Boolean)
          .join(" · "),
        amount: r.computed_amount,
        sourceTotal: r.source_total_amount,
        method: r.settlement_method === "external_app" ? "external_app" : "bank",
        referenceCode: r.settlement_method === "bank" ? r.reference_code : null,
      });
    } else {
      done.push({ id: r.id, title, amount: r.computed_amount, status: r.status });
    }
  }

  for (const pr of paymentRequests) {
    if (pr.person_id !== personId) continue;
    personName = one(pr.people)?.name ?? personName;
    const lines = (Array.isArray(pr.reclaims) ? pr.reclaims : []).map((l) => ({
      title: one(l.transactions)?.counterparty_name ?? "Onbekend",
      amount: l.computed_amount,
    }));
    const total = lines.reduce((s, l) => s + l.amount, 0);
    if (pr.status === "requested") {
      open.push({
        kind: "request",
        id: pr.id,
        title: `Gecombineerd (${lines.length}x)`,
        subtitle: "Bank / Tikkie",
        amount: total,
        sourceTotal: null,
        method: "bank",
        referenceCode: pr.reference_code,
        lines,
      });
    } else {
      done.push({ id: pr.id, title: `Gecombineerd (${lines.length}x)`, amount: total, status: pr.status });
    }
  }

  const total = open.reduce((s, i) => s + i.amount, 0);

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
        <h1 className="text-2xl font-semibold text-gray-900">{personName}</h1>
      </div>

      <p className="text-4xl font-semibold text-gray-900">{euro(total)}</p>

      {open.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Alles is afgerond.
        </p>
      ) : (
        <ul className="space-y-3">
          {open.map((item) => (
            <ItemCard key={`${item.kind}-${item.id}`} item={item} personName={personName} incoming={incoming} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details className="rounded-2xl bg-white ring-1 ring-gray-200">
          <summary className="flex min-h-[56px] cursor-pointer items-center px-5 text-base font-medium text-gray-700">
            Afgerond ({done.length})
          </summary>
          <ul className="divide-y divide-gray-100 px-5 pb-2">
            {done.map((d) => (
              <li key={d.id} className="flex min-h-[48px] items-center justify-between text-base text-gray-600">
                <span className="truncate">
                  {d.title}
                  {d.status === "written_off" && " · niet inbaar"}
                </span>
                <span>{euro(d.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
