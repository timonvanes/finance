"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  flagTransactionForReclaim,
  markAsTransfer,
  markOwnExpense,
  unreviewTransaction,
} from "@/actions/reclaims";

export function ReviewActions({
  transactionId,
  reviewed,
  flaggedForReclaim,
  isTransfer,
  isExpense = true,
}: {
  transactionId: string;
  reviewed: boolean;
  flaggedForReclaim: boolean;
  isTransfer: boolean;
  // Income transactions can't be "eigen uitgave"/"terugvorderen" — only
  // the transfer toggle applies to those.
  isExpense?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [localReviewed, setLocalReviewed] = useState(reviewed);
  const [localFlagged, setLocalFlagged] = useState(flaggedForReclaim);
  const [localIsTransfer, setLocalIsTransfer] = useState(isTransfer);
  const router = useRouter();

  if (localReviewed || localIsTransfer) {
    return (
      <div className="flex items-center gap-3">
        {localIsTransfer ? (
          <span className="text-sm font-medium text-blue-700">↔ Verschuiving eigen rekening</span>
        ) : localFlagged ? (
          <Link href="/reclaims" className="text-sm font-medium text-amber-700 underline">
            In wachtrij om te verdelen — bekijk
          </Link>
        ) : (
          <span className="text-sm font-medium text-gray-500">✓ Eigen uitgave</span>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await unreviewTransaction(transactionId);
              setLocalReviewed(false);
              setLocalFlagged(false);
              setLocalIsTransfer(false);
              router.refresh();
            });
          }}
          className="text-sm text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
        >
          Ongedaan maken
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {isExpense && (
        <>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              const formData = new FormData();
              formData.set("transactionId", transactionId);
              startTransition(async () => {
                await markOwnExpense(formData);
                setLocalReviewed(true);
                setLocalFlagged(false);
                router.refresh();
              });
            }}
            className="min-h-[44px] rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Eigen uitgave
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              const formData = new FormData();
              formData.set("transactionId", transactionId);
              startTransition(async () => {
                await flagTransactionForReclaim(formData);
                setLocalReviewed(true);
                setLocalFlagged(true);
                router.refresh();
              });
            }}
            className="min-h-[44px] rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {isPending ? "Bezig…" : "Terugvorderen"}
          </button>
        </>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await markAsTransfer(transactionId);
            setLocalIsTransfer(true);
            router.refresh();
          });
        }}
        className="min-h-[44px] rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
      >
        Verschuiving eigen rekening
      </button>
    </div>
  );
}
