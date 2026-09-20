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
    <div className="space-y-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
      <p>
        Transacties van vóór deze datum verdwijnen uit de overzichten. Niets wordt verwijderd; wis de
        datum om weer alles te zien (standaard 90 dagen).
      </p>
      <input
        type="date"
        value={value}
        disabled={isPending}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-4 text-base disabled:opacity-50"
      />
      <button
        type="button"
        disabled={isPending || !value}
        onClick={() => save(value)}
        className="min-h-[48px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
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
          className="min-h-[44px] w-full text-base text-gray-600 underline disabled:opacity-50"
        >
          Standaard (90 dagen)
        </button>
      )}
    </div>
  );
}
