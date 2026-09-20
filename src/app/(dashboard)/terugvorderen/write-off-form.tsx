"use client";

import { useState } from "react";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export function WriteOffForm({
  max,
  disabled,
  onConfirm,
}: {
  max: number;
  disabled?: boolean;
  onConfirm: (amount: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="min-h-[44px] rounded-xl border border-gray-300 px-4 text-sm text-gray-700 disabled:opacity-50"
      >
        Niet inbaar
      </button>
    );
  }

  const value = Number(amount.replace(",", "."));
  const valid = value > 0;

  return (
    <div className="w-full space-y-2 rounded-xl bg-gray-50 p-4">
      <p className="text-sm text-gray-600">Welk deel is niet inbaar? Dat deel wordt dan een eigen kost.</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (confirm(`Het hele bedrag (${euro(max)}) als niet inbaar aanmerken?`)) onConfirm(max);
        }}
        className="min-h-[48px] w-full rounded-xl bg-gray-900 text-base font-medium text-white active:bg-gray-700 disabled:opacity-50"
      >
        Hele bedrag ({euro(max)})
      </button>
      <div className="flex gap-2">
        <label className="flex h-[48px] min-w-0 flex-1 items-center gap-1 rounded-xl border border-gray-300 bg-white px-3">
          <span className="text-gray-400">€</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Een deel"
            className="h-full w-full min-w-0 bg-transparent text-lg outline-none"
          />
        </label>
        <button
          type="button"
          disabled={disabled || !valid}
          onClick={() => onConfirm(Math.min(value, max))}
          className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-4 text-base font-medium text-gray-900 active:bg-gray-50 disabled:opacity-50"
        >
          Alleen dit deel
        </button>
      </div>
      <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] text-sm text-gray-500 underline">
        Annuleren
      </button>
    </div>
  );
}
