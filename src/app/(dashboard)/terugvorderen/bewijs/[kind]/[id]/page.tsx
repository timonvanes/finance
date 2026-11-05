import Link from "next/link";
import { notFound } from "next/navigation";
import { getReclaims } from "@/actions/reclaims";
import { getPaymentRequests } from "@/actions/payment-requests";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

interface Line {
  transactionId: string | null;
  note: string | null;
  share: number;
  total: number | null;
}

interface TxRow {
  id: string;
  booking_date: string;
  booked_at: string | null;
  counterparty_name: string | null;
  raw_description: string | null;
}

export default async function BewijsPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  let personName = "";
  let reference: string | null = null;
  let lines: Line[] = [];

  if (kind === "reclaim") {
    const r = (await getReclaims()).find((x) => x.id === id);
    if (!r) notFound();
    const tx = one(r.transactions);
    personName = one(r.people)?.name ?? "";
    reference = r.settlement_method === "bank" ? r.reference_code : null;
    lines = [
      {
        transactionId: r.transaction_id,
        note: r.note ?? null,
        total: r.source_total_amount ?? (tx?.amount != null ? Math.abs(tx.amount) : null),
        share: r.computed_amount,
      },
    ];
  } else if (kind === "request") {
    const pr = (await getPaymentRequests()).find((x) => x.id === id);
    if (!pr) notFound();
    personName = one(pr.people)?.name ?? "";
    reference = pr.reference_code;
    lines = (Array.isArray(pr.reclaims) ? pr.reclaims : []).map((l) => {
      const tx = one(l.transactions);
      return {
        transactionId: l.transaction_id,
        note: l.note ?? null,
        total: l.source_total_amount ?? (tx?.amount != null ? Math.abs(tx.amount) : null),
        share: l.computed_amount,
      };
    });
  } else {
    notFound();
  }

  // Everything the bank gave about each payment, so the receiver can see exactly what it was.
  const supabase = await createClient();
  const ids = lines.map((l) => l.transactionId).filter((x): x is string => !!x);
  const { data: txRows } = ids.length
    ? await supabase
        .from("transactions")
        .select(
          "id, booking_date, booked_at, counterparty_name, raw_description"
        )
        .in("id", ids)
    : { data: [] };
  const txById = new Map(((txRows ?? []) as unknown as TxRow[]).map((t) => [t.id, t]));

  const items = lines
    .map((l) => ({ line: l, tx: l.transactionId ? txById.get(l.transactionId) ?? null : null }))
    .sort(
      (a, b) =>
        (a.tx?.booking_date ?? "").localeCompare(b.tx?.booking_date ?? "") ||
        (a.tx?.booked_at ?? "").localeCompare(b.tx?.booked_at ?? "")
    );
  const total = lines.reduce((s, l) => s + l.share, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 print:hidden">
        <Link
          href="/terugvorderen"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Overzicht om te sturen</h1>
      </div>

      <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200 print:ring-0">
        <div>
          <p className="text-lg font-semibold text-gray-900">Overzicht betaalverzoek{personName && ` · ${personName}`}</p>
          {reference && <p className="text-sm text-gray-500">Referentie {reference}</p>}
        </div>
        <ul className="divide-y divide-gray-200 border-y border-gray-200">
          {items.map(({ line: l, tx }, i) => (
            <li key={i} className="space-y-1 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base text-gray-900">{tx?.counterparty_name ?? "Onbekend"}</p>
                  <p className="text-sm text-gray-500">
                    {tx?.booking_date ? new Date(tx.booking_date).toLocaleDateString("nl-NL") : ""}
                    {l.total != null && Math.abs(l.total - l.share) > 0.01 && ` · totaal ${euro(l.total)}`}
                  </p>
                </div>
                <p className="shrink-0 text-base font-medium text-gray-900">{euro(l.share)}</p>
              </div>
              {tx?.raw_description && <p className="break-words text-sm text-gray-600">{tx.raw_description}</p>}
              {l.note && <p className="break-words text-sm italic text-gray-600">{l.note}</p>}
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-gray-900">Totaal</p>
          <p className="text-xl font-semibold text-gray-900">{euro(total)}</p>
        </div>
      </div>

      <PrintButton />
    </div>
  );
}
