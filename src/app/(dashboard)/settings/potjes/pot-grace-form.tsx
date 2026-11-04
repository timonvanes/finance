"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPotGraceDays } from "@/actions/settings";

export function PotGraceForm({ initialDays }: { initialDays: number }) {
  const [days, setDays] = useState(initialDays);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await setPotGraceDays(days);
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
      }
    });
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div className="space-y-2">
        <label className="block text-sm text-gray-500" htmlFor="pot-grace">
          Speling rond de stortingsdag
        </label>
        <select
          id="pot-grace"
          value={days}
          onChange={(e) => {
            setDays(Number(e.target.value));
            setSaved(false);
          }}
          className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-4 text-lg"
        >
          {Array.from({ length: 15 }, (_, i) => i).map((d) => (
            <option key={d} value={d}>
              {d === 0 ? "Geen speling" : `${d} ${d === 1 ? "dag" : "dagen"} eerder of later`}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        disabled={isPending || saved}
        onClick={save}
        className="min-h-[52px] w-full rounded-xl bg-teal-700 text-lg font-medium text-white active:bg-teal-800 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : saved ? "Opgeslagen" : "Opslaan"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
