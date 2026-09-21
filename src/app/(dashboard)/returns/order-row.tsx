"use client";

import { useState, useTransition } from "react";
import { InfoButton } from "../info-button";
import { useRouter } from "next/navigation";
import { discountFactor } from "@/lib/returns/amounts";
import {
  addOrderClaim,
  clearKlarnaCredit,
  deleteOrderClaim,
  markClaimReceived,
  reopenClaim,
  deleteOrder,
  linkRefundToOrder,
  recordKlarnaCredit,
  setOrderPaymentMethod,
  setReturnDeadline,
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

export const daysLeft = (iso: string) =>
  Math.ceil((new Date(`${iso}T23:59:59`).getTime() - Date.now()) / 86_400_000);

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
    payment_method: string;
    credited_amount: number | null;
    return_deadline: string | null;
    discount_total: number;
    order_claims: {
      id: string;
      reason: string | null;
      expected_amount: number;
      status: string;
      refund_transaction_id: string | null;
    }[];
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
  const [klarnaAmount, setKlarnaAmount] = useState("");
  const [claimReason, setClaimReason] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const router = useRouter();

  const itemsTotal = order.order_items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = order.discount_total || 0;
  const factor = discountFactor(itemsTotal, discount);
  const returnedItems =
    order.order_items.filter((i) => i.returned).reduce((sum, i) => sum + i.price * i.quantity, 0) * factor;
  // Shipping that was part of the original order (total minus the discounted items).
  const paidShipping =
    order.total_amount != null
      ? Math.max(0, Math.round((order.total_amount - (itemsTotal - discount)) * 100) / 100)
      : 0;
  const payName = order.payment_method === "klarna" ? "Klarna" : "De winkel";
  const payTitle = order.payment_method === "klarna" ? "Betaald via Klarna" : "Betaald op rekening";

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
    <li className="text-base">
      <details className="group">
      <summary className="flex cursor-pointer list-none flex-col gap-1 px-5 py-4 active:bg-gray-50 [&::-webkit-details-marker]:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-medium text-gray-900">{order.merchant_name}</p>
          <p className="text-sm text-gray-500">
            {order.order_date && new Date(order.order_date).toLocaleDateString("nl-NL")}
            {order.total_amount != null && ` · ${euro(order.total_amount)}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[order.refund_status]}`}>
            {STATUS_LABEL[order.refund_status]}
          </span>
          {order.payment_method !== "direct" && (
            <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-medium text-pink-700">
              {order.payment_method === "klarna" ? "Klarna" : "Op rekening"}
            </span>
          )}
        </div>
      </div>
      {order.refund_status === "not_returned" && order.return_deadline && daysLeft(order.return_deadline) >= 0 && (
        <p className={`text-sm ${daysLeft(order.return_deadline) <= 3 ? "font-medium text-red-700" : "text-blue-700"}`}>
          Retour vóór {new Date(order.return_deadline).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} · nog{" "}
          {daysLeft(order.return_deadline)} dagen
        </p>
      )}
      </summary>

      <div className="flex flex-col gap-3 px-5 pb-4">
      {order.refund_status === "not_returned" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {order.return_deadline && (
            <span
              className={`rounded-full px-3 py-1 font-medium ${
                daysLeft(order.return_deadline) <= 3 ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
              }`}
            >
              {daysLeft(order.return_deadline) < 0
                ? "Retourtermijn verlopen"
                : `Retour vóór ${new Date(order.return_deadline).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} · nog ${daysLeft(order.return_deadline)} dagen`}
            </span>
          )}
          <label className="flex items-center gap-2 text-gray-500">
            {order.return_deadline ? "Wijzig" : "Retour vóór"}
            <input
              type="date"
              defaultValue={order.return_deadline ?? ""}
              onChange={(e) =>
                startTransition(async () => {
                  await setReturnDeadline(order.id, e.target.value || null);
                  router.refresh();
                })
              }
              className="min-h-[40px] rounded-lg border border-gray-300 bg-white px-2 text-gray-800"
            />
          </label>
        </div>
      )}

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

      {discount > 0 && (
        <p className="text-sm text-gray-500">
          Korting {euro(discount)} is verdeeld over de artikelen: je krijgt per artikel {Math.round(factor * 100)}% van de
          prijs terug.
        </p>
      )}

      {order.refund_status !== "not_returned" && (
        <div className="space-y-3 rounded-xl bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Kosten en verzending</p>
            <InfoButton>
              <p>
                <span className="font-medium">Verzendkosten terug</span>: verzendkosten van de
                oorspronkelijke bestelling die de winkel terugbetaalt (meestal bij een volledige retour).
              </p>
              <p>
                <span className="font-medium">Retourkosten ingehouden</span>: kosten die de winkel van je
                terugbetaling aftrekt, bijvoorbeeld voor het retourlabel.
              </p>
              <p>Verwacht terug = geretourneerde artikelen + verzendkosten terug − retourkosten.</p>
            </InfoButton>
          </div>
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
          ) : order.payment_method !== "direct" ? null : (
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

      {order.payment_method !== "direct" && order.refund_status !== "not_returned" && (
        <div className="space-y-2 rounded-xl bg-pink-50 p-4">
          <p className="text-sm font-medium text-pink-900">{payTitle}</p>
          {order.credited_amount != null ? (
            <>
              <p className="text-base text-pink-950">
                {payName} heeft <span className="font-semibold">{euro(order.credited_amount)}</span> verrekend of
                terugbetaald.
              </p>
              {Math.abs(order.credited_amount - expectedRefund) < 0.01 ? (
                <p className="text-base font-medium text-teal-700">Dat klopt met wat je terug zou krijgen.</p>
              ) : (
                <p className="text-base font-medium text-amber-800">
                  {euro(Math.abs(order.credited_amount - expectedRefund))}{" "}
                  {order.credited_amount < expectedRefund ? "minder" : "meer"} dan verwacht ({euro(expectedRefund)}).
                  {order.credited_amount < expectedRefund && " Vraag na waar het verschil blijft."}
                </p>
              )}
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await clearKlarnaCredit(order.id);
                    router.refresh();
                  })
                }
                className="min-h-[44px] rounded-xl border border-pink-200 bg-white px-4 text-sm font-medium text-gray-700 active:bg-gray-50 disabled:opacity-50"
              >
                Weer op &quot;wacht op restitutie&quot; zetten
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-pink-900">
                Een retour wordt meestal verrekend met wat je nog moet betalen (of uitbetaald). Vul in wat{" "}
                {order.payment_method === "klarna" ? "Klarna" : "de winkel"} zegt te hebben verrekend, dan controleert
                de app of het klopt.
              </p>
              <div className="flex gap-2">
                <label className="flex h-[48px] min-w-0 flex-1 items-center gap-1 rounded-xl border border-gray-300 bg-white px-3">
                  <span className="text-gray-400">€</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={klarnaAmount}
                    onChange={(e) => setKlarnaAmount(e.target.value)}
                    placeholder={expectedRefund.toFixed(2)}
                    className="h-full w-full min-w-0 bg-transparent text-lg outline-none"
                  />
                </label>
                <button
                  type="button"
                  disabled={isPending || !klarnaAmount}
                  onClick={() =>
                    startTransition(async () => {
                      await recordKlarnaCredit(order.id, Number(klarnaAmount));
                      setKlarnaAmount("");
                      router.refresh();
                    })
                  }
                  className="min-h-[48px] rounded-xl bg-pink-700 px-4 text-base font-medium text-white active:bg-pink-800 disabled:opacity-50"
                >
                  Vastleggen
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-600">
        Betaald
        <select
          value={order.payment_method}
          disabled={isPending}
          onChange={(e) =>
            startTransition(async () => {
              await setOrderPaymentMethod(order.id, e.target.value as "direct" | "klarna" | "invoice");
              router.refresh();
            })
          }
          className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-2 text-gray-800"
        >
          <option value="direct">Direct</option>
          <option value="klarna">Via Klarna</option>
          <option value="invoice">Op rekening</option>
        </select>
      </label>

      <details className="rounded-xl bg-gray-50 px-4">
        <summary className="flex min-h-[48px] cursor-pointer items-center text-sm font-medium text-gray-700">
          Klacht of vergoeding achteraf{order.order_claims.length > 0 && ` (${order.order_claims.length})`}
        </summary>
        <div className="space-y-3 pb-4">
          <p className="text-sm text-gray-500">
            Bijvoorbeeld bij slechte kwaliteit: leg vast hoeveel je terug verwacht, ook als je het artikel houdt of
            later toch terugstuurt.
          </p>
          {order.order_claims.map((c) => (
            <div key={c.id} className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-gray-200">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-base text-gray-900">{c.reason || "Vergoeding"}</p>
                <p className="shrink-0 text-base font-semibold text-gray-900">{euro(c.expected_amount)}</p>
              </div>
              {c.status === "received" ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-green-700">Ontvangen</span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await reopenClaim(c.id);
                        router.refresh();
                      })
                    }
                    className="min-h-[44px] text-sm text-gray-600 underline disabled:opacity-50"
                  >
                    Weer openzetten
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    disabled={isPending}
                    defaultValue=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) return;
                      startTransition(async () => {
                        await markClaimReceived(c.id, id);
                        router.refresh();
                      });
                    }}
                    className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 disabled:opacity-50"
                  >
                    <option value="" disabled>
                      Koppel binnengekomen betaling…
                    </option>
                    {[...incomingTransactions]
                      .sort(
                        (a, b) => Math.abs(a.amount - c.expected_amount) - Math.abs(b.amount - c.expected_amount)
                      )
                      .map((tx) => (
                        <option key={tx.id} value={tx.id}>
                          {Math.abs(tx.amount - c.expected_amount) < 0.01 ? "✓ " : ""}
                          {new Date(tx.booking_date).toLocaleDateString("nl-NL")} · {tx.counterparty_name ?? "Onbekend"} ·{" "}
                          {euro(tx.amount)}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await markClaimReceived(c.id, null);
                        router.refresh();
                      })
                    }
                    className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 active:bg-gray-50 disabled:opacity-50"
                  >
                    Handmatig als ontvangen markeren
                  </button>
                </div>
              )}
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!confirm("Deze vergoeding verwijderen?")) return;
                  startTransition(async () => {
                    await deleteOrderClaim(c.id);
                    router.refresh();
                  });
                }}
                className="min-h-[44px] text-sm text-red-500 disabled:opacity-50"
              >
                Verwijderen
              </button>
            </div>
          ))}
          <input
            value={claimReason}
            onChange={(e) => setClaimReason(e.target.value)}
            placeholder="Reden, bijv. slechte kwaliteit"
            className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
          />
          <div className="flex gap-2">
            <label className="flex h-[48px] min-w-0 flex-1 items-center gap-1 rounded-xl border border-gray-300 bg-white px-3">
              <span className="text-gray-400">€</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                placeholder="Verwacht bedrag"
                className="h-full w-full min-w-0 bg-transparent text-lg outline-none"
              />
            </label>
            <button
              type="button"
              disabled={isPending || !claimAmount}
              onClick={() =>
                startTransition(async () => {
                  await addOrderClaim(order.id, claimReason, Number(claimAmount));
                  setClaimReason("");
                  setClaimAmount("");
                  router.refresh();
                })
              }
              className="min-h-[48px] rounded-xl bg-gray-900 px-4 text-base font-medium text-white active:bg-gray-700 disabled:opacity-50"
            >
              Toevoegen
            </button>
          </div>
        </div>
      </details>

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
      </div>
      </details>
    </li>
  );
}
