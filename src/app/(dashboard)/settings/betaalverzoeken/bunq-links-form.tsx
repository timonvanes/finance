"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBunqPaymentLinksEnabled } from "@/actions/settings";

export function BunqLinksForm({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(next: boolean) {
    setError(null);
    setEnabled(next);
    startTransition(async () => {
      try {
        await setBunqPaymentLinksEnabled(next);
        router.refresh();
      } catch (e) {
        setEnabled(!next);
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <label className="flex min-h-[44px] items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-base text-gray-900">bunq-betaallinks</span>
          <span className="block text-sm text-gray-500">Heeft bunq Premium nodig</span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={isPending}
          onChange={(e) => toggle(e.target.checked)}
          className="h-6 w-6 shrink-0 accent-teal-700"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
