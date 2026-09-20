"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPotEntry } from "@/actions/pots";
import { InfoButton } from "../info-button";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

// What's left of this period after spending and planned saving, with a quick
// way to set it aside in a pot (the real transfer still happens at your bank).
export function LeftoverCard({
  suggested,
  pots,
  periodLabel,
}: {
  suggested: number;
  pots: { id: string; name: string }[];
  periodLabel: string;
}) {
  const [amount, setAmount] = useState(String(Math.floor(suggested)));
  const [potId, setPotId] = useState(pots[0]?.id ?? "");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (done) {
    return (
      <div className="rounded-2xl bg-teal-50 p-5 text-base text-teal-900 ring-1 ring-teal-100">
        Genoteerd. Vergeet niet de overboeking bij je bank te doen.
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Over in deze periode ({periodLabel})</p>
          <p className="text-3xl font-semibold text-gray-900">{euro(suggested)}</p>
        </div>
        <InfoButton>
          <p>
            Dit is wat er in de lopende periode is binnengekomen min wat je uitgaf en min je
            gepland sparen. Zet je het apart in een potje, dan wordt het opgeteld bij dat potje.
            De echte overboeking doe je zelf bij je bank.
          </p>
        </InfoButton>
      </div>
      <div className="flex gap-2">
        <label className="flex h-[52px] w-32 shrink-0 items-center gap-1 rounded-xl border border-gray-300 px-3">
          <span className="text-gray-400">€</span>
          <input
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-full w-full min-w-0 bg-transparent text-lg outline-none"
          />
        </label>
        <select
          value={potId}
          onChange={(e) => setPotId(e.target.value)}
          className="min-h-[52px] min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-base"
        >
          {pots.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={isPending || !potId || !(Number(amount) > 0)}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await addPotEntry(potId, Number(amount), "deposit", "Restant van de periode");
              setDone(true);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Mislukt");
            }
          });
        }}
        className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : "Zet apart in potje"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
