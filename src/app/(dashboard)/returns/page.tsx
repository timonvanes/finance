import { getOrders, getUnlinkedIncomingTransactionsForReturns } from "@/actions/returns";
import { ImportForm } from "./import-form";
import { OrderRow } from "./order-row";
import { ReturnMailForm } from "./return-mail-form";
import { InfoButton } from "../info-button";

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
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold text-gray-900">Retouren</h1>
        <InfoButton>
          <p>
            Plak een orderbevestigingsmail om de artikelen te herkennen, vink aan wat je retour
            stuurt en koppel de restitutie zodra die binnenkomt.
          </p>
          <p>
            Krijg je een retourbevestiging of creditnota, plak die dan bij{" "}
            <span className="font-medium">Retourmail verwerken</span>: de app zoekt de bestelling erbij,
            markeert de artikelen als retour en vult verzendkosten en retourkosten in.
          </p>
          <p>
            <span className="font-medium">Verzendkosten terug</span> zijn de verzendkosten van je
            oorspronkelijke bestelling die de winkel meeteruggeeft.{" "}
            <span className="font-medium">Retourkosten ingehouden</span> is wat de winkel van het
            terug te betalen bedrag afhoudt, bijvoorbeeld voor het retourlabel.
          </p>
        </InfoButton>
      </div>

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">Retourmail verwerken</h2>
        <ReturnMailForm />
      </section>

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">Nieuwe bestelling</h2>
        <ImportForm />
      </section>

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">Bestellingen ({orders.length})</h2>
        {orders.length > 0 ? (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} incomingTransactions={incomingTransactions} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">Nog geen bestellingen toegevoegd.</p>
        )}
      </section>
    </div>
  );
}
