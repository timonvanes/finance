import { getInboundMails, getOrders, getUnlinkedIncomingTransactionsForReturns } from "@/actions/returns";
import { ImportForm } from "./import-form";
import { OrderRow } from "./order-row";
import { ReceiptScanForm } from "./receipt-scan-form";
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

  const byRecency = (a: (typeof orders)[number], b: (typeof orders)[number]) => {
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
  };

  const onlineOrders = orders.filter((o) => o.channel !== "physical").sort(byRecency);
  const physicalOrders = orders.filter((o) => o.channel === "physical").sort(byRecency);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold text-gray-900">Retouren</h1>
        <InfoButton>
          <p>
            Stuur bestel-, verzend- en retourmail door naar je koppeladres, dan komt hij hier vanzelf in te staan.
            Plak een mail of scan een bonnetje als dat niet lukt.
          </p>
          <p>
            <span className="font-medium">Online bestellingen</span> zijn bezorgd; de retourtermijn loopt vanaf de
            bezorgdatum. <span className="font-medium">Fysieke aankopen</span> zijn in de winkel gekocht (met een
            digitaal bonnetje); de termijn loopt vanaf de aankoopdatum zelf.
          </p>
          <p>
            <span className="font-medium">Verzendkosten terug</span> zijn de verzendkosten die de winkel
            meeteruggeeft. <span className="font-medium">Retourkosten ingehouden</span> is wat de winkel van het
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
                <span className="min-w-0 truncate text-base font-medium text-gray-900">
                  {o.merchant_name}
                  {o.channel === "physical" && <span className="ml-2 text-sm text-gray-400">winkel</span>}
                </span>
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

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">Online bestellingen ({onlineOrders.length})</h2>
        {onlineOrders.length > 0 ? (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {onlineOrders.map((order) => (
              <OrderRow key={order.id} order={order} incomingTransactions={incomingTransactions} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
            Nog geen online bestellingen toegevoegd.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">
          Fysieke aankopen ({physicalOrders.length})
        </h2>
        {physicalOrders.length > 0 ? (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {physicalOrders.map((order) => (
              <OrderRow key={order.id} order={order} incomingTransactions={incomingTransactions} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
            Nog geen fysieke aankopen — scan een bonnetje om er een toe te voegen.
          </p>
        )}
      </section>

      <details className="rounded-2xl bg-white ring-1 ring-gray-200">
        <summary className="flex min-h-[56px] cursor-pointer items-center px-5 text-base font-medium text-gray-700">
          Bestelling toevoegen
        </summary>
        <div className="space-y-4 px-3 pb-4">
          <div className="space-y-2">
            <p className="px-1 text-sm font-medium text-gray-700">Bonnetje van een winkel scannen</p>
            <ReceiptScanForm />
          </div>
          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="px-1 text-sm font-medium text-gray-700">Of: tekst van een mail plakken</p>
            <ImportForm />
          </div>
        </div>
      </details>

      <details className="rounded-2xl bg-white ring-1 ring-gray-200">
        <summary className="flex min-h-[56px] cursor-pointer items-center px-5 text-base font-medium text-gray-700">
          Retourmail zelf plakken
        </summary>
        <div className="px-3 pb-3">
          <ReturnMailForm />
        </div>
      </details>

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
    </div>
  );
}
