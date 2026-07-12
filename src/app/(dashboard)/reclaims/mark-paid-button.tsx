"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markReclaimPaid } from "@/actions/reclaims";

export function MarkPaidButton({ reclaimId }: { reclaimId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await markReclaimPaid(reclaimId);
          router.refresh();
        });
      }}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {isPending ? "Bezig…" : "Markeer betaald"}
    </button>
  );
}
