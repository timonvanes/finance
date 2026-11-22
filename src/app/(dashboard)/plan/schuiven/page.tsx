"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Block, Note, euro } from "../ui";
import { usePlan } from "../plan-provider";
import { computePlan } from "@/lib/plan/model";
import { requiredPct } from "@/lib/plan/solve";
import { resolve, VARIANT_KEYS } from "@/lib/plan/scenarios";
import { applySandbox, describeSandbox, sandboxOf, type Sandbox } from "@/lib/plan/sandbox";
import { VARIANTS, type Variant } from "@/lib/plan/types";

const nl = (n: number, d = 1) => n.toLocaleString("nl-NL", { maximumFractionDigits: d });

function Slider({
  label,
  value,
  was,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  was: number;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  const changed = Math.abs(value - was) > 1e-9;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="flex items-baseline gap-2">
          {changed && <span className="text-xs text-gray-400 line-through">{format(was)}</span>}
          <span className={`text-base font-semibold ${changed ? "text-teal-800" : "text-gray-900"}`}>{format(value)}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full accent-teal-700"
        aria-label={label}
      />
    </div>
  );
}

// A test environment: slide the main numbers of the active scenario and see at once what it does
// to stress, basis and gunstig. Nothing changes until you keep the result as a new scenario.
export default function SandboxPage() {
  const { scenario } = usePlan();
  // A fresh start whenever another scenario is chosen.
  return <Sandboxes key={scenario.id} />;
}

function Sandboxes() {
  const { scenario, app, addScenario } = usePlan();
  const router = useRouter();
  const base = useMemo(() => sandboxOf(scenario), [scenario]);
  const [s, setS] = useState<Sandbox>(base);
  const [name, setName] = useState("");
  const set = <K extends keyof Sandbox>(k: K, v: Sandbox[K]) => setS((cur) => ({ ...cur, [k]: v }));

  const deferred = useDeferredValue(s);
  const busy = deferred !== s;
  const results = useMemo(() => {
    const sc = applySandbox(scenario, deferred);
    return VARIANT_KEYS.map((v) => {
      const input = { ...resolve(sc, v, app), app };
      const r = computePlan(input, 100);
      const need = requiredPct(input, 80);
      return { v, r, need };
    });
  }, [deferred, scenario, app]);

  const targetYear = Number(scenario.b.targetDate.slice(0, 4));
  const changed = JSON.stringify(s) !== JSON.stringify(base);

  const keep = () => {
    const sc = applySandbox(scenario, s);
    const label = name.trim() || `${scenario.name} (schuifjes)`;
    addScenario({ ...sc, id: `s${Date.now().toString(36)}`, name: label, description: describeSandbox(scenario, s) });
    router.push("/plan/scenarios");
  };

  const label = (v: Variant) => VARIANTS.find((x) => x.key === v)?.label ?? v;

  return (
    <div className="space-y-4">
      <div className="sticky top-[env(safe-area-inset-top)] z-20 -mx-4 bg-gray-50/95 px-4 py-2 backdrop-blur">
        <div className={`grid grid-cols-3 gap-2 transition ${busy ? "opacity-60" : ""}`}>
          {results.map(({ v, r, need }) => (
            <div key={v} className="space-y-0.5 rounded-xl bg-white p-2.5 text-center ring-1 ring-gray-200">
              <p className="text-xs text-gray-500">{label(v)}</p>
              <p className={`text-base font-semibold ${need.feasible ? (need.pct <= 20 ? "text-green-700" : need.pct <= 40 ? "text-amber-700" : "text-red-600") : "text-red-600"}`}>{need.feasible ? `${nl(need.pct)}%` : "onhaalbaar"}</p>
              <p className="text-xs text-gray-700">{need.feasible ? `${euro(need.firstMonthly)} p/m` : "meer dan je loon"}</p>
              <p className="text-[11px] text-gray-400">nodig {euro(r.purchase.needTotal)}</p>
            </div>
          ))}
        </div>
        <p className="mt-1 text-center text-[11px] text-gray-500">{busy ? "Bezig met rekenen…" : "Boven: het deel van je netto loon dat je moet sparen om het te halen. Onder: het geld dat je bij de aankoop nodig hebt."}</p>
      </div>

      <Block title="Schuifjes" sub={`Je speelt met een kopie van ${scenario.name}. Er wordt niets opgeslagen.`}>
        <Slider label="Jaar van aankoop" value={targetYear + s.shiftYears} was={targetYear} min={targetYear} max={targetYear + 8} step={1} format={(n) => String(n)} onChange={(n) => set("shiftYears", n - targetYear)} />
        <Slider label="Prijs woning (nu)" value={s.price} was={base.price} min={150000} max={800000} step={5000} format={(n) => euro(n)} onChange={(n) => set("price", n)} />
        <Slider label="Prijsstijging per jaar" value={s.priceGrowth} was={base.priceGrowth} min={0} max={8} step={0.5} format={(n) => `${nl(n)}%`} onChange={(n) => set("priceGrowth", n)} />
        <Slider label="Overbieden" value={s.bid} was={base.bid} min={0} max={12} step={0.5} format={(n) => `${nl(n)}%`} onChange={(n) => set("bid", n)} />
        <Slider label="Salaris t.o.v. nu" value={s.salaryPct} was={0} min={-30} max={60} step={5} format={(n) => `${n > 0 ? "+" : ""}${n}%`} onChange={(n) => set("salaryPct", n)} />
        <Slider label="Extra salarisgroei per jaar" value={s.extraGrowth} was={0} min={-2} max={6} step={0.5} format={(n) => `${n > 0 ? "+" : ""}${nl(n)} pt`} onChange={(n) => set("extraGrowth", n)} />
        <Slider label="Salaris partner (0 = alleen kopen)" value={s.partnerGross} was={base.partnerGross} min={0} max={100000} step={2500} format={(n) => (n > 0 ? euro(n) : "alleen")} onChange={(n) => set("partnerGross", n)} />
        <Slider label="Hypotheekrente" value={s.rate} was={base.rate} min={2} max={7} step={0.1} format={(n) => `${nl(n)}%`} onChange={(n) => set("rate", n)} />
        <Slider label="Buffer na aankoop" value={s.buffer} was={base.buffer} min={0} max={12} step={1} format={(n) => `${n} mnd`} onChange={(n) => set("buffer", n)} />
        <Slider label="Verbouwing" value={s.renovation} was={base.renovation} min={0} max={60000} step={2500} format={(n) => euro(n)} onChange={(n) => set("renovation", n)} />
        <button
          type="button"
          disabled={!changed}
          onClick={() => setS(base)}
          className="min-h-[44px] w-full rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 active:bg-gray-50 disabled:opacity-40"
        >
          Alles terugzetten
        </button>
      </Block>

      <Block title="Bewaren als scenario" sub="Dan staat het er naast je andere scenario's en kun je het verder invullen.">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${scenario.name} (schuifjes)`}
          className="box-border min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
        />
        <p className="text-xs text-gray-500">{changed ? describeSandbox(scenario, s) : "Je hebt nog niets verschoven."}</p>
        <button
          type="button"
          disabled={!changed}
          onClick={keep}
          className="min-h-[48px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-40"
        >
          Opslaan als nieuw scenario
        </button>
        <Note>Het nieuwe scenario wordt pas bewaard als je daarna op Opslaan tikt onderaan het scherm.</Note>
      </Block>
    </div>
  );
}
