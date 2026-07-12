"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBankConnection } from "@/actions/bank-connections";

export function DeleteConnectionButton({ bankConnectionId }: { bankConnectionId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Deze bankkoppeling verwijderen? Bijbehorende transacties verdwijnen ook.")) return;
        startTransition(async () => {
          await deleteBankConnection(bankConnectionId);
          router.refresh();
        });
      }}
      className="text-xs text-red-400 underline hover:text-red-600 disabled:opacity-50"
    >
      Verwijderen
    </button>
  );
}
