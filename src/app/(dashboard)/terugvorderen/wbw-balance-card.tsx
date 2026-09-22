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
  const [sign, setSign] = useState<1 | -1>(status.currentBalance != null && status.currentBalance < 0 ? -1 : 1);
  const [amount, setAmount] = useState(status.currentBalance != null ? String(Math.abs(status.currentBalance)) : "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    const n = Number(amount.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      setError("Vul een geldig bedrag in.");
      return;
    }
    startTransition(async () => {
      try {
        await saveWbwBalance(sign * n);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
      }
    });
  }

  return (
    <details className="rounded-2xl bg-white ring-1 ring-gray-200">
      <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-3 px-5 [&::-webkit-details-marker]:hidden">
        <span className="text-base font-medium text-gray-900">WieBetaaltWat</span>
        <span className="flex items-center gap-2">
          {status.hasCurrent && (
            <span className="text-base text-gray-600">{euro(status.currentBalance ?? 0)}</span>
          )}
          <span className="text-2xl text-gray-300">›</span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-gray-100 p-5">
        <p className="text-sm text-gray-500">Saldo in WBW voor {status.periodLabel} (al je groepen samen)</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSign(1)}
            className={`min-h-[48px] flex-1 rounded-xl text-base font-medium ring-1 ${
              sign === 1 ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-gray-800 ring-gray-300"
            }`}
          >
            Ik krijg nog
          </button>
          <button
            type="button"
            onClick={() => setSign(-1)}
            className={`min-h-[48px] flex-1 rounded-xl text-base font-medium ring-1 ${
              sign === -1 ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-800 ring-gray-300"
            }`}
          >
            Ik moet nog
          </button>
        </div>
        <label className="flex h-[52px] items-center gap-1 rounded-xl border border-gray-300 bg-white px-3">
          <span className="text-gray-400">€</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="h-full w-full min-w-0 bg-transparent text-lg outline-none"
          />
        </label>
        <button
          type="button"
          disabled={isPending || !amount}
          onClick={save}
          className="min-h-[48px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
        >
          Opslaan
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </details>
  );
}
