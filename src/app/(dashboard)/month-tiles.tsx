"use client";

import { useState, type ReactNode } from "react";

// The two tiles of the month: tap one to open what it is made of, underneath.
export function MonthTiles({
  income,
  expense,
  expenseNote,
  expenseNoteBad,
  incomePanel,
  expensePanel,
}: {
  income: string;
  expense: string;
  expenseNote: string | null;
  expenseNoteBad: boolean;
  incomePanel: ReactNode;
  expensePanel: ReactNode;
}) {
  const [open, setOpen] = useState<"income" | "expense" | null>(null);
  const tile = (active: boolean) =>
    `w-full rounded-2xl bg-white p-4 text-left ring-1 active:bg-gray-50 ${active ? "ring-2 ring-teal-600" : "ring-gray-200"}`;
  const chevron = (active: boolean) => (
    <span className={`text-2xl text-gray-300 transition-transform ${active ? "rotate-90" : ""}`}>›</span>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          aria-expanded={open === "income"}
          onClick={() => setOpen(open === "income" ? null : "income")}
          className={tile(open === "income")}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-2xl font-semibold text-green-700">{income}</p>
            {chevron(open === "income")}
          </div>
          <p className="text-sm text-gray-500">binnengekomen</p>
        </button>
        <button
          type="button"
          aria-expanded={open === "expense"}
          onClick={() => setOpen(open === "expense" ? null : "expense")}
          className={tile(open === "expense")}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-2xl font-semibold text-gray-900">{expense}</p>
            {chevron(open === "expense")}
          </div>
          <p className="text-sm text-gray-500">uitgegeven</p>
          {expenseNote && <p className={`text-sm ${expenseNoteBad ? "text-red-600" : "text-green-700"}`}>{expenseNote}</p>}
        </button>
      </div>
      {open === "income" && incomePanel}
      {open === "expense" && expensePanel}
    </div>
  );
}
