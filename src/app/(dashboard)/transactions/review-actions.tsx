"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markAsTransfer, markOwnExpense, unreviewTransaction } from "@/actions/reclaims";
import { removeLoanEntryForTransaction } from "@/actions/loans";
import { unlinkReclaim } from "@/actions/reclaims";
import { unlinkPaymentRequest } from "@/actions/payment-requests";
import { LoanPicker } from "./loan-picker";

// Hides the list row right away (when the current filter would drop it anyway)
// instead of waiting for the server round trip; returns an undo for errors.
export function hideRow(target: HTMLElement, enabled: boolean) {
  const li = enabled ? target.closest("li") : null;
  li?.classList.add("hidden");
  return () => li?.classList.remove("hidden");
}

export function ReviewActions({
  transactionId,
  reviewed,
  flaggedForReclaim,
  isTransfer,
  isExpense = true,
  hasReclaim = false,
  loanLabel = null,
  people = [],
  openLoans = [],
  hideWhenHandled = false,
  settledBy = null,
}: {
  transactionId: string;
  reviewed: boolean;
  flaggedForReclaim: boolean;
  isTransfer: boolean;
  // Income transactions can't be "eigen uitgave"/"terugvorderen" — only
  // the "geen kosten" toggle applies to those.
  isExpense?: boolean;
  hasReclaim?: boolean;
  loanLabel?: string | null;
  people?: { id: string; name: string }[];
  openLoans?: { id: string; personName: string; balance: number }[];
  hideWhenHandled?: boolean;
  settledBy?: { kind: "reclaim" | "request"; id: string; label: string } | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [localReviewed, setLocalReviewed] = useState(reviewed);
  const [localIsTransfer, setLocalIsTransfer] = useState(isTransfer);
  const router = useRouter();

  function handle(target: HTMLElement, kind: "own" | "transfer") {
    const showAgain = hideRow(target, hideWhenHandled);
    if (kind === "own") setLocalReviewed(true);
    else setLocalIsTransfer(true);
    startTransition(async () => {
      try {
        if (kind === "own") {
          const formData = new FormData();
          formData.set("transactionId", transactionId);
          await markOwnExpense(formData);
        } else {
          await markAsTransfer(transactionId);
        }
      } catch {
        showAgain();
        if (kind === "own") setLocalReviewed(false);
        else setLocalIsTransfer(false);
      }
    });
  }

  const splitHref = `/terugvorderen/nieuw?transactionId=${transactionId}`;

  if (localReviewed || localIsTransfer || hasReclaim) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {settledBy ? (
          <>
            <span className="text-sm font-medium text-teal-700">↔ {settledBy.label}</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (!confirm("Ontkoppelen? De terugvordering staat dan weer open.")) return;
                startTransition(async () => {
                  if (settledBy.kind === "request") await unlinkPaymentRequest(settledBy.id);
                  else await unlinkReclaim(settledBy.id);
                  router.refresh();
                });
              }}
              className="min-h-[44px] rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 active:bg-gray-50 disabled:opacity-50"
            >
              Ontkoppelen
            </button>
          </>
        ) : loanLabel ? (
          <Link href="/leningen" className="text-sm font-medium text-purple-700 underline">
            {loanLabel}
          </Link>
        ) : localIsTransfer ? (
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
        {!hasReclaim && !settledBy && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setLocalReviewed(false);
              setLocalIsTransfer(false);
              startTransition(async () => {
                if (loanLabel) await removeLoanEntryForTransaction(transactionId);
                else await unreviewTransaction(transactionId);
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
            onClick={(e) => handle(e.currentTarget, "own")}
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
          onClick={(e) => handle(e.currentTarget, "own")}
          className="min-h-[44px] rounded-xl bg-gray-900 px-4 text-sm font-medium text-white active:bg-gray-700 disabled:opacity-50"
        >
          Bevestigen
        </button>
      )}
      {(!isExpense || openLoans.length > 0) && (
        <LoanPicker
          transactionId={transactionId}
          mode={isExpense ? "repay" : "borrow"}
          people={people}
          openLoans={openLoans}
          hideWhenHandled={hideWhenHandled}
        />
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={(e) => handle(e.currentTarget, "transfer")}
        className="min-h-[44px] rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 active:bg-blue-100 disabled:opacity-50"
      >
        Geen kosten
      </button>
    </div>
  );
}
