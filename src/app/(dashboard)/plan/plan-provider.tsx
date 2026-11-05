"use client";

import { createContext, useContext, useDeferredValue, useMemo, useState, useTransition, type ReactNode } from "react";
import { savePlan } from "@/actions/plan";
import type { HouseInputs } from "@/lib/house/calc";
import { FIELD_BY_ID } from "@/lib/plan/fields";
import { computePlan, type PlanResult } from "@/lib/plan/model";
import { diffHistory, resolve, snapshotOf, writeField, writeSalary } from "@/lib/plan/scenarios";
import type { AppData, AssumptionMeta, Extra, PlanDoc, Scenario, Variant } from "@/lib/plan/types";

interface Ctx {
  doc: PlanDoc;
  scenario: Scenario;
  variant: Variant;
  // The inputs of the active scenario with the active variant on top.
  b: HouseInputs;
  x: Extra;
  app: AppData;
  result: PlanResult;
  calculating: boolean;
  today: string;
  setField: (id: string, v: number | string | boolean) => void;
  setSalary: (who: "salaryYou" | "salaryPartner", year: number, n: number) => void;
  clearSalaries: () => void;
  patchX: (fn: (x: Extra) => Extra) => void;
  patchB: (fn: (b: HouseInputs) => HouseInputs) => void;
  setVariant: (v: Variant) => void;
  setActive: (id: string) => void;
  copyScenario: (name: string) => void;
  renameScenario: (name: string) => void;
  deleteScenario: () => void;
  setMeta: (fieldId: string, patch: Partial<AssumptionMeta>) => void;
  markChecked: (fieldId: string, nextCheck: string) => void;
  dirty: boolean;
  saving: boolean;
  message: string | null;
  save: () => void;
  hasDoc: boolean;
}

const PlanContext = createContext<Ctx | null>(null);

export function usePlan() {
  const c = useContext(PlanContext);
  if (!c) throw new Error("usePlan buiten PlanProvider");
  return c;
}

