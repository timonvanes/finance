"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPot } from "@/actions/pots";

const input = "min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-4 text-base";
const label = "mb-1 block text-sm text-gray-500";

export function NewPotForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          try {
            await createPot(formData);
            router.push("/pots");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Aanmaken mislukt");
          }
        });
      }}
      className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200"
    >
      <div>
        <label className={label}>Naam</label>
        <input type="text" name="name" required placeholder="bv. Vakantie Italië" className={input} />
      </div>
      <div>
        <label className={label}>Soort</label>
        <select name="kind" defaultValue="savings" className={input}>
          <option value="savings">Sparen</option>
          <option value="investment">Beleggen</option>
          <option value="vacation">Vakantie</option>
          <option value="other">Overig</option>
        </select>
      </div>
      <div>
        <label className={label}>Bedrag per maand (optioneel)</label>
        <input type="number" name="monthlyAmount" inputMode="decimal" step="1" min="0" placeholder="€" className={input} />
      </div>
      <div>
        <label className={label}>Doelbedrag (optioneel)</label>
        <input type="number" name="targetAmount" inputMode="decimal" step="0.01" min="0" placeholder="€" className={input} />
      </div>
      <div>
        <label className={label}>Doeldatum</label>
        <input type="date" name="targetDate" className={input} />
      </div>
      <div>
        <label className={label}>Staat er al geld in? Startbedrag (optioneel)</label>
        <input type="number" name="openingBalance" inputMode="decimal" step="0.01" min="0" placeholder="€" className={input} />
      </div>
      <div>
        <label className={label}>Startbedrag per datum</label>
        <input type="date" name="openingBalanceDate" className={input} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : "Potje aanmaken"}
      </button>
    </form>
  );
}
