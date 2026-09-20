"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerGoalSpend } from "@/actions/pots";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export interface GoalSpendItem {
  id: string;
  potName: string;
  amount: number;
  date: string;
  note: string | null;
}

// A withdrawal from a pot with a goal: was the money spent on that goal
// (e.g. the flights for the holiday)? Yes lowers the goal by the amount.
export function GoalSpendCard({ items }: { items: GoalSpendItem[] }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-lg font-semibold text-gray-900">Was dit voor je doel?</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <Question key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function Question({ item }: { item: GoalSpendItem }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const answer = (value: "yes" | "no", el: HTMLElement) => {
    setError(null);
    const row = el.closest("li");
    row?.classList.add("hidden");
    startTransition(async () => {
      try {
        await answerGoalSpend(item.id, value);
        router.refresh();
      } catch (e) {
        row?.classList.remove("hidden");
        setError(e instanceof Error ? e.message : "Mislukt");
      }
    });
  };

  return (
    <li className="space-y-3 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
      <p className="text-base text-amber-950">
        Er is <span className="font-semibold">{euro(item.amount)}</span> uit{" "}
        <span className="font-medium">{item.potName}</span> gehaald op{" "}
        {new Date(item.date).toLocaleDateString("nl-NL")}
        {item.note ? ` (${item.note})` : ""}. Is dit uitgegeven aan het doel, bijvoorbeeld vliegtickets?
        Dan gaat ook het doelbedrag omlaag.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={(e) => answer("yes", e.currentTarget)}
          className="min-h-[48px] flex-1 rounded-xl bg-gray-900 text-base font-medium text-white active:bg-gray-700 disabled:opacity-50"
        >
          Ja, uitgegeven
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={(e) => answer("no", e.currentTarget)}
          className="min-h-[48px] flex-1 rounded-xl border border-gray-300 bg-white text-base text-gray-900 active:bg-gray-50 disabled:opacity-50"
        >
          Nee
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </li>
  );
}
