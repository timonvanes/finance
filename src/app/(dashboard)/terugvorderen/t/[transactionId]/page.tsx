import Link from "next/link";
import { getReclaims, getUnlinkedIncomingTransactions } from "@/actions/reclaims";
import { getPaymentRequests } from "@/actions/payment-requests";
import { getBunqLinks } from "@/actions/bunq";
import { isBunqConfigured } from "@/lib/bunq/client";
import { ItemCard, type OpenItem } from "../../item-card";
import { TxDetails } from "../../tx-details";
import { DoneActions } from "../../done-actions";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function TransactionReclaimsPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  const bunqEnabled = isBunqConfigured();
  const [reclaims, paymentRequests, incoming, bunqLinks] = await Promise.all([
    getReclaims(),
    getPaymentRequests(),
    getUnlinkedIncomingTransactions(),
    bunqEnabled ? getBunqLinks() : Promise.resolve([]),
  ]);

  const mine = reclaims.filter((r) => r.transaction_id === transactionId);
  const first = mine[0];
  const tx = first ? one(first.transactions) : null;

  const open: { item: OpenItem; personId: string }[] = [];
  const done: {
    id: string;
    person: string;
    amount: number;
    status: string;
    paidAt: string | null;
    method: string;
    referenceCode: string | null;
    sourceTotal: number | null;
    note: string | null;
    settledText: string | null;
  }[] = [];

  for (const r of mine) {
    const personName = one(r.people)?.name ?? "Onbekend";
    if (r.status === "requested") {
      open.push({
        personId: r.person_id,
        item: {
          kind: "reclaim",
          id: r.id,
          title: personName,
          subtitle: r.settlement_method === "external_app" ? "WieBetaaltWat" : "Bank / Tikkie",
          amount: r.computed_amount,
          sourceTotal: r.source_total_amount,
          method: r.settlement_method === "external_app" ? "external_app" : "bank",
          referenceCode: r.settlement_method === "bank" ? r.reference_code : null,
          description: tx?.counterparty_name ?? undefined,
          note: r.note ?? r.tikkie_link,
          bunqLink: (() => {
            const l = bunqLinks.find((x) => x.reclaim_id === r.id);
            return l ? { url: l.share_url as string, amount: Number(l.amount), status: l.status as string } : null;
          })(),
        },
      });
    } else {
      const settled = one(r.settled_transaction);
      done.push({
        id: r.id,
        person: personName,
        amount: r.computed_amount,
        status: r.status,
        paidAt: r.paid_at,
        method: r.settlement_method === "external_app" ? "WieBetaaltWat" : "Bank / Tikkie",
        referenceCode: r.reference_code,
        sourceTotal: r.source_total_amount,
        note: r.note ?? r.tikkie_link,
        settledText: settled
          ? `${settled.counterparty_name ?? "onbekend"} · ${new Date(settled.booking_date).toLocaleDateString("nl-NL")} · ${euro(settled.amount)}`
          : null,
      });
    }
  }

  const openRequestsFor = (personId: string) =>
    paymentRequests
      .filter((pr) => pr.person_id === personId && pr.status === "requested")
      .map((pr) => ({
        id: pr.id,
        referenceCode: pr.reference_code,
        total: (Array.isArray(pr.reclaims) ? pr.reclaims : []).reduce((s, l) => s + l.computed_amount, 0),
      }));

  const otherReclaimsFor = (personId: string, excludeId: string) =>
    reclaims
      .filter(
        (r) =>
          r.person_id === personId &&
          r.status === "requested" &&
          r.settlement_method === "bank" &&
          r.id !== excludeId
      )
      .map((r) => ({
        id: r.id,
        label: one(r.transactions)?.counterparty_name ?? "Onbekend",
        amount: r.computed_amount,
      }));

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
        <h1 className="min-w-0 truncate text-2xl font-semibold text-gray-900">
          {tx?.counterparty_name ?? "Transactie"}
        </h1>
      </div>

      {tx ? (
        <div className="space-y-2 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
          <p className="text-4xl font-semibold text-gray-900">{euro(Math.abs(tx.amount))}</p>
          <p className="text-sm text-gray-500">
            {new Date(tx.booking_date).toLocaleDateString("nl-NL")}
          </p>
          <TxDetails
            tx={{
              name: tx.counterparty_name,
              date: tx.booking_date,
              amount: tx.amount,
              description: tx.raw_description,
              iban: tx.counterparty_iban,
            }}
          />
        </div>
      ) : (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Geen terugvorderingen gevonden voor deze transactie.
        </p>
      )}

      {open.length > 0 && (
        <ul className="space-y-3">
          {open.map(({ item, personId }) => (
            <ItemCard
              key={item.id}
              item={item}
              personName={item.title}
              incoming={incoming}
              bunqEnabled={bunqEnabled}
              openRequests={openRequestsFor(personId)}
              otherReclaims={otherReclaimsFor(personId, item.id)}
            />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-lg font-semibold text-gray-900">Afgerond</h2>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {done.map((d) => (
              <li key={d.id}>
                <details className="group">
                  <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-2 text-base text-gray-700 [&::-webkit-details-marker]:hidden">
                    <span>
                      {d.person}
                      {d.status === "written_off" && " · niet inbaar"}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{euro(d.amount)}</span>
                      <span className="text-2xl text-gray-300 transition-transform group-open:rotate-90">›</span>
                    </span>
                  </summary>
                  <div className="space-y-2 px-5 pb-4 text-base text-gray-700">
                    <p className="text-sm text-gray-500">
                      {d.status === "written_off"
                        ? "Niet inbaar"
                        : d.paidAt
                          ? `Ontvangen op ${new Date(d.paidAt).toLocaleDateString("nl-NL")}`
                          : "Ontvangen"}
                      {" · "}
                      {d.method}
                    </p>
                    {d.sourceTotal != null && Math.abs(d.sourceTotal - d.amount) > 0.01 && (
                      <p className="text-sm text-gray-500">
                        Jouw deel {euro(d.amount)} van {euro(d.sourceTotal)} totaal
                      </p>
                    )}
                    {d.referenceCode && <p className="text-sm text-gray-500">Referentiecode {d.referenceCode}</p>}
                    {d.note && <p className="whitespace-pre-wrap break-words text-sm italic text-gray-600">{d.note}</p>}
                    {d.settledText && <p className="text-sm text-gray-500">Gekoppelde betaling: {d.settledText}</p>}
                    <DoneActions kind="reclaim" id={d.id} status={d.status} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
