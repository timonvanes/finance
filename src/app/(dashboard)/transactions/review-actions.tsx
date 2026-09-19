"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markAsTransfer, markOwnExpense, unreviewTransaction } from "@/actions/reclaims";

export function ReviewActions({
  transactionId,
  reviewed,
  flaggedForReclaim,
  isTransfer,
  isExpense = true,
  hasReclaim = false,
}: {
  transactionId: string;
  reviewed: boolean;
  flaggedForReclaim: boolean;
  isTransfer: boolean;
  // Income transactions can't be "eigen uitgave"/"terugvorderen" — only
  // the "geen kosten" toggle applies to those.
  isExpense?: boolean;
  hasReclaim?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [localReviewed, setLocalReviewed] = useState(reviewed);
  const [localIsTransfer, setLocalIsTransfer] = useState(isTransfer);
  const router = useRouter();

  const splitHref = `/terugvorderen/nieuw?transactionId=${transactionId}`;

  if (localReviewed || localIsTransfer || hasReclaim) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {localIsTransfer ? (
          <span className="text-sm font-medium text-blue-700">↔ Geen kosten — telt niet mee</span>
        ) : hasReclaim ? (
          <Link
            href={`/terugvorderen/t/${transactionId}`}
            className="text-sm font-medium text-teal-700 underline"
          >
            Terugvordering bekijken
          </Link>
        ) : flaggedForReclaim ? (
          <Link href={splitHref} className="text-sm font-medium text-amber-700 underline">
            Nog te verdelen — verdeel nu
          </Link>
        ) : (
          <span className="text-sm font-medium text-gray-500">
            {isExpense ? "✓ Eigen uitgave" : "✓ Bevestigd"}
          </span>
        )}
        {!hasReclaim && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await unreviewTransaction(transactionId);
                setLocalReviewed(false);
                setLocalIsTransfer(false);
                router.refresh();
              });
            }}
            className="min-h-[44px] text-sm text-gray-400 underline disabled:opacity-50"
          >
            Ongedaan maken
          </button>
        )}
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
                router.refresh();
              });
            }}
            className="min-h-[44px] rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 active:bg-gray-50 disabled:opacity-50"
          >
            Eigen uitgave
          </button>
          <Link
            href={splitHref}
            className="flex min-h-[44px] items-center rounded-xl bg-gray-900 px-4 text-sm font-medium text-white active:bg-gray-700"
          >
            Terugvorderen
          </Link>
        </>
      )}
      {!isExpense && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            const formData = new FormData();
            formData.set("transactionId", transactionId);
            startTransition(async () => {
              await markOwnExpense(formData);
              setLocalReviewed(true);
              router.refresh();
            });
          }}
          className="min-h-[44px] rounded-xl bg-gray-900 px-4 text-sm font-medium text-white active:bg-gray-700 disabled:opacity-50"
        >
          Bevestigen
        </button>
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
        className="min-h-[44px] rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 active:bg-blue-100 disabled:opacity-50"
      >
        Geen kosten
      </button>
    </div>
  );
}
