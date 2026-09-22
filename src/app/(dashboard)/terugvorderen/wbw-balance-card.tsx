"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveWbwBalance } from "@/actions/wbw";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export interface WbwStatus {
  periodLabel: string;
  hasCurrent: boolean;
  currentBalance: number | null;
  previousBalance: number | null;
  frontedThisPeriod: number;
  expected: number | null;
}

// Once a period: what does WieBetaaltWat (net over all groups) say you stand
// at? The gap with what's expected (last balance + what you fronted this
// period) becomes what housemates fronted for you.
export function WbwBalanceCard({ status }: { status: WbwStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(!status.hasCurrent);
  const [value, setValue] = useState(status.currentBalance != null ? String(status.currentBalance) : "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    const n = Number(value.replace(",", "."));
    if (!Number.isFinite(n)) {
      setError("Vul een geldig bedrag in.");
      return;
    }
    startTransition(async () => {
      try {
        await saveWbwBalance(n);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl bg-white px-5 py-3 text-left ring-1 ring-gray-200 active:bg-gray-50"
      >
        <span className="min-w-0">
          <span className="block text-base text-gray-900">WieBetaaltWat, {status.periodLabel}</span>
          <span className="block text-sm text-gray-500">ingevuld · wijzig</span>
        </span>
        <span className="shrink-0 text-lg font-semibold text-gray-900">{euro(status.currentBalance ?? 0)}</span>
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div>
        <p className="text-base font-medium text-gray-900">WieBetaaltWat, {status.periodLabel}</p>
        <p className="text-sm text-gray-500">Wat staat er netto (al je groepen samen)? Positief = jij krijgt nog.</p>
      </div>
      {status.expected != null && (
        <p className="text-sm text-gray-500">
          Verwacht: {euro(status.expected)} ({euro(status.previousBalance ?? 0)} vorige keer, {euro(status.frontedThisPeriod)}{" "}
          voorgeschoten deze periode)
        </p>
      )}
      <label className="flex h-[52px] items-center gap-1 rounded-xl border border-gray-300 bg-white px-3">
        <span className="text-gray-400">€</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Bijv. -25 als je 25 euro moet"
          className="h-full w-full min-w-0 bg-transparent text-lg outline-none"
        />
      </label>
      <button
        type="button"
        disabled={isPending || !value}
        onClick={save}
        className="min-h-[48px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
      >
        Opslaan
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
