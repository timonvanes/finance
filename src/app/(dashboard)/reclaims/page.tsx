import {
  getRecentExpenseTransactions,
  getReclaims,
  getUnlinkedIncomingTransactions,
} from "@/actions/reclaims";
import { getPeople } from "@/actions/people";
import { LinkTransaction, UnlinkButton, DeleteButton } from "./link-transaction";
import { ReferenceCode } from "./reference-code";
import { SplitReclaimForm } from "./split-form";

export default async function ReclaimsPage() {
  const [transactions, reclaims, incomingTransactions, people] = await Promise.all([
    getRecentExpenseTransactions(),
    getReclaims(),
    getUnlinkedIncomingTransactions(),
    getPeople(),
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

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Nieuwe terugvordering
        </h2>
        <SplitReclaimForm transactions={transactions} people={people} />
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
