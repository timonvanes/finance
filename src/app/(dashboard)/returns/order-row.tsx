"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteOrder,
  linkRefundToOrder,
  toggleItemReturned,
  unlinkRefund,
  updateOrderCosts,
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

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

const STATUS_LABEL: Record<string, string> = {
  not_returned: "Niks retour",
  pending: "Wacht op restitutie",
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
    refunded_shipping: number;
    return_fee: number;
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
  const [shipping, setShipping] = useState(order.refunded_shipping ? String(order.refunded_shipping) : "");
  const [fee, setFee] = useState(order.return_fee ? String(order.return_fee) : "");
  const router = useRouter();

  const itemsTotal = order.order_items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const returnedItems = order.order_items
    .filter((i) => i.returned)
    .reduce((sum, i) => sum + i.price * i.quantity, 0);
  // Shipping that was part of the original order (total minus the items).
  const paidShipping =
    order.total_amount != null ? Math.max(0, Math.round((order.total_amount - itemsTotal) * 100) / 100) : 0;

  const shippingRefund = order.refunded_shipping || 0;
  const returnFee = order.return_fee || 0;
  const expectedRefund = Math.max(0, returnedItems + shippingRefund - returnFee);
  const costsChanged =
    (Number(shipping) || 0) !== shippingRefund || (Number(fee) || 0) !== returnFee;

  const sortedIncoming = [...incomingTransactions].sort(
    (a, b) => Math.abs(a.amount - expectedRefund) - Math.abs(b.amount - expectedRefund)
  );

  const saveCosts = (nextShipping: number, nextFee: number) =>
    startTransition(async () => {
      await updateOrderCosts(order.id, nextShipping, nextFee);
      router.refresh();
    });

  return (
    <li className="flex flex-col gap-3 px-5 py-4 text-base">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-medium text-gray-900">{order.merchant_name}</p>
          <p className="text-sm text-gray-500">
            {order.order_date && new Date(order.order_date).toLocaleDateString("nl-NL")}
            {order.total_amount != null && ` · ${euro(order.total_amount)}`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[order.refund_status]}`}>
          {STATUS_LABEL[order.refund_status]}
        </span>
      </div>

      {order.order_items.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-xl bg-gray-50 px-3">
          {order.order_items.map((item) => (
            <li key={item.id}>
              <label className="flex min-h-[52px] items-center gap-3 text-base">
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
                <span className="text-gray-600">{euro(item.price * item.quantity)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {order.refund_status !== "not_returned" && (
        <div className="space-y-3 rounded-xl bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-700">Kosten en verzending</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-gray-500">Verzendkosten terug</span>
              <span className="flex h-[52px] items-center gap-1 rounded-xl border border-gray-300 bg-white px-3">
                <span className="text-gray-400">€</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={shipping}
                  disabled={isPending || order.refund_status === "refunded"}
                  onChange={(e) => setShipping(e.target.value)}
                  placeholder="0,00"
                  className="h-full w-full min-w-0 bg-transparent text-lg outline-none"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-500">Retourkosten ingehouden</span>
              <span className="flex h-[52px] items-center gap-1 rounded-xl border border-gray-300 bg-white px-3">
                <span className="text-gray-400">€</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={fee}
                  disabled={isPending || order.refund_status === "refunded"}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="0,00"
                  className="h-full w-full min-w-0 bg-transparent text-lg outline-none"
                />
              </span>
            </label>
          </div>
          {paidShipping > 0 && shippingRefund === 0 && order.refund_status !== "refunded" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setShipping(String(paidShipping));
                saveCosts(paidShipping, Number(fee) || 0);
              }}
              className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 active:bg-gray-50 disabled:opacity-50"
            >
              Betaalde verzendkosten ({euro(paidShipping)}) komen ook terug
            </button>
          )}
          {costsChanged && order.refund_status !== "refunded" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => saveCosts(Number(shipping) || 0, Number(fee) || 0)}
              className="min-h-[48px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
            >
              Kosten opslaan
            </button>
          )}
        </div>
      )}

      {order.refund_status !== "not_returned" && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-gray-500">Verwacht terug</span>
            <span className="text-2xl font-semibold text-gray-900">{euro(expectedRefund)}</span>
          </div>
          {(shippingRefund > 0 || returnFee > 0) && (
            <p className="text-sm text-gray-500">
              {euro(returnedItems)} artikelen
              {shippingRefund > 0 && ` + ${euro(shippingRefund)} verzendkosten`}
              {returnFee > 0 && ` − ${euro(returnFee)} retourkosten`}
            </p>
          )}

          {order.refund_status === "refunded" && order.refund_transaction ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                Gekoppeld aan {order.refund_transaction.counterparty_name ?? "onbekend"} op{" "}
                {new Date(order.refund_transaction.booking_date).toLocaleDateString("nl-NL")} (
                {euro(order.refund_transaction.amount)})
                {Math.abs(order.refund_transaction.amount - expectedRefund) >= 0.01 && (
                  <span className="text-amber-700">
                    {" "}
                    — {euro(Math.abs(order.refund_transaction.amount - expectedRefund))}{" "}
                    {order.refund_transaction.amount > expectedRefund ? "meer" : "minder"} dan verwacht
                  </span>
                )}
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
                className="min-h-[44px] rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 active:bg-gray-50 disabled:opacity-50"
              >
                Ontkoppelen
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
              className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 disabled:opacity-50"
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
                    {tx.counterparty_name ?? "Onbekend"} · {euro(tx.amount)}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      )}

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
        className="min-h-[44px] self-start text-sm text-red-500 disabled:opacity-50"
      >
        Bestelling verwijderen
      </button>
    </li>
  );
}
