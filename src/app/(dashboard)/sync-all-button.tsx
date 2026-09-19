"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncAllNow } from "@/actions/bank-connections";

export function SyncAllButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const results = await syncAllNow();
            const failed = results.filter((r) => r.error);
            const total = results.reduce((sum, r) => sum + r.count, 0);
            if (results.length === 0) {
              setMessage({ text: "Geen gekoppelde banken.", isError: true });
            } else if (failed.length > 0) {
              setMessage({
                text: `${failed.map((f) => f.name).join(", ")}: mislukt`,
                isError: true,
              });
            } else {
              setMessage({ text: `${total} transacties bijgewerkt`, isError: false });
            }
            router.refresh();
          });
        }}
        className="flex min-h-[44px] items-center gap-2 rounded-full bg-teal-700 px-4 text-base font-medium text-white active:bg-teal-800 disabled:opacity-60"
      >
        <span className={isPending ? "inline-block animate-spin" : "inline-block"}>↻</span>
        {isPending ? "Bezig…" : "Verversen"}
      </button>
      {message && (
        <span className={`text-sm ${message.isError ? "text-red-600" : "text-gray-500"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
