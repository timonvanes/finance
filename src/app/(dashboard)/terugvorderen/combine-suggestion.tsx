"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { combineReclaims } from "@/actions/payment-requests";

export function CombineSuggestion({
  personName,
  reclaimIds,
  total,
}: {
  personName: string;
  reclaimIds: string[];
  total: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-3 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100">
      <p className="text-base text-blue-900">
        <span className="font-medium">{personName}</span> heeft {reclaimIds.length} losse
        terugvorderingen (
        {total.toLocaleString("nl-NL", { style: "currency", currency: "EUR" })}). Combineer ze tot één
        betaalverzoek?
      </p>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await combineReclaims(reclaimIds);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Combineren mislukt");
            }
          });
        }}
        className="min-h-[48px] w-full rounded-xl bg-blue-700 text-base font-medium text-white active:bg-blue-800 disabled:opacity-60"
      >
        {isPending ? "Bezig…" : "Combineer"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
