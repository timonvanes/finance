"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncNow } from "@/actions/bank-connections";

export function SyncButton({ bankConnectionId }: { bankConnectionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        setResult(null);
        startTransition(async () => {
          const count = await syncNow(bankConnectionId);
          setResult(`${count} transacties`);
          router.refresh();
        });
      }}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {isPending ? "Bezig…" : result ?? "Sync now"}
    </button>
  );
}
