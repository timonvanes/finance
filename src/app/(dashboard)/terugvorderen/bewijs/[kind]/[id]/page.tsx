import Link from "next/link";
import { notFound } from "next/navigation";
import { getReclaims } from "@/actions/reclaims";
import { getPaymentRequests } from "@/actions/payment-requests";
import { PrintButton } from "./print-button";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

interface Line {
  date: string | null;
  name: string;
  total: number | null;
  share: number;
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
        date: tx?.booking_date ?? null,
        name: tx?.counterparty_name ?? "Onbekend",
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
        date: tx?.booking_date ?? null,
        name: tx?.counterparty_name ?? "Onbekend",
        total: l.source_total_amount ?? (tx?.amount != null ? Math.abs(tx.amount) : null),
        share: l.computed_amount,
      };
    });
  } else {
    notFound();
  }

  lines.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
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
        <table className="w-full text-left text-base">
          <thead>
            <tr className="border-b border-gray-200 text-sm text-gray-500">
              <th className="py-2 font-medium">Datum</th>
              <th className="py-2 font-medium">Omschrijving</th>
              <th className="py-2 text-right font-medium">Bedrag</th>
              <th className="py-2 text-right font-medium">Jouw deel</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 pr-2 align-top whitespace-nowrap">
                  {l.date ? new Date(l.date).toLocaleDateString("nl-NL") : ""}
                </td>
                <td className="py-2 pr-2 align-top">{l.name}</td>
                <td className="py-2 pr-2 text-right align-top whitespace-nowrap">
                  {l.total != null ? euro(l.total) : ""}
                </td>
                <td className="py-2 text-right align-top font-medium whitespace-nowrap">{euro(l.share)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 font-semibold">
                Totaal
              </td>
              <td className="pt-3 text-right text-lg font-semibold whitespace-nowrap">{euro(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <PrintButton />
    </div>
  );
}
