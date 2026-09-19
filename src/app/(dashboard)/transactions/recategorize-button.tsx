"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recategorizeAll } from "@/actions/transactions";

export function RecategorizeButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function run(includeAuto: boolean) {
    setMessage(null);
    startTransition(async () => {
      try {
        const { updated } = await recategorizeAll(includeAuto);
        setMessage(
          updated === 0 ? "Niks nieuws gevonden." : `${updated} transactie${updated === 1 ? "" : "s"} gecategoriseerd.`
        );
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Categoriseren mislukt");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(false)}
        className="min-h-[48px] rounded-xl bg-teal-700 px-5 text-base font-medium text-white active:bg-teal-800 disabled:opacity-60"
      >
        {isPending ? "Bezig…" : "Automatisch categoriseren"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(true)}
        className="min-h-[44px] text-sm text-gray-500 underline disabled:opacity-60"
      >
        Ook automatisch toegekende opnieuw doen
      </button>
      {message && <p className="w-full text-sm text-gray-600">{message}</p>}
    </div>
  );
}
