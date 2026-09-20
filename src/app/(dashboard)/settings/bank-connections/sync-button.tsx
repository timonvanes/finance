"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncNow } from "@/actions/bank-connections";

export function SyncButton({ bankConnectionId }: { bankConnectionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  return (
    <div className="flex min-w-0 max-w-full flex-col items-start gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setResult(null);
          setIsError(false);
          startTransition(async () => {
            const { count, error } = await syncNow(bankConnectionId);
            if (error) {
              setIsError(true);
              setResult(error);
            } else {
              setResult(`${count} transacties`);
            }
            router.refresh();
          });
        }}
        className="min-h-[48px] rounded-xl border border-gray-300 px-5 text-base font-medium text-gray-800 active:bg-gray-50 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : "Verversen"}
      </button>
      {result && (
        <span className={`text-sm [overflow-wrap:anywhere] ${isError ? "text-red-600" : "text-gray-500"}`}>
          {result}
        </span>
      )}
    </div>
  );
}
