"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  flagTransactionForReclaim,
  markOwnExpense,
  unreviewTransaction,
} from "@/actions/reclaims";

export function ReviewActions({
  transactionId,
  reviewed,
  flaggedForReclaim,
}: {
  transactionId: string;
  reviewed: boolean;
  flaggedForReclaim: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [localReviewed, setLocalReviewed] = useState(reviewed);
  const [localFlagged, setLocalFlagged] = useState(flaggedForReclaim);
  const router = useRouter();

  if (localReviewed) {
    return (
      <div className="flex items-center gap-3">
        {localFlagged ? (
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
    </div>
  );
}
