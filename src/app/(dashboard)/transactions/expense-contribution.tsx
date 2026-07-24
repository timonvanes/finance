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
  contributions,
  incomeSources,
}: {
  transactionId: string;
  contributions: Contribution[];
  incomeSources: IncomeSource[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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
          onClick={() => setShowForm(true)}
          className="text-gray-400 underline hover:text-gray-600"
        >
          + Bijdrage (bv. huurtoeslag, voorschot van iemand)
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sourceId}
            disabled={isPending}
            onChange={(e) => setSourceId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 disabled:opacity-50"
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
            className="w-20 rounded-md border border-gray-300 px-2 py-1 disabled:opacity-50"
          />
          <input
            type="text"
            value={label}
            disabled={isPending}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (bv. Huurtoeslag)"
            className="w-40 rounded-md border border-gray-300 px-2 py-1 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={isPending || !amount}
            onClick={save}
            className="font-medium text-gray-900 underline disabled:opacity-50"
          >
            Opslaan
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 underline">
            Annuleren
          </button>
        </div>
      )}
    </div>
  );
}
