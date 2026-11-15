"use client";

import { NumberBox, Note, card } from "./ui";
import { fieldValue, usePlan } from "./plan-provider";
import { DEFAULT_SPREAD, SPREAD_FIELDS, overrideOf } from "@/lib/plan/scenarios";
import { FIELD_BY_ID } from "@/lib/plan/fields";
import { VARIANTS, type Variant } from "@/lib/plan/types";

// The three variants on one place: switch between them, let the percentages fill them in,
// and still change any number by hand.
export function VariantPanel() {
  const { scenario, variant, setVariant, setVariantField, setSpread, fillFromSpread, resetVariant } = usePlan();
  const spread = scenario.spread ?? DEFAULT_SPREAD;

  const unitOf = (id: string) => {
    const u = FIELD_BY_ID.get(id)?.unit;
    return u === "%" ? "%" : u === "€" ? "€" : undefined;
  };
  const own = (v: Variant, id: string) => v !== "basis" && id in overrideOf(scenario, v).fields;

  return (
    <div className="space-y-3">
      <div className="sticky top-[env(safe-area-inset-top)] z-20 -mx-4 space-y-2 bg-gray-50/95 px-4 py-2 backdrop-blur">
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
        {variant === "basis" ? (
          <p className="px-1 text-xs text-gray-500">
            Je vult nu de basis in. Kies stress of gunstig om die met een percentage rond de basis in te vullen.
          </p>
        ) : (
          <div className="space-y-1">
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-xs text-gray-600">
                  {variant === "stress" ? "Stress: hoeveel procent slechter dan basis" : "Gunstig: hoeveel procent beter dan basis"}
                </span>
                <NumberBox value={spread[variant]} onChange={(n) => setSpread(variant, Math.max(0, Math.min(90, n)))} unit="%" />
              </label>
              <button
                type="button"
                onClick={() => {
                  const label = variant === "stress" ? "stress" : "gunstig";
                  if (window.confirm(`De getallen van ${label} worden overschreven met de basis ${variant === "stress" ? "slechter" : "beter"} met ${spread[variant]}%, inclusief het salaris per jaar. Wat je zelf had ingevuld verdwijnt. Doorgaan?`)) fillFromSpread(variant);
                }}
                className="min-h-[48px] shrink-0 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white active:bg-teal-800"
              >
                Invullen
              </button>
            </div>
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-gray-500">Daarna pas je elk getal zelf aan in de tabel hieronder.</p>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Alle eigen getallen van ${variant === "stress" ? "stress" : "gunstig"} wissen? De variant volgt dan weer de basis.`)) resetVariant(variant);
                }}
                className="min-h-[32px] shrink-0 text-xs text-red-600 underline"
              >
                Terug naar de basis
              </button>
            </div>
          </div>
        )}
      </div>

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
