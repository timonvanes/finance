"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInvestReminderDay } from "@/actions/settings";

export function InvestReminderForm({ initialDay }: { initialDay: number | null }) {
  const [enabled, setEnabled] = useState(initialDay != null);
  const [day, setDay] = useState(initialDay ?? 1);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save(nextEnabled: boolean, nextDay: number) {
    setError(null);
    startTransition(async () => {
      try {
        await setInvestReminderDay(nextEnabled ? nextDay : null);
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
      }
    });
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <label className="flex min-h-[44px] items-center justify-between gap-3">
        <span className="text-base text-gray-900">Herinnering aan</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setSaved(false);
          }}
          className="h-6 w-6 accent-teal-700"
        />
      </label>

      {enabled && (
        <div className="space-y-2">
          <label className="block text-sm text-gray-500" htmlFor="invest-day">
            Elke maand op dag
          </label>
          <select
            id="invest-day"
            value={day}
            onChange={(e) => {
              setDay(Number(e.target.value));
              setSaved(false);
            }}
            className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-4 text-lg"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        disabled={isPending || saved}
        onClick={() => save(enabled, day)}
        className="min-h-[52px] w-full rounded-xl bg-teal-700 text-lg font-medium text-white active:bg-teal-800 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : saved ? "Opgeslagen" : "Opslaan"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
