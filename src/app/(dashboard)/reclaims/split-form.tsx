"use client";

import { useState } from "react";
import { createSplitReclaim } from "@/actions/reclaims";

interface Person {
  id: string;
  name: string;
}

interface TransactionOption {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
}

export function SplitReclaimForm({
  transactions,
  people,
}: {
  transactions: TransactionOption[];
  people: Person[];
}) {
  const [txAmount, setTxAmount] = useState(
    transactions[0] ? Math.abs(transactions[0].amount) : 0
  );
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  function recalcEqualSplit(nextChecked: Record<string, boolean>, amount: number) {
    const ids = Object.keys(nextChecked).filter((id) => nextChecked[id]);
    if (ids.length === 0) return;
    const share = (amount / ids.length).toFixed(2);
    setAmounts((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = share;
      });
      return next;
    });
  }

  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <form
      action={createSplitReclaim}
      className="space-y-3 rounded-md border border-gray-200 bg-white p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Transactie (afschrijving)
        </label>
        <select
          name="transactionId"
          required
          onChange={(e) => {
            const opt = transactions.find((t) => t.id === e.target.value);
            const amount = opt ? Math.abs(opt.amount) : 0;
            setTxAmount(amount);
            recalcEqualSplit(checked, amount);
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {transactions.map((tx) => (
            <option key={tx.id} value={tx.id}>
              {new Date(tx.booking_date).toLocaleDateString("nl-NL")} ·{" "}
              {tx.counterparty_name ?? "Onbekend"} · €{Math.abs(tx.amount).toFixed(2)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Van wie krijg je geld terug? {checkedCount > 1 && "(bedrag wordt gelijk verdeeld, pas zelf aan indien nodig)"}
        </label>
        {people.length === 0 ? (
          <p className="text-xs text-gray-500">
            Nog niemand toegevoegd — voeg eerst iemand toe bij{" "}
            <a href="/settings/people" className="underline">
              Personen
            </a>
            .
          </p>
        ) : (
          <div className="space-y-1 rounded-md border border-gray-200 p-2">
            {people.map((person) => (
              <div key={person.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="personId"
                  value={person.id}
                  checked={!!checked[person.id]}
                  onChange={(e) => {
                    const next = { ...checked, [person.id]: e.target.checked };
                    setChecked(next);
                    recalcEqualSplit(next, txAmount);
                  }}
                />
                <span className="w-32 shrink-0 text-sm text-gray-900">{person.name}</span>
                <input
                  type="number"
                  step="0.01"
                  name={`amount_${person.id}`}
                  disabled={!checked[person.id]}
                  value={amounts[person.id] ?? ""}
                  onChange={(e) =>
                    setAmounts((prev) => ({ ...prev, [person.id]: e.target.value }))
                  }
                  placeholder="€"
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Hoe komt dit terug?
        </label>
        <select
          name="settlementMethod"
          defaultValue="bank"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="bank">Bankoverschrijving / Tikkie (automatisch te herkennen)</option>
          <option value="external_app">
            Andere app (WieBetaaltWat, Splitwise, etc.) — handmatig afvinken
          </option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Betaalverzoek-link of notitie (optioneel)
        </label>
        <input
          type="text"
          name="tikkieLink"
          placeholder="Tikkie-link, of een notitie zoals 'betaalverzoek via ING'"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={people.length === 0}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        Toevoegen
      </button>
    </form>
  );
}
