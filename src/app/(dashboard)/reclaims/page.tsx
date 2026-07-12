import {
  createReclaim,
  getRecentExpenseTransactions,
  getReclaims,
} from "@/actions/reclaims";
import { MarkPaidButton } from "./mark-paid-button";

export default async function ReclaimsPage() {
  const [transactions, reclaims] = await Promise.all([
    getRecentExpenseTransactions(),
    getReclaims(),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-gray-900">Terugvorderingen</h1>

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
              Transactie
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
              Tikkie-link (optioneel)
            </label>
            <input
              type="url"
              name="tikkieLink"
              placeholder="https://tikkie.me/..."
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
              return (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
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
                        <a href={r.tikkie_link} target="_blank" className="underline">
                          Tikkie
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={
                      r.status === "paid"
                        ? "rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
                        : "rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
                    }
                  >
                    {r.status === "paid" ? "Ontvangen" : "Nog niet ontvangen"}
                  </span>
                  {r.status !== "paid" && <MarkPaidButton reclaimId={r.id} />}
                </div>
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
