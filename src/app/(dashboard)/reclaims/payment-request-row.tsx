"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  linkPaymentRequestToTransaction,
  markPaymentRequestPaid,
  uncombinePaymentRequest,
  unlinkPaymentRequest,
} from "@/actions/payment-requests";
import { ReferenceCode } from "./reference-code";

interface IncomingTransaction {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
}

interface ReclaimLine {
  id: string;
  computed_amount: number;
  booking_date: string | null;
  counterparty_name: string | null;
}

export function PaymentRequestRow({
  id,
  personName,
  status,
  referenceCode,
  tikkieLink,
  reclaims,
  settledTransaction,
  incomingTransactions,
}: {
  id: string;
  personName: string;
  status: string;
  referenceCode: string;
  tikkieLink: string | null;
  reclaims: ReclaimLine[];
  settledTransaction: { booking_date: string; counterparty_name: string | null; amount: number } | null;
  incomingTransactions: IncomingTransaction[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const total = reclaims.reduce((sum, r) => sum + r.computed_amount, 0);
  const sorted = [...incomingTransactions].sort(
    (a, b) => Math.abs(a.amount - total) - Math.abs(b.amount - total)
  );

  return (
    <li className="flex flex-col gap-2 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 truncate font-medium text-gray-900">
            {personName} · €{total.toFixed(2)}
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
              gecombineerd ({reclaims.length}x)
            </span>
            {status !== "paid" && <ReferenceCode code={referenceCode} />}
          </p>
          <p className="text-gray-500">
            {reclaims
              .map(
                (r) =>
                  `${r.counterparty_name ?? "Onbekend"}${r.booking_date ? " (" + new Date(r.booking_date).toLocaleDateString("nl-NL") + ")" : ""} €${r.computed_amount.toFixed(2)}`
              )
              .join(" · ")}
            {tikkieLink && (
              <>
                {" · "}
                <span className="italic">{tikkieLink}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status === "paid" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  await unlinkPaymentRequest(id);
                  router.refresh();
                });
              }}
              className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
            >
              Ongedaan maken
            </button>
          )}
          {status !== "paid" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (!confirm("Deze combinatie ontbinden? De terugvorderingen blijven los bestaan.")) return;
                startTransition(async () => {
                  try {
                    await uncombinePaymentRequest(id);
                    router.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Ontbinden mislukt");
                  }
                });
              }}
              className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
            >
              Ontbinden
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {status === "paid" && settledTransaction && (
        <p className="text-xs text-gray-400">
          Gekoppeld aan betaling van {settledTransaction.counterparty_name ?? "onbekend"} op{" "}
          {new Date(settledTransaction.booking_date).toLocaleDateString("nl-NL")} (€
          {settledTransaction.amount.toFixed(2)})
        </p>
      )}
      {status !== "paid" && (
        <div className="flex items-center gap-2">
          <select
            disabled={isPending}
            defaultValue=""
            onChange={(e) => {
              const transactionId = e.target.value;
              if (!transactionId) return;
              startTransition(async () => {
                await linkPaymentRequestToTransaction(id, transactionId);
                router.refresh();
              });
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
          >
            <option value="" disabled>
              Koppel binnengekomen betaling…
            </option>
            {sorted.map((tx) => {
              const isCloseMatch = Math.abs(tx.amount - total) < 0.01;
              return (
                <option key={tx.id} value={tx.id}>
                  {isCloseMatch ? "✓ " : ""}
                  {new Date(tx.booking_date).toLocaleDateString("nl-NL")} ·{" "}
                  {tx.counterparty_name ?? "Onbekend"} · €{tx.amount.toFixed(2)}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await markPaymentRequestPaid(id);
                router.refresh();
              });
            }}
            className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Handmatig markeren
          </button>
        </div>
      )}
    </li>
  );
}
