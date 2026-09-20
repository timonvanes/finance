"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteManualOwnIban } from "@/actions/own-ibans";

export function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Deze IBAN verwijderen?")) return;
        startTransition(async () => {
          await deleteManualOwnIban(id);
          router.refresh();
        });
      }}
      className="min-h-[44px] px-2 text-sm text-red-500 disabled:opacity-50"
    >
      Verwijderen
    </button>
  );
}
