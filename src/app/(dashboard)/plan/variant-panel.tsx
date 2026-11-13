"use client";

import { useState } from "react";
import { NumberBox, Note, card } from "./ui";
import { fieldValue, usePlan } from "./plan-provider";
import { DEFAULT_SPREAD, SPREAD_FIELDS, overrideOf } from "@/lib/plan/scenarios";
import { FIELD_BY_ID } from "@/lib/plan/fields";
import { VARIANTS, type Variant } from "@/lib/plan/types";

// The three variants on one place: switch between them, let the percentages fill them in,
// and still change any number by hand.
export function VariantPanel() {
  const { scenario, variant, setVariant, setVariantField, setSpread, fillFromSpread, resetVariant } = usePlan();
  const [open, setOpen] = useState(false);
  const spread = scenario.spread ?? DEFAULT_SPREAD;

  const unitOf = (id: string) => {
    const u = FIELD_BY_ID.get(id)?.unit;
    return u === "%" ? "%" : u === "€" ? "€" : undefined;
  };
  const own = (v: Variant, id: string) => v !== "basis" && id in overrideOf(scenario, v).fields;

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 -mx-4 bg-gray-50/95 px-4 py-2 backdrop-blur">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-200 p-1">
          {VARIANTS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setVariant(v.key)}
              className={v.key === variant ? "min-h-[44px] rounded-lg bg-white text-sm font-medium text-teal-800 shadow-sm" : "min-h-[44px] rounded-lg text-sm text-gray-600 active:bg-gray-300"}
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className="mt-1 px-1 text-xs text-gray-500">
          Je vult nu de variant <strong>{VARIANTS.find((v) => v.key === variant)?.label.toLowerCase()}</strong> in. Wat per variant kan verschillen staat hieronder.
        </p>
      </div>

      <section className={`${card} space-y-3 p-5`}>
        <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left" aria-expanded={open}>
          <span>
            <span className="block text-base font-medium text-gray-900">Varianten invullen met een percentage</span>
            <span className="block text-xs text-gray-500">
              Stress {spread.stress}% slechter dan basis · gunstig {spread.gunstig}% beter
            </span>
          </span>
          <span className={`text-2xl text-gray-300 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        </button>

        {open && (
          <div className="space-y-4 border-t border-gray-100 pt-4">
            {(["stress", "gunstig"] as const).map((v) => (
              <div key={v} className="space-y-2">
                <p className="text-sm font-medium text-gray-900">{v === "stress" ? "Stress: slechter dan basis" : "Gunstig: beter dan basis"}</p>
                <div className="grid grid-cols-2 items-end gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-600">Hoeveel procent</span>
                    <NumberBox value={spread[v]} onChange={(n) => setSpread(v, Math.max(0, Math.min(90, n)))} unit="%" />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`De getallen van ${v === "stress" ? "stress" : "gunstig"} worden overschreven met de basis ${v === "stress" ? "slechter" : "beter"} met ${spread[v]}%, inclusief het salaris per jaar. Wat je zelf had ingevuld verdwijnt. Doorgaan?`)) fillFromSpread(v);
                    }}
                    className="min-h-[48px] rounded-xl bg-teal-700 px-3 text-sm font-medium text-white active:bg-teal-800"
                  >
                    Invullen
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Alle eigen getallen van ${v === "stress" ? "stress" : "gunstig"} wissen? De variant volgt dan weer de basis.`)) resetVariant(v);
                  }}
                  className="min-h-[40px] text-sm text-red-600 underline"
                >
                  Terug naar de basis
                </button>
              </div>
            ))}
            <Note>
              Slechter en beter gaat per getal de goede kant op: een hogere prijsstijging en een hoger overbod zijn slechter, een lagere salarisgroei en lagere inleg ook. Daarna pas je elk getal gewoon zelf aan in de tabel hieronder.
            </Note>
          </div>
        )}
      </section>

      <section className={`${card} space-y-4 p-5`}>
        <div>
          <h2 className="text-base font-medium text-gray-900">Wat per variant verschilt</h2>
          <p className="text-xs text-gray-500">Pas elk getal aan. Een gekleurd vakje is door jou of het percentage ingesteld, de rest volgt de basis.</p>
        </div>
        {SPREAD_FIELDS.map((id) => {
          const f = FIELD_BY_ID.get(id);
          if (!f) return null;
          return (
            <div key={id} className="space-y-1.5">
              <p className="text-sm text-gray-700">{f.label}</p>
              <div className="grid grid-cols-3 gap-2">
                {VARIANTS.map((v) => (
                  <div key={v.key}>
                    <p className={`mb-0.5 text-[11px] ${v.key === variant ? "font-semibold text-teal-800" : "text-gray-500"}`}>{v.label}</p>
                    <NumberBox
                      value={Number(fieldValue(scenario, v.key, id))}
                      onChange={(n) => setVariantField(v.key, id, n)}
                      unit={unitOf(id)}
                      className={own(v.key, id) ? "!border-teal-500 !bg-teal-50" : ""}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <Note>Het salaris per jaar per variant pas je aan bij Inkomen verderop: kies bovenaan de variant en pas de bedragen aan.</Note>
      </section>
    </div>
  );
}
