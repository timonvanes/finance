"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteOrder,
  linkRefundToOrder,
  toggleItemReturned,
  unlinkRefund,
} from "@/actions/returns";

interface Item {
  id: string;
  description: string;
  price: number;
  quantity: number;
  returned: boolean;
}

interface IncomingTransaction {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  not_returned: "Niks retour",
  pending: "Retour, wacht op restitutie",
  refunded: "Terugbetaald",
};

const STATUS_STYLE: Record<string, string> = {
  not_returned: "bg-gray-100 text-gray-600",
  pending: "bg-amber-50 text-amber-800",
  refunded: "bg-green-50 text-green-700",
};

export function OrderRow({
  order,
  incomingTransactions,
}: {
  order: {
    id: string;
    merchant_name: string;
    order_date: string | null;
    total_amount: number | null;
    refund_status: string;
    order_items: Item[];
    refund_transaction: {
      booking_date: string;
      counterparty_name: string | null;
      amount: number;
    } | null;
  };
  incomingTransactions: IncomingTransaction[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const expectedRefund = order.order_items
    .filter((i) => i.returned)
    .reduce((sum, i) => sum + i.price * i.quantity, 0);

  const sortedIncoming = [...incomingTransactions].sort(
    (a, b) => Math.abs(a.amount - expectedRefund) - Math.abs(b.amount - expectedRefund)
  );

  return (
    <li className="flex flex-col gap-3 px-4 py-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">
            {order.merchant_name}
            {order.total_amount != null && ` · €${order.total_amount.toFixed(2)}`}
          </p>
          <p className="text-gray-500">
            {order.order_date && new Date(order.order_date).toLocaleDateString("nl-NL")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[order.refund_status]}`}
          >
            {STATUS_LABEL[order.refund_status]}
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirm("Deze bestelling verwijderen?")) return;
              startTransition(async () => {
                await deleteOrder(order.id);
                router.refresh();
              });
            }}
            className="text-xs text-red-400 underline hover:text-red-600 disabled:opacity-50"
          >
            Verwijderen
          </button>
        </div>
      </div>

      {order.order_items.length > 0 && (
        <ul className="space-y-1 rounded-md border border-gray-100 bg-gray-50 p-2">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={item.returned}
                disabled={isPending || order.refund_status === "refunded"}
                onChange={(e) => {
                  startTransition(async () => {
                    await toggleItemReturned(item.id, e.target.checked);
                    router.refresh();
                  });
                }}
              />
              <span className={item.returned ? "flex-1 text-gray-400 line-through" : "flex-1 text-gray-900"}>
                {item.description}
                {item.quantity > 1 && ` (${item.quantity}x)`}
              </span>
              <span className="text-gray-500">
                €{(item.price * item.quantity).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {order.refund_status !== "not_returned" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Verwacht terug: <span className="font-medium text-gray-900">€{expectedRefund.toFixed(2)}</span>
          </p>

          {order.refund_status === "refunded" && order.refund_transaction ? (
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400">
                Gekoppeld aan {order.refund_transaction.counterparty_name ?? "onbekend"} op{" "}
                {new Date(order.refund_transaction.booking_date).toLocaleDateString("nl-NL")} (€
                {order.refund_transaction.amount.toFixed(2)})
              </p>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await unlinkRefund(order.id);
                    router.refresh();
                  });
                }}
                className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
              >
                Ongedaan maken
              </button>
            </div>
          ) : (
            <select
              disabled={isPending}
              defaultValue=""
              onChange={(e) => {
                const transactionId = e.target.value;
                if (!transactionId) return;
                startTransition(async () => {
                  await linkRefundToOrder(order.id, transactionId);
                  router.refresh();
                });
              }}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
            >
              <option value="" disabled>
                Koppel binnengekomen restitutie…
              </option>
              {sortedIncoming.map((tx) => {
                const isCloseMatch = Math.abs(tx.amount - expectedRefund) < 0.01;
                return (
                  <option key={tx.id} value={tx.id}>
                    {isCloseMatch ? "✓ " : ""}
                    {new Date(tx.booking_date).toLocaleDateString("nl-NL")} ·{" "}
                    {tx.counterparty_name ?? "Onbekend"} · €{tx.amount.toFixed(2)}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      )}
    </li>
  );
}
