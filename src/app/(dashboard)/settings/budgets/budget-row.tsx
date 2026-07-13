"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBudget } from "@/actions/budgets";

export function BudgetRow({
  categoryId,
  categoryName,
  monthlyLimit,
}: {
  categoryId: string;
  categoryName: string;
  monthlyLimit: number | null;
}) {
  const [value, setValue] = useState(monthlyLimit != null ? String(monthlyLimit) : "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save(limit: number | null) {
    startTransition(async () => {
      await setBudget(categoryId, limit);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 items-center justify-between gap-3">
      <span className="text-sm text-gray-900">{categoryName}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">€</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          disabled={isPending}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Geen budget"
          className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
        />
        <span className="text-xs text-gray-400">/maand</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => save(value ? Number(value) : null)}
          className="text-xs font-medium text-gray-900 underline disabled:opacity-50"
        >
          Opslaan
        </button>
        {monthlyLimit != null && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setValue("");
              save(null);
            }}
            className="text-xs text-red-400 underline hover:text-red-600 disabled:opacity-50"
          >
            Verwijderen
          </button>
        )}
      </div>
    </div>
  );
}
