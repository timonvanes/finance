"use client";

import { createContext, useContext, useDeferredValue, useMemo, useState, useTransition, type ReactNode } from "react";
import { savePlan } from "@/actions/plan";
import type { HouseInputs } from "@/lib/house/calc";
import { FIELD_BY_ID } from "@/lib/plan/fields";
import { computePlan, type PlanResult } from "@/lib/plan/model";
import type { AppData, Extra } from "@/lib/plan/types";

interface Ctx {
  b: HouseInputs;
  x: Extra;
  app: AppData;
  result: PlanResult;
  calculating: boolean;
  setField: (id: string, v: number | string | boolean) => void;
  patchX: (fn: (x: Extra) => Extra) => void;
  patchB: (fn: (b: HouseInputs) => HouseInputs) => void;
  dirty: boolean;
  saving: boolean;
  message: string | null;
  save: () => void;
  hasExtra: boolean;
}

const PlanContext = createContext<Ctx | null>(null);

export function usePlan() {
  const c = useContext(PlanContext);
  if (!c) throw new Error("usePlan buiten PlanProvider");
  return c;
}

export function PlanProvider({
  initialB,
  initialX,
  app,
  hasExtra,
  children,
}: {
  initialB: HouseInputs;
  initialX: Extra;
  app: AppData;
  hasExtra: boolean;
  children: ReactNode;
}) {
  const [b, setB] = useState(initialB);
  const [x, setX] = useState(initialX);
  const [savedJson, setSavedJson] = useState(() => (hasExtra ? JSON.stringify({ b: initialB, x: initialX }) : ""));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const db = useDeferredValue(b);
  const dx = useDeferredValue(x);
  const result = useMemo(() => computePlan({ b: db, x: dx, app }), [db, dx, app]);
  const calculating = db !== b || dx !== x;

  const json = JSON.stringify({ b, x });
  const dirty = json !== savedJson;

  const setField = (id: string, v: number | string | boolean) => {
    const f = FIELD_BY_ID.get(id);
    if (!f) return;
    const [nb, nx] = f.set(b, x, v);
    setB(nb);
    setX(nx);
    setMessage(null);
  };
  const patchX = (fn: (x: Extra) => Extra) => {
    setX((prev) => fn(prev));
    setMessage(null);
  };
  const patchB = (fn: (b: HouseInputs) => HouseInputs) => {
    setB((prev) => fn(prev));
    setMessage(null);
  };

  const save = () => {
    startSaving(async () => {
      const r = await savePlan(b, x);
      if (r.error) setMessage(r.error);
      else {
        setSavedJson(json);
        setMessage("Opgeslagen.");
      }
    });
  };

  return (
    <PlanContext.Provider
      value={{ b, x, app, result, calculating, setField, patchX, patchB, dirty, saving, message, save, hasExtra }}
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
