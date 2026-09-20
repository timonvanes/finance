import Link from "next/link";
import { getReclaims, getUnlinkedIncomingTransactions } from "@/actions/reclaims";
import { getPaymentRequests } from "@/actions/payment-requests";
import { getBunqLinks } from "@/actions/bunq";
import { isBunqConfigured } from "@/lib/bunq/client";
import { ItemCard, type OpenItem } from "../item-card";
import { TxDetails } from "../tx-details";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function PersonPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  const bunqEnabled = isBunqConfigured();
  const [reclaims, paymentRequests, incoming, bunqLinks] = await Promise.all([
    getReclaims(),
    getPaymentRequests(),
    getUnlinkedIncomingTransactions(),
    bunqEnabled ? getBunqLinks() : Promise.resolve([]),
  ]);
  const bunqFor = (kind: "reclaim" | "request", id: string) => {
    const l = bunqLinks.find((x) => (kind === "reclaim" ? x.reclaim_id : x.payment_request_id) === id);
    return l ? { url: l.share_url as string, amount: Number(l.amount), status: l.status as string } : null;
  };

  let personName = "Onbekend";
  const open: OpenItem[] = [];
  type DoneLine = {
    title: string;
    date: string | null;
    description: string | null;
    transactionAmount: number | null;
    iban: string | null;
    amount: number;
    sourceTotal: number | null;
  };
  const done: {
    id: string;
    title: string;
    amount: number;
    status: string;
    paidAt: string | null;
    settledText: string | null;
    lines: DoneLine[];
  }[] = [];

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
        bunqLink: bunqFor("reclaim", r.id),
        tx: {
          name: tx?.counterparty_name ?? null,
          date: tx?.booking_date ?? null,
          amount: tx?.amount ?? null,
          description: tx?.raw_description ?? null,
          iban: tx?.counterparty_iban ?? null,
        },
      });
    } else {
      const settled = one(r.settled_transaction);
      done.push({
        id: r.id,
        title,
        amount: r.computed_amount,
        status: r.status,
        paidAt: r.paid_at,
        settledText: settled
          ? `${settled.counterparty_name ?? "onbekend"} · ${new Date(settled.booking_date).toLocaleDateString("nl-NL")} · ${euro(settled.amount)}`
          : null,
        lines: [
          {
            title,
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
  }

  for (const pr of paymentRequests) {
    if (pr.person_id !== personId) continue;
    personName = one(pr.people)?.name ?? personName;
    const lines = (Array.isArray(pr.reclaims) ? pr.reclaims : []).map((l) => {
      const ltx = one(l.transactions);
      return {
        id: l.id,
        title: ltx?.counterparty_name ?? "Onbekend",
        date: ltx?.booking_date ?? null,
        description: ltx?.raw_description ?? null,
        transactionAmount: ltx?.amount ?? null,
        iban: ltx?.counterparty_iban ?? null,
        amount: l.computed_amount,
        sourceTotal: l.source_total_amount,
      };
    });
    const total = lines.reduce((s, l) => s + l.amount, 0);
    if (pr.status === "requested") {
      open.push({
        kind: "request",
        id: pr.id,
        title: `Gecombineerd · ${lines.length} afschrijvingen`,
        subtitle: "Bank / Tikkie",
        amount: total,
        sourceTotal: null,
        method: "bank",
        referenceCode: pr.reference_code,
        bunqLink: bunqFor("request", pr.id),
        lines,
      });
    } else {
      const settled = one(pr.settled_transaction);
      done.push({
        id: pr.id,
        title: `Gecombineerd · ${lines.length} afschrijvingen`,
        amount: total,
        status: pr.status,
        paidAt: pr.paid_at,
        settledText: settled
          ? `${settled.counterparty_name ?? "onbekend"} · ${new Date(settled.booking_date).toLocaleDateString("nl-NL")} · ${euro(settled.amount)}`
          : null,
        lines,
      });
    }
  }

  const total = open.reduce((s, i) => s + i.amount, 0);
  const openRequests = open
    .filter((i) => i.kind === "request")
    .map((i) => ({ id: i.id, referenceCode: i.referenceCode ?? "", total: i.amount }));
  const looseBankReclaims = open.filter((i) => i.kind === "reclaim" && i.method === "bank");

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
            <ItemCard
              key={`${item.kind}-${item.id}`}
              item={item}
              personName={personName}
              incoming={incoming}
              bunqEnabled={bunqEnabled}
              openRequests={openRequests}
              otherReclaims={looseBankReclaims
                .filter((r) => r.id !== item.id)
                .map((r) => ({ id: r.id, label: r.title, amount: r.amount }))}
            />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details className="rounded-2xl bg-white ring-1 ring-gray-200">
          <summary className="flex min-h-[56px] cursor-pointer items-center px-5 text-base font-medium text-gray-700">
            Afgerond ({done.length})
          </summary>
          <ul className="divide-y divide-gray-100 px-2 pb-2">
            {done.map((d) => (
              <li key={d.id}>
                <details>
                  <summary className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 px-3 text-base text-gray-700">
                    <span className="min-w-0">
                      <span className="block truncate">{d.title}</span>
                      <span className="block text-sm text-gray-400">
                        {d.status === "written_off"
                          ? "Niet inbaar"
                          : d.paidAt
                            ? `Ontvangen ${new Date(d.paidAt).toLocaleDateString("nl-NL")}`
                            : "Ontvangen"}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-gray-900">{euro(d.amount)}</span>
                  </summary>
                  <div className="space-y-2 px-3 pb-3">
                    {d.lines.map((l, i) => (
                      <div key={i} className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-medium text-gray-900">{l.title}</p>
                            {l.date && (
                              <p className="text-sm text-gray-500">
                                {new Date(l.date).toLocaleDateString("nl-NL")}
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
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
