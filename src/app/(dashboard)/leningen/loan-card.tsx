"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addManualBorrow,
  addManualRepayment,
  closeLoan,
  removeLoanEntry,
  reopenLoan,
} from "@/actions/loans";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export interface LoanView {
  id: string;
  personName: string;
  status: "open" | "closed";
  closedReason: "repaid" | "forgiven" | null;
  borrowed: number;
  repaid: number;
  balance: number;
  entries: {
    id: string;
    kind: "borrow" | "repay";
    amount: number;
    date: string;
    fromTransaction: boolean;
    counterparty: string | null;
  }[];
}

export function LoanCard({ loan }: { loan: LoanView }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [extra, setExtra] = useState("");
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Er ging iets mis");
      }
    });
  }

  const isOpen = loan.status === "open";
  const pct = loan.borrowed > 0 ? Math.min(100, (loan.repaid / loan.borrowed) * 100) : 0;

  return (
    <li className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-medium text-gray-900">Lening van {loan.personName}</p>
          <p className="text-sm text-gray-500">
            {isOpen
              ? "Openstaand"
              : loan.closedReason === "forgiven"
                ? "Hoeft niet meer af te lossen"
                : "Afgelost"}
          </p>
        </div>
        <p className="shrink-0 text-2xl font-semibold text-gray-900">
          {euro(isOpen ? Math.max(loan.balance, 0) : 0)}
        </p>
      </div>

      <div>
        <div className="h-3 rounded-full bg-gray-100">
          <div className="h-3 rounded-full bg-purple-600" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {euro(loan.repaid)} afgelost van {euro(loan.borrowed)}
        </p>
      </div>

      <details className="group">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-sm text-blue-600 [&::-webkit-details-marker]:hidden">
          <span className="inline-block transition-transform group-open:rotate-90">›</span>
          Geschiedenis ({loan.entries.length})
        </summary>
        <ul className="divide-y divide-gray-100 rounded-xl bg-gray-50 px-4">
          {loan.entries.map((e) => (
            <li key={e.id} className="flex min-h-[52px] items-center justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="block text-gray-900">
                  {e.kind === "borrow" ? "Geleend" : "Afgelost"}
                  {e.counterparty && ` · ${e.counterparty}`}
                </span>
                <span className="block text-gray-500">
                  {new Date(e.date).toLocaleDateString("nl-NL")}
                  {!e.fromTransaction && " · handmatig"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className={e.kind === "borrow" ? "font-medium text-gray-900" : "font-medium text-green-700"}>
                  {e.kind === "borrow" ? "+" : "−"}
                  {euro(e.amount)}
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    if (!confirm("Deze regel uit de lening halen?")) return;
                    run(() => removeLoanEntry(e.id));
                  }}
                  className="min-h-[44px] text-gray-400 underline disabled:opacity-50"
                >
                  Verwijder
                </button>
              </span>
            </li>
          ))}
        </ul>
      </details>

      {isOpen ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contant afgelost: bedrag"
              className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-base"
            />
            <button
              type="button"
              disabled={isPending || !amount}
              onClick={() => {
                const value = Number(amount);
                run(async () => {
                  await addManualRepayment(loan.id, value);
                  setAmount("");
                });
              }}
              className="min-h-[48px] rounded-xl border border-gray-300 px-4 text-base font-medium text-gray-900 active:bg-gray-50 disabled:opacity-50"
            >
              Afgelost
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Erbij geleend: bedrag"
              className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-base"
            />
            <button
              type="button"
              disabled={isPending || !extra}
              onClick={() => {
                const value = Number(extra);
                run(async () => {
                  await addManualBorrow(loan.id, value);
                  setExtra("");
                });
              }}
              className="min-h-[48px] rounded-xl border border-gray-300 px-4 text-base font-medium text-gray-900 active:bg-gray-50 disabled:opacity-50"
            >
              Erbij
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => closeLoan(loan.id, "repaid"))}
              className="min-h-[48px] flex-1 rounded-xl bg-gray-900 px-4 text-base font-medium text-white active:bg-gray-700 disabled:opacity-50"
            >
              Volledig afgelost
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (!confirm("Deze lening hoeft niet meer afgelost te worden?")) return;
                run(() => closeLoan(loan.id, "forgiven"));
              }}
              className="min-h-[48px] flex-1 rounded-xl border border-gray-300 px-4 text-base text-gray-900 active:bg-gray-50 disabled:opacity-50"
            >
              Hoeft niet meer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => reopenLoan(loan.id))}
          className="min-h-[48px] w-full rounded-xl border border-gray-300 text-base text-gray-900 active:bg-gray-50 disabled:opacity-50"
        >
          Weer openen
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </li>
  );
}
