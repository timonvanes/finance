"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMonthStartDay } from "@/actions/settings";

const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function MonthStartForm({ initialDay }: { initialDay: number }) {
  const [day, setDay] = useState(initialDay);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const now = new Date();
  const month = MONTHS[now.getMonth()];
  const nextMonth = MONTHS[(now.getMonth() + 1) % 12];
  const endDay = day === 1 ? 31 : day - 1;
  const example =
    day === 1
      ? `1 ${month} – einde van de maand`
      : `${day} ${month} – ${endDay} ${nextMonth}`;

  return (
    <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <label className="block text-sm text-gray-500" htmlFor="start-day">
        Mijn maand begint op dag
      </label>
      <select
        id="start-day"
        value={day}
        onChange={(e) => {
          setDay(Number(e.target.value));
          setSaved(false);
        }}
        className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-4 text-lg"
      >
        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d === 1 ? "1 (gewone kalendermaand)" : d}
          </option>
        ))}
      </select>
      <p className="text-sm text-gray-500">Zo loopt een periode bijvoorbeeld: {example}</p>

      <button
        type="button"
        disabled={isPending || saved}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setMonthStartDay(day);
              setSaved(true);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Opslaan mislukt");
            }
          });
        }}
        className="min-h-[52px] w-full rounded-xl bg-teal-700 text-lg font-medium text-white active:bg-teal-800 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : saved ? "Opgeslagen" : "Opslaan"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
