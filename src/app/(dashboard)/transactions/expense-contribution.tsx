"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addContribution, deleteContribution } from "@/actions/contributions";

interface Contribution {
  id: string;
  amount: number;
  label: string | null;
  source_transaction: { booking_date: string; counterparty_name: string | null } | null;
}

interface IncomeSource {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
}

// For expenses partly (or fully) funded by other money — huurtoeslag
// bundled into a rent payment, or someone transferring money upfront so
// you could make the purchase on their behalf. Reduces what counts as your
// own spend for this transaction without touching the real bank amount.
export function ExpenseContribution({
  transactionId,
  expenseAmount,
  contributions,
  incomeSources,
}: {
  transactionId: string;
  expenseAmount: number;
  contributions: Contribution[];
  incomeSources: IncomeSource[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Picking a source fills in the amount (never more than this payment) and a
  // label; opening the form pre-selects a source with exactly the same amount.
  function pickSource(id: string) {
    setSourceId(id);
    const source = incomeSources.find((s) => s.id === id);
    if (!source) return;
    setAmount(Math.min(source.amount, expenseAmount).toFixed(2));
    if (!label) setLabel(source.counterparty_name ?? "");
  }

  function openForm() {
    setShowForm(true);
    const exact = incomeSources.find((s) => Math.abs(s.amount - expenseAmount) < 0.01);
    if (exact && !sourceId) pickSource(exact.id);
  }

  function save() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    startTransition(async () => {
      await addContribution(transactionId, sourceId || null, value, label || null);
      setShowForm(false);
      setSourceId("");
      setAmount("");
      setLabel("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-1 text-xs">
      {contributions.length > 0 && (
        <ul className="space-y-1">
          {contributions.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-gray-500">
              <span>
                −€{c.amount.toFixed(2)}
                {c.label && ` · ${c.label}`}
                {c.source_transaction?.counterparty_name && ` (${c.source_transaction.counterparty_name})`}
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await deleteContribution(c.id);
                    router.refresh();
                  });
                }}
                className="text-red-400 underline hover:text-red-600 disabled:opacity-50"
              >
                x
              </button>
            </li>
          ))}
        </ul>
      )}
      {!showForm ? (
        <button
          type="button"
          onClick={openForm}
          className="text-gray-400 underline hover:text-gray-600"
        >
          + Bijdrage (bv. huurtoeslag, voorschot van iemand)
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sourceId}
            disabled={isPending}
            onChange={(e) => pickSource(e.target.value)}
            className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base disabled:opacity-50"
          >
            <option value="">Geen gekoppelde transactie</option>
            {incomeSources.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.booking_date).toLocaleDateString("nl-NL")} ·{" "}
                {s.counterparty_name ?? "Onbekend"} · €{s.amount.toFixed(2)}
              </option>
            ))}
          </select>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            disabled={isPending}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Bedrag"
            className="min-h-[48px] w-28 rounded-xl border border-gray-300 px-3 text-base disabled:opacity-50"
          />
          <input
            type="text"
            value={label}
            disabled={isPending}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (bv. Huurtoeslag)"
            className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-base disabled:opacity-50"
          />
          <button
            type="button"
            disabled={isPending || !amount}
            onClick={save}
            className="min-h-[48px] rounded-xl bg-gray-900 px-5 text-base font-medium text-white disabled:opacity-50"
          >
            Opslaan
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="min-h-[48px] px-3 text-base text-gray-500 underline">
            Annuleren
          </button>
        </div>
      )}
    </div>
  );
}
