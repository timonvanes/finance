"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidePotPeriod } from "@/actions/pots";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export interface CatchUpItem {
  potId: string;
  potName: string;
  periodStart: string;
  monthName: string;
  missing: number;
}

// A period ended without the full planned deposit: carry the rest over to the
// next period, or let it go.
export function CatchUpCard({ items }: { items: CatchUpItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(item: CatchUpItem, decision: "carry" | "skip") {
    setError(null);
    startTransition(async () => {
      try {
        await decidePotPeriod(item.potId, item.periodStart, decision);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Er ging iets mis");
      }
    });
  }

  return (
    <section className="space-y-3 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-100">
      <p className="text-base font-medium text-amber-900">Je loopt achter op je plan</p>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={`${item.potId}-${item.periodStart}`} className="space-y-2">
            <p className="text-base text-gray-900">
              {item.potName}: in {item.monthName} is {euro(item.missing)} niet ingelegd.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => decide(item, "carry")}
                className="min-h-[48px] flex-1 rounded-xl bg-gray-900 text-base font-medium text-white active:bg-gray-700 disabled:opacity-50"
              >
                Meenemen
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => decide(item, "skip")}
                className="min-h-[48px] flex-1 rounded-xl border border-gray-300 bg-white text-base font-medium text-gray-900 active:bg-gray-50 disabled:opacity-50"
              >
                Overslaan
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
