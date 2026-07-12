"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  linkReclaimToTransaction,
  markReclaimPaid,
  unlinkReclaim,
} from "@/actions/reclaims";

interface IncomingTransaction {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
}

export function LinkTransaction({
  reclaimId,
  computedAmount,
  incomingTransactions,
  showAutoMatch = true,
}: {
  reclaimId: string;
  computedAmount: number;
  incomingTransactions: IncomingTransaction[];
  showAutoMatch?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Suggest the closest amount match first.
  const sorted = [...incomingTransactions].sort(
    (a, b) => Math.abs(a.amount - computedAmount) - Math.abs(b.amount - computedAmount)
  );

  return (
    <div className="flex items-center gap-2">
      {showAutoMatch && (
        <select
          disabled={isPending}
          defaultValue=""
          onChange={(e) => {
            const transactionId = e.target.value;
            if (!transactionId) return;
            startTransition(async () => {
              await linkReclaimToTransaction(reclaimId, transactionId);
              router.refresh();
            });
          }}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
        >
          <option value="" disabled>
            Koppel binnengekomen betaling…
          </option>
          {sorted.map((tx) => {
            const isCloseMatch = Math.abs(tx.amount - computedAmount) < 0.01;
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
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await markReclaimPaid(reclaimId);
            router.refresh();
          });
        }}
        className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        Handmatig markeren
      </button>
    </div>
  );
}

export function UnlinkButton({ reclaimId }: { reclaimId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await unlinkReclaim(reclaimId);
          router.refresh();
        });
      }}
      className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
    >
      Ongedaan maken
    </button>
  );
}
