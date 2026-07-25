import {
  createSharedExpenseEvent,
  getSettlementCandidates,
  getSharedExpenseEvents,
  getTaggableTransactions,
} from "@/actions/shared-expense-events";
import { EventRow } from "./event-row";

export default async function EventsPage() {
  const [rawEvents, taggableTransactions, settlementCandidates] = await Promise.all([
    getSharedExpenseEvents(),
    getTaggableTransactions(),
    getSettlementCandidates(),
  ]);

  const events = rawEvents.map((e) => {
    const settledTx = Array.isArray(e.settled_transaction) ? e.settled_transaction[0] : e.settled_transaction;
    const taggedTransactions = Array.isArray(e.transactions) ? e.transactions : e.transactions ? [e.transactions] : [];
    return {
      id: e.id,
      name: e.name,
      settlementAmount: e.settlement_amount,
      settlementDirection: e.settlement_direction,
      settlementTransactionId: e.settlement_transaction_id,
      settledTransaction: settledTx ?? null,
      taggedTransactions,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Gedeelde uitgaven</h1>
        <p className="mt-1 text-sm text-gray-500">
          Voor een vakantie of uitje waarbij jij sommige dingen betaalt en een ander andere
          dingen — koppel je eigen transacties aan de gebeurtenis, vul de eindafrekening in
          (bijvoorbeeld al berekend in WieBetaaltWat), en zie je werkelijke nettokosten.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Nieuwe gebeurtenis</h2>
        <form
          action={createSharedExpenseEvent}
          className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-4"
        >
          <div className="flex-1 basis-40">
            <label className="mb-1 block text-xs font-medium text-gray-700">Naam</label>
            <input
              type="text"
              name="name"
              required
              placeholder="bv. Vakantie met vrienden"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Aanmaken
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Mijn gebeurtenissen ({events.length})</h2>
        {events.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                taggableTransactions={taggableTransactions}
                settlementCandidates={settlementCandidates}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Nog geen gedeelde uitgaven aangemaakt.</p>
        )}
      </section>
    </div>
  );
}
