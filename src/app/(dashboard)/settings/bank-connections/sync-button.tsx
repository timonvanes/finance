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
    <div className="flex flex-col items-end gap-1">
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
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : "Sync now"}
      </button>
      {result && (
        <span className={`max-w-[200px] text-right text-xs ${isError ? "text-red-600" : "text-gray-500"}`}>
          {result}
        </span>
      )}
    </div>
  );
}
