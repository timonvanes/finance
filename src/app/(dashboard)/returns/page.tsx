import { getInboundMails, getOrders, getUnlinkedIncomingTransactionsForReturns } from "@/actions/returns";
import { ImportForm } from "./import-form";
import { OrderRow } from "./order-row";
import { ReturnMailForm } from "./return-mail-form";
import { InfoButton } from "../info-button";

export default async function ReturnsPage() {
  const [rawOrders, incomingTransactions, inboundMails] = await Promise.all([
    getOrders(),
    getUnlinkedIncomingTransactionsForReturns(),
    getInboundMails(),
  ]);

  // The refund_transaction join comes back array-shaped from Supabase even
  // though refund_transaction_id is a single FK — normalize to one object.
  const orders = rawOrders.map((order) => ({
    ...order,
    refund_transaction: Array.isArray(order.refund_transaction)
      ? (order.refund_transaction[0] ?? null)
      : order.refund_transaction,
  }));

  const daysLeft = (iso: string) => Math.ceil((new Date(`${iso}T23:59:59`).getTime() - Date.now()) / 86_400_000);
  const upcoming = orders
    .filter(
      (o) =>
        o.return_deadline &&
        o.refund_status === "not_returned" &&
        o.order_items.some((i: { returned: boolean }) => !i.returned) &&
        daysLeft(o.return_deadline) >= 0
    )
    .sort((a, b) => (a.return_deadline! < b.return_deadline! ? -1 : 1))
    .slice(0, 6);

  const sortedOrders = [...orders].sort((a, b) => {
    const live = (o: (typeof orders)[number]) =>
      o.return_deadline &&
      o.refund_status === "not_returned" &&
      o.order_items.some((i: { returned: boolean }) => !i.returned) &&
      daysLeft(o.return_deadline) >= 0;
    const la = live(a);
    const lb = live(b);
    if (la && lb) return a.return_deadline! < b.return_deadline! ? -1 : 1;
    if (la) return -1;
    if (lb) return 1;
    return a.created_at < b.created_at ? 1 : -1;
  });

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

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">Nog terug te sturen</h2>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {upcoming.map((o) => (
              <li key={o.id} className="flex min-h-[64px] items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0 truncate text-base font-medium text-gray-900">{o.merchant_name}</span>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
                    daysLeft(o.return_deadline!) <= 3 ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                  }`}
                >
                  nog {daysLeft(o.return_deadline!)} {daysLeft(o.return_deadline!) === 1 ? "dag" : "dagen"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inboundMails.length > 0 && (
        <details className="rounded-2xl bg-white ring-1 ring-gray-200">
          <summary className="flex min-h-[56px] cursor-pointer items-center px-5 text-base font-medium text-gray-700">
            Ontvangen mails ({inboundMails.length})
          </summary>
          <ul className="divide-y divide-gray-100 px-5 pb-2">
            {inboundMails.map((m) => (
              <li key={m.id} className="py-3">
                <p className="truncate text-base text-gray-900">{m.subject || "(geen onderwerp)"}</p>
                <p className={`text-sm ${m.outcome.startsWith("Retourmail:") ? "text-amber-700" : "text-gray-500"}`}>
                  {m.outcome}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">Bestellingen ({orders.length})</h2>
        {orders.length > 0 ? (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {sortedOrders.map((order) => (
              <OrderRow key={order.id} order={order} incomingTransactions={incomingTransactions} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">Nog geen bestellingen toegevoegd.</p>
        )}
      </section>

      <details className="rounded-2xl bg-white ring-1 ring-gray-200">
        <summary className="flex min-h-[56px] cursor-pointer items-center px-5 text-base font-medium text-gray-700">
          Retourmail zelf plakken
        </summary>
        <div className="px-3 pb-3">
          <ReturnMailForm />
        </div>
      </details>

      <details className="rounded-2xl bg-white ring-1 ring-gray-200">
        <summary className="flex min-h-[56px] cursor-pointer items-center px-5 text-base font-medium text-gray-700">
          Bestelling zelf toevoegen
        </summary>
        <div className="px-3 pb-3">
          <ImportForm />
        </div>
      </details>
    </div>
  );
}
