"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncNow, updateSyncFromDate } from "@/actions/bank-connections";

export function SyncFromDate({
  bankConnectionId,
  syncFromDate,
}: {
  bankConnectionId: string;
  syncFromDate: string | null;
}) {
  const [value, setValue] = useState(syncFromDate ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save(next: string | null) {
    startTransition(async () => {
      await updateSyncFromDate(bankConnectionId, next);
      await syncNow(bankConnectionId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
      <label title="Verbergt transacties van vóór deze datum uit alle overzichten en analyses. Niets wordt verwijderd — leeg de datum om weer alles te zien.">
        Historie vanaf (standaard 90 dagen):
      </label>
      <input
        type="date"
        value={value}
        disabled={isPending}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
      />
      <button
        type="button"
        disabled={isPending || !value}
        onClick={() => save(value)}
        className="text-xs text-gray-600 underline hover:text-gray-900 disabled:opacity-50"
      >
        Opslaan &amp; sync
      </button>
      {syncFromDate && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setValue("");
            save(null);
          }}
          className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
        >
          Standaard (90 dagen)
        </button>
      )}
    </div>
  );
}