export function PlanProvider({
  initialDoc,
  app,
  hasDoc,
  children,
}: {
  initialDoc: PlanDoc;
  app: AppData;
  hasDoc: boolean;
  children: ReactNode;
}) {
  const [doc, setDoc] = useState(initialDoc);
  const [savedJson, setSavedJson] = useState(() => (hasDoc ? JSON.stringify(initialDoc) : ""));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const today = app.today;

  const scenario = doc.scenarios.find((s) => s.id === doc.activeId) ?? doc.scenarios[0];
  const variant = doc.variant;
  const resolved = useMemo(() => resolve(scenario, variant), [scenario, variant]);
  const deferred = useDeferredValue(resolved);
  const result = useMemo(() => computePlan({ b: deferred.b, x: deferred.x, app }), [deferred, app]);
  const calculating = deferred !== resolved;

  const json = JSON.stringify(doc);
  const dirty = json !== savedJson;

  const update = (fn: (d: PlanDoc) => PlanDoc) => {
    setDoc((d) => fn(d));
    setMessage(null);
  };
  const updateScenario = (fn: (s: Scenario) => Scenario) =>
    update((d) => ({ ...d, scenarios: d.scenarios.map((s) => (s.id === d.activeId ? fn(s) : s)) }));

  const setField = (id: string, v: number | string | boolean) => updateScenario((s) => writeField(s, variant, id, v));
  const setSalary = (who: "salaryYou" | "salaryPartner", year: number, n: number) =>
    updateScenario((s) => writeSalary(s, variant, who, year, n));
  const clearSalaries = () =>
    updateScenario((s) =>
      variant === "basis"
        ? { ...s, x: { ...s.x, salaryYou: {}, salaryPartner: {} } }
        : { ...s, variants: { ...s.variants, [variant]: { ...s.variants[variant], salaryYou: {}, salaryPartner: {} } } }
    );
  const patchX = (fn: (x: Extra) => Extra) => updateScenario((s) => ({ ...s, x: fn(s.x) }));
  const patchB = (fn: (b: HouseInputs) => HouseInputs) => updateScenario((s) => ({ ...s, b: fn(s.b) }));

  const setVariant = (v: Variant) => update((d) => ({ ...d, variant: v }));
  const setActive = (id: string) => update((d) => ({ ...d, activeId: id }));
  const copyScenario = (name: string) =>
    update((d) => {
      const from = d.scenarios.find((s) => s.id === d.activeId) ?? d.scenarios[0];
      const copy: Scenario = JSON.parse(JSON.stringify(from));
      copy.id = `s${Date.now().toString(36)}`;
      copy.name = name.trim() || `${from.name} (kopie)`;
      return { ...d, scenarios: [...d.scenarios, copy], activeId: copy.id };
    });
  const renameScenario = (name: string) => updateScenario((s) => ({ ...s, name }));
  const deleteScenario = () =>
    update((d) => {
      if (d.scenarios.length <= 1) return d;
      const rest = d.scenarios.filter((s) => s.id !== d.activeId);
      return { ...d, scenarios: rest, activeId: rest[0].id };
    });

  const setMeta = (fieldId: string, patch: Partial<AssumptionMeta>) =>
    update((d) => {
      const cur = d.meta[fieldId] ?? { source: "Eigen aanname", checkedOn: today, nextCheck: today };
      return { ...d, meta: { ...d.meta, [fieldId]: { ...cur, ...patch } } };
    });
  const markChecked = (fieldId: string, nextCheck: string) => setMeta(fieldId, { checkedOn: today, nextCheck });

  const save = () => {
    // Keep what changed since the last save, and how the active variant looks now.
    let next = doc;
    if (savedJson) {
      try {
        const prev = JSON.parse(savedJson) as PlanDoc;
        const entries = next.scenarios.flatMap((s) => {
          const before = prev.scenarios.find((q) => q.id === s.id);
          return before ? diffHistory(before, s, today) : [];
        });
        if (entries.length > 0) next = { ...next, history: [...next.history, ...entries].slice(-600) };
      } catch {
        // an unreadable earlier version: no history this time
      }
    }
    next = { ...next, snapshots: [...next.snapshots, snapshotOf(today, next.activeId, variant, result)].slice(-80) };
    startSaving(async () => {
      const r = await savePlan(next);
      if (r.error) setMessage(r.error);
      else {
        setDoc(next);
        setSavedJson(JSON.stringify(next));
        setMessage("Opgeslagen.");
      }
    });
  };

  return (
    <PlanContext.Provider
      value={{
        doc,
        scenario,
        variant,
        b: resolved.b,
        x: resolved.x,
        app,
        result,
        calculating,
        today,
        setField,
        setSalary,
        clearSalaries,
        patchX,
        patchB,
        setVariant,
        setActive,
        copyScenario,
        renameScenario,
        deleteScenario,
        setMeta,
        markChecked,
        dirty,
        saving,
        message,
        save,
        hasDoc,
      }}
    >
      {children}
      {(dirty || (message && message !== "Opgeslagen.")) && (
        <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-4xl justify-center px-4 print:hidden">
          <div className="flex items-center gap-3 rounded-full bg-gray-900 py-2 pl-5 pr-2 text-sm text-white shadow-lg">
            <span>{saving ? "Opslaan…" : dirty ? "Niet opgeslagen" : message}</span>
            {dirty && (
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="min-h-[44px] rounded-full bg-teal-600 px-5 font-medium text-white active:bg-teal-700 disabled:opacity-50"
              >
                Opslaan
              </button>
            )}
          </div>
        </div>
      )}
    </PlanContext.Provider>
  );
}

// Used where a field is shown next to its value in other variants.
export function fieldValue(sc: Scenario, variant: Variant, id: string) {
  const f = FIELD_BY_ID.get(id);
  if (!f) return undefined;
  const { b, x } = resolve(sc, variant);
  return f.get(b, x);
}
