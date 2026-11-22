"use client";

import { PlanToggle } from "../pots/plan-toggle";
import { euro } from "./ui";
import { usePlan } from "./plan-provider";

// Which pots count for the plan. A holiday pot should not count towards the house.
export function PotPicker() {
  const { app } = usePlan();
  if (app.pots.length === 0) {
    return <p className="text-sm text-gray-500">Je hebt nog geen potjes. Maak er een aan bij Potjes, bijvoorbeeld &quot;Huis&quot;.</p>;
  }
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-gray-100 rounded-xl bg-gray-50 px-3">
        {app.pots.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-500">
                {p.kind === "investment" ? "Beleggen" : "Sparen"} · {euro(p.balance)}
                {p.monthly > 0 ? ` · ${euro(p.monthly)} per maand` : ""}
              </p>
            </div>
            <PlanToggle potId={p.id} initial={p.included} compact />
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">Alleen potjes die aan staan tellen mee voor het plan: hun saldo en hun maandbedrag.</p>
    </div>
  );
}
