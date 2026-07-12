"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flagTransactionForReclaim } from "@/actions/reclaims";

export function FlagReclaimButton({ transactionId }: { transactionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();

  if (done) {
    return (
      <p className="text-xs font-medium text-green-700">
        ✓ Toegevoegd aan wachtrij bij Terugvorderingen
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const formData = new FormData();
        formData.set("transactionId", transactionId);
        startTransition(async () => {
          await flagTransactionForReclaim(formData);
          setDone(true);
          router.refresh();
        });
      }}
      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {isPending ? "Bezig…" : "Terugvorderen"}
    </button>
  );
}
