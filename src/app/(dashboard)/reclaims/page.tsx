import Link from "next/link";
import {
  getQueuedTransactions,
  getRecentExpenseTransactions,
  getReclaims,
  getUnlinkedIncomingTransactions,
  unflagTransactionForReclaim,
} from "@/actions/reclaims";
import { getPeople } from "@/actions/people";
import { LinkTransaction, UnlinkButton, DeleteButton } from "./link-transaction";
import { ReferenceCode } from "./reference-code";
import { SplitReclaimForm } from "./split-form";

export default async function ReclaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ transactionId?: string }>;
}) {
  const { transactionId } = await searchParams;
  const [transactions, reclaims, incomingTransactions, people, queuedTransactions] =
    await Promise.all([
      getRecentExpenseTransactions(),
      getReclaims(),
      getUnlinkedIncomingTransactions(),
      getPeople(),
      getQueuedTransactions(),
    ]);

  const outstandingTotal = reclaims
    .filter((r) => r.status !== "paid")
    .reduce((sum, r) => sum + r.computed_amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Terugvorderingen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Nog openstaand: <span className="font-medium text-gray-900">€{outstandingTotal.toFixed(2)}</span>
        </p>
      </div>

      {queuedTransactions.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-700">
            Te verdelen ({queuedTransactions.length})
          </h2>
          <ul className="divide-y divide-gray-200 rounded-md border border-amber-200 bg-amber-50">
            {queuedTransactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">
                    {tx.counterparty_name ?? "Onbekend"} · €{Math.abs(tx.amount).toFixed(2)}
                  </p>
                  <p className="truncate text-gray-500">
                    {new Date(tx.booking_date).toLocaleDateString("nl-NL")}
                    {tx.raw_description ? ` · ${tx.raw_description}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/reclaims?transactionId=${tx.id}#split-form`}
                    className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    Verdelen
                  </Link>
                  <form action={unflagTransactionForReclaim.bind(null, tx.id)}>
                    <button
                      type="submit"
                      className="text-xs text-gray-400 underline hover:text-gray-600"
                    >
                      Verwijderen uit wachtrij
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="split-form">
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Nieuwe terugvordering
        </h2>
        <SplitReclaimForm
          transactions={transactions}
          people={people}
          initialTransactionId={transactionId}
        />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-gray-700">Overzicht</h2>
        <p className="mb-2 text-xs text-gray-500">
          Klik op de code bij een openstaande terugvordering om 'm te kopiëren, en
          zet 'm in de omschrijving van je Tikkie/betaalverzoek — dan koppelt de
          betaling straks vanzelf.
        </p>
        {reclaims.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {reclaims.map((r) => {
              const relatedTx = Array.isArray(r.transactions)
                ? r.transactions[0]
                : r.transactions;
              const settledTx = Array.isArray(r.settled_transaction)
                ? r.settled_transaction[0]
                : r.settled_transaction;
              const person = Array.isArray(r.people) ? r.people[0] : r.people;
              return (
                <li key={r.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 truncate font-medium text-gray-900">
                        {person?.name ?? "Onbekend"} · €{r.computed_amount.toFixed(2)}
                        {r.status !== "paid" && r.reference_code && (
                          <ReferenceCode code={r.reference_code} />
                        )}
                      </p>
                      <p className="truncate text-gray-500">
                        {relatedTx?.counterparty_name ?? "Onbekend"} ·{" "}
                        {relatedTx?.booking_date &&
                          new Date(relatedTx.booking_date).toLocaleDateString("nl-NL")}
                        {r.tikkie_link && (
                          <>
                            {" · "}
                            <span className="italic">{r.tikkie_link}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={
                          r.status === "paid"
                            ? "rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
                            : "rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
                        }
                      >
                        {r.status === "paid" ? "Ontvangen" : "Nog niet ontvangen"}
                      </span>
                      {r.status === "paid" && <UnlinkButton reclaimId={r.id} />}
                      <DeleteButton reclaimId={r.id} />
                    </div>
                  </div>
                  {r.status === "paid" && settledTx && (
                    <p className="text-xs text-gray-400">
                      Gekoppeld aan betaling van {settledTx.counterparty_name ?? "onbekend"} op{" "}
                      {new Date(settledTx.booking_date).toLocaleDateString("nl-NL")} (€
                      {settledTx.amount.toFixed(2)})
                    </p>
                  )}
                  {r.status !== "paid" && (
                    <LinkTransaction
                      reclaimId={r.id}
                      computedAmount={r.computed_amount}
                      incomingTransactions={incomingTransactions}
                      showAutoMatch={r.settlement_method === "bank"}
                    />
                  )}
                  {r.status !== "paid" && r.settlement_method === "external_app" && (
                    <p className="text-xs text-gray-400">
                      Via WieBetaaltWat/andere app — wordt niet automatisch herkend.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Nog geen terugvorderingen.</p>
        )}
      </section>
    </div>
  );
}
