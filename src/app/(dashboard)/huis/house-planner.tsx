"use client";

import { useMemo, useState, useTransition } from "react";
import { saveHousePlan } from "@/actions/house";
import {
  extraMonthlyToClose,
  monthlyForLoan,
  monthsUntil,
  mortgageCapacity,
  ownFundsNeeded,
  project,
  type HouseInputs,
  type Scenario,
} from "@/lib/house/calc";

const euro = (n: number) =>
  n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const field =
  "box-border min-h-[48px] w-full min-w-0 max-w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 text-base";
const card = "rounded-2xl bg-white ring-1 ring-gray-200";

const SCENARIOS: { key: Scenario; label: string; hint: string }[] = [
  { key: "keep", label: "Jouw verdeling", hint: "zoals je nu spaart en belegt" },
  { key: "save", label: "Alles sparen", hint: "alles op een spaarrekening" },
  { key: "invest", label: "Alles beleggen", hint: "alles in beleggingen" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function Fold({ title, open = false, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className={`${card} group`}>
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between px-5 text-base font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="text-2xl text-gray-300 transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-3 border-t border-gray-100 p-5">{children}</div>
    </details>
  );
}

function Chart({
  lines,
  need,
  months,
}: {
  lines: { label: string; color: string; dash?: boolean; values: number[] }[];
  need: number;
  months: number;
}) {
  const W = 320;
  const H = 170;
  const pad = { l: 8, r: 8, t: 10, b: 22 };
  const max = Math.max(need, ...lines.flatMap((l) => l.values)) * 1.05 || 1;
  const x = (m: number) => pad.l + (months <= 0 ? 0 : (m / months) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const yearTicks: number[] = [];
  for (let m = 0; m <= months; m += 12) yearTicks.push(m);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Verwachte opbouw tot je streefdatum">
      <line x1={pad.l} x2={W - pad.r} y1={y(need)} y2={y(need)} className="stroke-red-400" strokeWidth="1.5" strokeDasharray="4 3" />
      {lines.map((l) => (
        <polyline
          key={l.label}
          fill="none"
          stroke={l.color}
          strokeWidth="2"
          strokeDasharray={l.dash ? "4 3" : undefined}
          points={l.values.map((v, m) => `${x(m)},${y(v)}`).join(" ")}
        />
      ))}
      {yearTicks.map((m) => (
        <text key={m} x={x(m)} y={H - 6} textAnchor="middle" className="fill-gray-400 text-[9px]">
          {m === 0 ? "nu" : `${m / 12} jr`}
        </text>
      ))}
    </svg>
  );
}

export function HousePlanner({
  initial,
  saved,
  repayStart,
}: {
  initial: HouseInputs;
  saved: boolean;
  repayStart: string | null;
}) {
  const [f, setF] = useState<Record<keyof HouseInputs, string>>(
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])) as Record<keyof HouseInputs, string>
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(saved ? null : "Nog niet opgeslagen.");
  const set = (k: keyof HouseInputs) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF((prev) => ({ ...prev, [k]: e.target.value }));
    setMessage(null);
  };

  const i: HouseInputs = useMemo(() => {
    const n = (k: keyof HouseInputs) => Number(String(f[k]).replace(",", ".")) || 0;
    return {
      targetDate: f.targetDate,
      targetPrice: n("targetPrice"),
      incomeGrossYear: n("incomeGrossYear"),
      partnerIncomeGrossYear: n("partnerIncomeGrossYear"),
      rate: n("rate"),
      termYears: n("termYears") || 30,
      costPct: n("costPct"),
      housingPct: n("housingPct"),
      studentMonthly: n("studentMonthly"),
      startSavings: n("startSavings"),
      startInvest: n("startInvest"),
      monthlySave: n("monthlySave"),
      monthlyInvest: n("monthlyInvest"),
      savingsRate: n("savingsRate"),
      returnLow: n("returnLow"),
      returnMid: n("returnMid"),
      returnHigh: n("returnHigh"),
    };
  }, [f]);

  const months = monthsUntil(i.targetDate);
  const cap = mortgageCapacity(i);
  const hasIncome = i.incomeGrossYear + i.partnerIncomeGrossYear > 0;
  const loan = Math.min(cap.maxLoan, i.targetPrice);
  const need = ownFundsNeeded(i, hasIncome ? cap.maxLoan : i.targetPrice);
  const needTotal = hasIncome ? need.total : i.targetPrice * (i.costPct / 100);
  const monthlyCost = monthlyForLoan(loan, i.rate, i.termYears);

  const results = SCENARIOS.map((s) => {
    const pts = project(i, s.key, months);
    const end = pts[pts.length - 1];
    return {
      ...s,
      pts,
      end,
      gapMid: needTotal - end.mid,
      gapLow: needTotal - end.low,
      extraMid: extraMonthlyToClose(needTotal - end.mid, s.key === "save" ? i.savingsRate : i.returnMid, months),
      extraLow: extraMonthlyToClose(needTotal - end.low, s.key === "save" ? i.savingsRate : i.returnLow, months),
    };
  });
  const keep = results[0];

  function save() {
    startTransition(async () => {
      try {
        await saveHousePlan(i);
        setMessage("Opgeslagen.");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Opslaan mislukt");
      }
    });
  }

  const enough = keep.gapMid <= 0;
  const year = new Date(i.targetDate).getFullYear();

  return (
    <div className="space-y-4">
      <section className={`${card} space-y-4 p-5`}>
        <div>
          <p className="text-sm text-gray-500">Eigen geld nodig in {Number.isFinite(year) ? year : "…"}</p>
          <p className="text-4xl font-semibold text-gray-900">{euro(needTotal)}</p>
          <p className="text-sm text-gray-500">
            {euro(need.costs)} kosten koper
            {hasIncome && need.shortfallOnPrice > 0 && `, ${euro(need.shortfallOnPrice)} omdat de prijs boven je hypotheek uitkomt`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
          <div>
            <p className="text-sm text-gray-500">Jouw verdeling, midden</p>
            <p className="text-xl font-semibold text-gray-900">{euro(keep.end.mid)}</p>
            <p className="text-xs text-gray-400">
              laag {euro(keep.end.low)} · hoog {euro(keep.end.high)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{enough ? "Overschot" : "Tekort"}</p>
            <p className={`text-xl font-semibold ${enough ? "text-green-700" : "text-red-600"}`}>
              {euro(Math.abs(keep.gapMid))}
            </p>
            {!enough && (
              <p className="text-xs text-gray-400">
                ongeveer {euro(keep.extraMid)} extra per maand
              </p>
            )}
          </div>
        </div>

        {hasIncome ? (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-sm text-gray-500">Indicatieve hypotheek</p>
            <p className="text-2xl font-semibold text-gray-900">{euro(cap.maxLoan)}</p>
            <p className="text-sm text-gray-500">
              maandlast rond {euro(monthlyCost)} bij {String(i.rate).replace(".", ",")}% over {i.termYears} jaar
              {i.targetPrice > cap.maxLoan && " (je streefprijs ligt hierboven)"}
            </p>
          </div>
        ) : (
          <p className="border-t border-gray-100 pt-3 text-sm text-gray-500">
            Vul je inkomen in om te zien hoeveel hypotheek er ongeveer mogelijk is.
          </p>
        )}
      </section>

      <section className={`${card} space-y-2 p-5`}>
        <p className="text-base font-medium text-gray-900">Opbouw tot je streefdatum</p>
        <Chart
          months={months}
          need={needTotal}
          lines={[
            { label: "keep-low", color: "#5eead4", dash: true, values: keep.pts.map((p) => p.low) },
            { label: "keep-mid", color: "#0f766e", values: keep.pts.map((p) => p.mid) },
            { label: "keep-high", color: "#5eead4", dash: true, values: keep.pts.map((p) => p.high) },
            { label: "save", color: "#6b7280", values: results[1].pts.map((p) => p.mid) },
          ]}
        />
        <p className="text-xs text-gray-500">
          Groen: jouw verdeling (gestippeld laag en hoog). Grijs: alles sparen. Rood: het eigen geld dat je nodig hebt.
        </p>
      </section>

      <Fold title="Scenario's vergelijken" open>
        <ul className="divide-y divide-gray-100">
          {results.map((r) => (
            <li key={r.key} className="space-y-1 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-base font-medium text-gray-900">{r.label}</span>
                <span className="text-base font-semibold text-gray-900">{euro(r.end.mid)}</span>
              </div>
              <p className="text-sm text-gray-500">
                {r.hint}
                {r.key !== "save" && `, laag ${euro(r.end.low)} tot hoog ${euro(r.end.high)}`}
              </p>
              <p className={`text-sm ${r.gapLow > 0 ? "text-amber-700" : "text-green-700"}`}>
                {r.gapLow > 0
                  ? `In het lage geval ${euro(r.gapLow)} tekort`
                  : `Ook in het lage geval genoeg (${euro(-r.gapLow)} over)`}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500">
          Hoe korter je de streefdatum kiest, hoe meer het verschil tussen laag en hoog ertoe doet. Beleggingen kunnen op
          de dag van kopen minder waard zijn dan je hoopt.
        </p>
      </Fold>

      <Fold title="Doel" open>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Streefdatum">
            <input type="date" value={f.targetDate} onChange={set("targetDate")} className={field} />
          </Field>
          <Field label="Prijs woning">
            <input inputMode="decimal" value={f.targetPrice} onChange={set("targetPrice")} className={field} />
          </Field>
        </div>
      </Fold>

      <Fold title="Inkomen en lasten">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bruto jaarinkomen">
            <input inputMode="decimal" value={f.incomeGrossYear} onChange={set("incomeGrossYear")} className={field} />
          </Field>
          <Field label="Partner, bruto per jaar">
            <input
              inputMode="decimal"
              value={f.partnerIncomeGrossYear}
              onChange={set("partnerIncomeGrossYear")}
              className={field}
            />
          </Field>
          <Field label="Studielening per maand">
            <input inputMode="decimal" value={f.studentMonthly} onChange={set("studentMonthly")} className={field} />
          </Field>
        </div>
        <p className="text-xs text-gray-500">
          De studielening wordt ingevuld met je geschatte maandbedrag uit &quot;Schulden en hypotheek&quot;. Geldverstrekkers
          rekenen er zelf mee, dus dit is een schatting.
        </p>
      </Fold>

      <Fold title="Sparen en beleggen">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nu gespaard">
            <input inputMode="decimal" value={f.startSavings} onChange={set("startSavings")} className={field} />
          </Field>
          <Field label="Nu belegd">
            <input inputMode="decimal" value={f.startInvest} onChange={set("startInvest")} className={field} />
          </Field>
          <Field label="Sparen per maand">
            <input inputMode="decimal" value={f.monthlySave} onChange={set("monthlySave")} className={field} />
          </Field>
          <Field label="Beleggen per maand">
            <input inputMode="decimal" value={f.monthlyInvest} onChange={set("monthlyInvest")} className={field} />
          </Field>
        </div>
        <p className="text-xs text-gray-500">Vooraf ingevuld vanuit je potjes en hun maandplan. Je kunt alles aanpassen.</p>
      </Fold>

      <Fold title="Aannames">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hypotheekrente (%)">
            <input inputMode="decimal" value={f.rate} onChange={set("rate")} className={field} />
          </Field>
          <Field label="Looptijd (jaren)">
            <input inputMode="numeric" value={f.termYears} onChange={set("termYears")} className={field} />
          </Field>
          <Field label="Kosten koper (%)">
            <input inputMode="decimal" value={f.costPct} onChange={set("costPct")} className={field} />
          </Field>
          <Field label="Max. woonlast (% bruto)">
            <input inputMode="decimal" value={f.housingPct} onChange={set("housingPct")} className={field} />
          </Field>
          <Field label="Spaarrente (%)">
            <input inputMode="decimal" value={f.savingsRate} onChange={set("savingsRate")} className={field} />
          </Field>
          <div />
          <Field label="Rendement laag (%)">
            <input inputMode="decimal" value={f.returnLow} onChange={set("returnLow")} className={field} />
          </Field>
          <Field label="Rendement midden (%)">
            <input inputMode="decimal" value={f.returnMid} onChange={set("returnMid")} className={field} />
          </Field>
          <Field label="Rendement hoog (%)">
            <input inputMode="decimal" value={f.returnHigh} onChange={set("returnHigh")} className={field} />
          </Field>
        </div>
        <p className="text-xs text-gray-500">
          De rendementen zijn aannames om mee te rekenen en geen voorspelling. Voor kosten koper geldt onder voorwaarden
          een vrijstelling van overdrachtsbelasting voor starters tot een bepaalde leeftijd en prijs. Controleer de
          actuele regels en pas het percentage aan.
        </p>
      </Fold>

      <Fold title="Kalender">
        <ul className="space-y-2 text-base text-gray-800">
          {repayStart && (
            <li>
              Studielening: aflosfase begint op {new Date(repayStart).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}.
              Dan komt er een maandlast bij.
            </li>
          )}
          <li>
            Streefdatum: {new Date(i.targetDate).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })} (over{" "}
            {Math.floor(months / 12)} jaar en {months % 12} maanden).
          </li>
        </ul>
      </Fold>

      <div className="space-y-2">
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
        >
          Opslaan
        </button>
        {message && <p className="text-sm text-teal-700">{message}</p>}
        <p className="text-xs text-gray-500">
          Dit is een rekenhulp met jouw eigen aannames, en geen financieel advies. Een hypotheekadviseur kan het echte
          bedrag bepalen dat je kunt lenen.
        </p>
      </div>
    </div>
  );
}
