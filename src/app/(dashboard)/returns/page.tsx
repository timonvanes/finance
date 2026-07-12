import { getOrders, getUnlinkedIncomingTransactionsForReturns } from "@/actions/returns";
import { ImportForm } from "./import-form";
import { OrderRow } from "./order-row";

export default async function ReturnsPage() {
  const [rawOrders, incomingTransactions] = await Promise.all([
    getOrders(),
    getUnlinkedIncomingTransactionsForReturns(),
  ]);

  // The refund_transaction join comes back array-shaped from Supabase even
  // though refund_transaction_id is a single FK — normalize to one object.
  const orders = rawOrders.map((order) => ({
    ...order,
    refund_transaction: Array.isArray(order.refund_transaction)
      ? (order.refund_transaction[0] ?? null)
      : order.refund_transaction,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Retouren</h1>
        <p className="mt-1 text-sm text-gray-500">
          Plak een orderbevestigingsmail om de artikelen te herkennen, vink aan wat je
          retour stuurt, en koppel de restitutie zodra die binnenkomt.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Nieuwe bestelling</h2>
        <ImportForm />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Bestellingen ({orders.length})</h2>
        {orders.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} incomingTransactions={incomingTransactions} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Nog geen bestellingen toegevoegd.</p>
        )}
      </section>
    </div>
  );
}
