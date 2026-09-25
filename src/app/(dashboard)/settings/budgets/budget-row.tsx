"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBudget, type BudgetPeriod } from "@/actions/budgets";

export function BudgetRow({
  categoryId,
  categoryName,
  monthlyLimit,
  period: savedPeriod,
}: {
  categoryId: string;
  categoryName: string;
  monthlyLimit: number | null;
  period: BudgetPeriod;
}) {
  const saved = monthlyLimit != null ? String(monthlyLimit) : "";
  const [value, setValue] = useState(saved);
  const [period, setPeriod] = useState<BudgetPeriod>(savedPeriod);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const changed = value.trim() !== saved || period !== savedPeriod;

  function save(limit: number | null) {
    startTransition(async () => {
      await setBudget(categoryId, limit, period);
      router.refresh();
    });
  }

  return (
    <div className="w-full space-y-2 px-5 py-4">
      <p className="text-lg font-medium text-gray-900">{categoryName}</p>
      <div className="flex items-center gap-2">
        <label className="flex h-[52px] min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 focus-within:border-teal-600">
          <span className="text-gray-400">€</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={value}
            disabled={isPending}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Geen budget"
            aria-label={`Budget voor ${categoryName}`}
            className="h-full min-w-0 flex-1 bg-transparent text-lg text-gray-900 outline-none disabled:opacity-50"
          />
        </label>
        <select
          value={period}
          disabled={isPending}
          onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
          aria-label={`Periode voor ${categoryName}`}
          className="h-[52px] shrink-0 rounded-xl border border-gray-300 bg-white px-2 text-base text-gray-800"
        >
          <option value="month">/ maand</option>
          <option value="quarter">/ kwartaal</option>
          <option value="year">/ jaar</option>
        </select>
        {changed && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => save(value.trim() ? Number(value) : null)}
            className="h-[52px] shrink-0 rounded-xl bg-teal-700 px-5 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Bezig…" : "Opslaan"}
          </button>
        )}
        {!changed && monthlyLimit != null && (
          <button
            type="button"
            disabled={isPending}
            aria-label={`Budget voor ${categoryName} verwijderen`}
            onClick={() => {
              setValue("");
              save(null);
            }}
            className="h-[52px] shrink-0 rounded-xl px-4 text-base text-red-500 active:bg-red-50 disabled:opacity-50"
          >
            Wis
          </button>
        )}
      </div>
    </div>
  );
}
