import {
  createReclaim,
  getRecentExpenseTransactions,
  getReclaims,
  getUnlinkedIncomingTransactions,
} from "@/actions/reclaims";
import { LinkTransaction, UnlinkButton } from "./link-transaction";

export default async function ReclaimsPage() {
  const [transactions, reclaims, incomingTransactions] = await Promise.all([
    getRecentExpenseTransactions(),
    getReclaims(),
    getUnlinkedIncomingTransactions(),
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
        <form
          action={createReclaim}
          className="space-y-3 rounded-md border border-gray-200 bg-white p-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Transactie (afschrijving)
            </label>
            <select
              name="transactionId"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {transactions.map((tx) => (
                <option key={tx.id} value={tx.id}>
                  {new Date(tx.booking_date).toLocaleDateString("nl-NL")} ·{" "}
                  {tx.counterparty_name ?? "Onbekend"} · €
                  {Math.abs(tx.amount).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Van wie krijg je geld terug?
            </label>
            <input
              type="text"
              name="personName"
              required
              placeholder="Naam"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Type
              </label>
              <select
                name="amountType"
                defaultValue="fixed"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="fixed">Vast bedrag (€)</option>
                <option value="fraction">Deel van het bedrag (bv. 0.33 voor 1/3)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Waarde
              </label>
              <input
                type="number"
                step="0.01"
                name="amountValue"
                required
                placeholder="bv. 15 of 0.33"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Betaalverzoek-link of notitie (optioneel)
            </label>
            <input
              type="text"
              name="tikkieLink"
              placeholder="Tikkie-link, of een notitie zoals 'betaalverzoek via ING'"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Toevoegen
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Overzicht</h2>
        {reclaims.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {reclaims.map((r) => {
              const relatedTx = Array.isArray(r.transactions)
                ? r.transactions[0]
                : r.transactions;
              const settledTx = Array.isArray(r.settled_transaction)
                ? r.settled_transaction[0]
                : r.settled_transaction;
              return (
                <li key={r.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">
                        {r.person_name} · €{r.computed_amount.toFixed(2)}
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
                    />
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
