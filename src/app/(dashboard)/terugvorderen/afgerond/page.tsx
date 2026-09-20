import Link from "next/link";
import { getReclaims } from "@/actions/reclaims";
import { getPaymentRequests } from "@/actions/payment-requests";
import { TxDetails } from "../tx-details";
import { DoneActions } from "../done-actions";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const fmt = (d: string) => new Date(d).toLocaleDateString("nl-NL");

type Line = {
  title: string;
  date: string | null;
  description: string | null;
  transactionAmount: number | null;
  iban: string | null;
  amount: number;
  sourceTotal: number | null;
};

export default async function AfgerondPage() {
  const [reclaims, paymentRequests] = await Promise.all([getReclaims(), getPaymentRequests()]);

  const items: {
    kind: "reclaim" | "request";
    id: string;
    person: string;
    title: string;
    amount: number;
    status: string;
    paidAt: string | null;
    sortDate: string;
    settledText: string | null;
    lines: Line[];
  }[] = [];

  for (const r of reclaims) {
    if (r.status === "requested") continue;
    const tx = one(r.transactions);
    const settled = one(r.settled_transaction);
    items.push({
      kind: "reclaim",
      id: r.id,
      person: one(r.people)?.name ?? "Onbekend",
      title: tx?.counterparty_name ?? "Onbekend",
      amount: r.computed_amount,
      status: r.status,
      paidAt: r.paid_at,
      sortDate: r.paid_at ?? r.created_at,
      settledText: settled
        ? `${settled.counterparty_name ?? "onbekend"} · ${fmt(settled.booking_date)} · ${euro(settled.amount)}`
        : null,
      lines: [
        {
          title: tx?.counterparty_name ?? "Onbekend",
          date: tx?.booking_date ?? null,
          description: tx?.raw_description ?? null,
          transactionAmount: tx?.amount ?? null,
          iban: tx?.counterparty_iban ?? null,
          amount: r.computed_amount,
          sourceTotal: r.source_total_amount,
        },
      ],
    });
  }

  for (const pr of paymentRequests) {
    if (pr.status === "requested") continue;
    const settled = one(pr.settled_transaction);
    const lines: Line[] = (Array.isArray(pr.reclaims) ? pr.reclaims : []).map((l) => {
      const ltx = one(l.transactions);
      return {
        title: ltx?.counterparty_name ?? "Onbekend",
        date: ltx?.booking_date ?? null,
        description: ltx?.raw_description ?? null,
        transactionAmount: ltx?.amount ?? null,
        iban: ltx?.counterparty_iban ?? null,
        amount: l.computed_amount,
        sourceTotal: l.source_total_amount,
      };
    });
    items.push({
      kind: "request",
      id: pr.id,
      person: one(pr.people)?.name ?? "Onbekend",
      title: `Gecombineerd · ${lines.length} afschrijvingen`,
      amount: lines.reduce((s, l) => s + l.amount, 0),
      status: pr.status,
      paidAt: pr.paid_at,
      sortDate: pr.paid_at ?? pr.created_at,
      settledText: settled
        ? `${settled.counterparty_name ?? "onbekend"} · ${fmt(settled.booking_date)} · ${euro(settled.amount)}`
        : null,
      lines,
    });
  }

  items.sort((a, b) => b.sortDate.localeCompare(a.sortDate));

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
        <h1 className="text-2xl font-semibold text-gray-900">Afgerond</h1>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Nog niks afgerond.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
          {items.map((d) => (
            <li key={`${d.status}-${d.id}`}>
              <details className="group">
                <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-2 text-base [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900">
                      {d.person} · {d.title}
                    </span>
                    <span className="block text-sm text-gray-500">
                      {d.status === "written_off"
                        ? "Niet inbaar"
                        : d.paidAt
                          ? `Ontvangen ${fmt(d.paidAt)}`
                          : "Ontvangen"}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium text-gray-900">{euro(d.amount)}</span>
                </summary>
                <div className="space-y-2 px-5 pb-4">
                  {d.lines.map((l, i) => (
                    <div key={i} className="rounded-xl bg-gray-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-medium text-gray-900">{l.title}</p>
                          {l.date && (
                            <p className="text-sm text-gray-500">
                              {fmt(l.date)}
                              {l.transactionAmount != null &&
                                ` · afschrijving ${euro(Math.abs(l.transactionAmount))}`}
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 text-base font-semibold text-gray-900">{euro(l.amount)}</p>
                      </div>
                      {l.sourceTotal != null && Math.abs(l.sourceTotal - l.amount) > 0.01 && (
                        <p className="mt-1 text-sm text-gray-500">van {euro(l.sourceTotal)} totaal</p>
                      )}
                      <TxDetails
                        tx={{
                          name: l.title,
                          date: l.date,
                          amount: l.transactionAmount,
                          description: l.description,
                          iban: l.iban,
                        }}
                      />
                    </div>
                  ))}
                  {d.settledText && (
                    <p className="text-sm text-gray-500">Gekoppelde betaling: {d.settledText}</p>
                  )}
                  <DoneActions kind={d.kind} id={d.id} status={d.status} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
