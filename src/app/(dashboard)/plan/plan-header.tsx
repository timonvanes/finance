"use client";

import { usePlan } from "./plan-provider";
import { VARIANTS } from "@/lib/plan/types";

// Which scenario you are working in (for example buying alone or together) and
// which variant of it you look at: stress, basis or favourable.
export function PlanHeader() {
  const { doc, scenario, variant, setActive, setVariant, copyScenario, renameScenario, deleteScenario, calculating } = usePlan();

  return (
    <div className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-gray-200 print:hidden">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {doc.scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(s.id)}
            className={
              s.id === scenario.id
                ? "min-h-[40px] shrink-0 rounded-full bg-gray-900 px-4 text-sm font-medium text-white"
                : "min-h-[40px] shrink-0 rounded-full bg-gray-100 px-4 text-sm text-gray-700 active:bg-gray-200"
            }
          >
            {s.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const name = window.prompt("Naam van het nieuwe scenario (een kopie van dit scenario)", `${scenario.name} (kopie)`);
            if (name !== null) copyScenario(name);
          }}
          className="min-h-[40px] shrink-0 rounded-full border border-dashed border-gray-300 px-4 text-sm text-gray-600 active:bg-gray-50"
        >
          + Kopie
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {VARIANTS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setVariant(v.key)}
            className={
              v.key === variant
                ? "min-h-[40px] rounded-lg bg-white text-sm font-medium text-teal-800 shadow-sm"
                : "min-h-[40px] rounded-lg text-sm text-gray-600 active:bg-gray-200"
            }
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="px-1 text-xs text-gray-500">
        {VARIANTS.find((v) => v.key === variant)?.hint}. {scenario.description}
        {calculating && " · rekent…"}
      </p>
      <div className="flex gap-4 px-1 text-xs">
        <button
          type="button"
          onClick={() => {
            const name = window.prompt("Nieuwe naam", scenario.name);
            if (name && name.trim()) renameScenario(name.trim());
          }}
          className="min-h-[32px] text-gray-500 underline"
        >
          Hernoemen
        </button>
        {doc.scenarios.length > 1 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Scenario "${scenario.name}" verwijderen?`)) deleteScenario();
            }}
            className="min-h-[32px] text-red-600 underline"
          >
            Verwijderen
          </button>
        )}
      </div>
    </div>
  );
}
