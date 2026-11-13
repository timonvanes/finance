"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Banner, Bar, Block, Legend, LineChart, Stat, card, euro } from "./ui";
import { usePlan } from "./plan-provider";
import { missingInputs } from "@/lib/plan/completeness";
import { computeVariants, resolve, VARIANT_KEYS } from "@/lib/plan/scenarios";
import { requiredMonthly } from "@/lib/plan/solve";
import { VARIANTS } from "@/lib/plan/types";

const ORDER = { bad: 0, warn: 1, info: 2, ok: 3 } as const;

export default function PlanOverview() {
  const { result: r, b, x, scenario, variant, app, calculating, hasDoc } = usePlan();
  const [all, setAll] = useState(false);

  // The comparison of the three variants and the saving needed take a moment: they
  // follow the scenario, not every key press.
  const settled = useDeferredValue(scenario);
  const variants = useMemo(() => computeVariants(settled, app, 200), [settled, app]);
  const need = useMemo(() => requiredMonthly({ ...resolve(settled, variant), app }, 200), [settled, variant, app]);

  const pu = r.purchase;
  const T = r.targetMonth;
  const ti = r.sim.checkpoints.indexOf(T);
  const wealth = r.confidenceKey === "p10" ? r.sim.p10[ti] : r.sim.p50[ti];
  const missing = missingInputs(b, x);
  const rows = r.years.filter((y) => y.m >= 0);
  const insights = [...r.insights].sort((u, v) => ORDER[u.level] - ORDER[v.level]);
  const shown = all ? insights : insights.slice(0, 4);
  const surplusTone = pu.surplus >= 0 ? "good" : "bad";

  return (
    <div className={`space-y-4 ${calculating ? "opacity-70" : ""}`}>
      {!hasDoc && (
        <Banner level="info" title="Dit is je startpunt">
          Het plan is voorgevuld. Tik rechtsonder op Opslaan om het te bewaren en vul daarna je eigen gegevens in onder Variabelen.
        </Banner>
      )}
      {missing.length > 0 && (
        <Link href="/plan/variabelen" className="block">
          <Banner level="warn" title={`Nog ${missing.length} ${missing.length === 1 ? "gegeven" : "gegevens"} in te vullen`}>
            {missing.map((m) => m.label).join(", ")}. Tik hier om ze in te vullen.
          </Banner>
        </Link>
      )}

      <section className={`${card} space-y-4 p-5`}>
        <div>
          <p className="text-sm text-gray-500">
            {scenario.name} · {VARIANTS.find((v) => v.key === variant)?.label} · kopen in {pu.year}
          </p>
          <p className={`text-2xl font-semibold ${r.enough ? "text-green-700" : "text-red-600"}`}>
            {r.enough ? `Dit lukt in ${pu.year}` : `Er ontbreekt € ${Math.round(r.shortfall).toLocaleString("nl-NL")}`}
          </p>
        </div>
        <div className="space-y-1.5">
          <Bar value={Math.min(wealth, pu.needTotal)} max={pu.needTotal} color={r.enough ? "bg-green-600" : "bg-amber-500"} />
          <p className="text-sm text-gray-600">
            Je hebt {euro(wealth)} van de {euro(pu.needTotal)} die je nodig hebt, met {x.confidencePct}% zekerheid.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
          <Stat label="Kans dat het lukt" value={`${Math.round(r.probEnough * 100)}%`} tone={r.probEnough >= 0.8 ? "good" : r.probEnough >= 0.5 ? "warn" : "bad"} how="Het aandeel van 600 gesimuleerde verlopen van de markt waarin je op de streefdatum genoeg hebt." />
          <Stat label="Vroegste jaar" value={r.earliest ? String(r.earliest.year) : "nog niet"} sub={r.earliest ? "waarin het volgens het plan kan" : "met de huidige inleg"} />
        </div>
      </section>

      <Block title="Wat je per maand moet doen" sub="Alles wat je inlegt (sparen, obligaties, beleggen), gerekend op je gekozen zekerheid.">
        {need.feasible ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Nodig per maand" value={euro(need.perMonth)} big how={`De kleinste inleg waarmee je op ${pu.date.slice(0, 7)} met ${x.confidencePct}% zekerheid ${euro(need.need)} hebt, in dezelfde verhouding als nu.`} />
              <Stat label="Nu ingepland" value={euro(need.current)} tone={need.extra > 0 ? "warn" : "good"} />
            </div>
            <p className={`rounded-xl px-4 py-3 text-sm ${need.extra > 0 ? "bg-amber-50 text-amber-900" : "bg-green-50 text-green-800"}`}>
              {need.extra > 0 ? `Je moet ongeveer ${euro(need.extra)} per maand meer inleggen.` : "Je huidige inleg is genoeg."}
            </p>
          </>
        ) : (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            Alleen met meer inleggen lukt dit niet. Kijk naar een lagere prijs, een later jaar of een hoger inkomen. Onder Analyse, Scenario&apos;s zie je wat je wel kunt kopen.
          </p>
        )}
      </Block>

      <Block title="Drie varianten" sub={`${scenario.name}, op de streefdatum`}>
        <div className="grid grid-cols-3 gap-2">
          {VARIANT_KEYS.map((v) => {
            const q = variants[v];
            return (
              <div key={v} className={`rounded-xl p-3 text-center ${v === variant ? "bg-teal-50 ring-1 ring-teal-600" : "bg-gray-50"}`}>
                <p className="text-xs font-medium text-gray-600">{VARIANTS.find((c) => c.key === v)?.label}</p>
                <p className={`text-sm font-semibold ${q.enough ? "text-green-700" : "text-red-600"}`}>{q.enough ? "Lukt" : `− ${euro(q.shortfall)}`}</p>
                <p className="text-xs text-gray-500">{Math.round(q.probEnough * 100)}% kans</p>
              </div>
            );
          })}
        </div>
      </Block>

      <Block title="Zo ziet de aankoop eruit" sub={`In ${pu.year}, in euro's van dat jaar`}>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Woning" value={euro(pu.paid)} sub={pu.bid > 0 ? `inclusief ${euro(pu.bid)} overbod` : "vraagprijs"} how={`Prijs nu ${euro(b.targetPrice)} met ${x.priceGrowthPct}% stijging per jaar tot ${pu.year}${pu.bid > 0 ? `, plus ${x.bidPct}% overbod` : ""}.`} />
          <Stat label="Hypotheek" value={euro(pu.loan)} sub={pu.loanMode} how={`De bank rekent met ${euro(pu.cap.counted)} bruto inkomen en ${euro(pu.cap.available)} per maand aan ruimte.`} />
          <Stat label="Eigen geld" value={euro(pu.ownFunds)} sub={`${euro(pu.costsTotal)} kosten koper`} how="Woning plus verbouwing plus kosten koper min de hypotheek." />
          <Stat label="Buffer erbij" value={euro(pu.buffer)} sub={`${x.bufferMonths} maanden vaste lasten`} />
          <Stat label="Hypotheek netto per maand" value={euro(pu.mortgage.netMonthly)} sub="na hypotheekrenteaftrek" />
          <Stat label="Blijft over per maand" value={euro(pu.surplus)} tone={surplusTone} sub={`${Math.round(pu.woonquote)}% van je netto naar vaste woonlasten`} />
        </div>
      </Block>

      <Block title="Hoe je vermogen groeit" sub="Het groene vlak is de slechtste tot de beste 10% van de simulaties. Rood is wat je nodig hebt.">
        <LineChart
          labels={rows.map((y) => String(y.year))}
          band={{ lo: rows.map((y) => y.p10), hi: rows.map((y) => y.p90), color: "#0f766e" }}
          lines={[
            { label: "p50", color: "#0f766e", values: rows.map((y) => y.p50) },
            { label: "p10", color: "#14b8a6", values: rows.map((y) => y.p10), dash: true },
          ]}
          need={rows.map((y) => y.need)}
        />
        <Legend
          items={[
            { color: "#0f766e", label: "Verwacht" },
            { color: "#14b8a6", label: "Tegenvallend", dash: true },
            { color: "#ef4444", label: "Nodig", dash: true },
          ]}
        />
      </Block>

      <section className="space-y-2">
        <h2 className="px-1 text-lg font-semibold text-gray-900">Waar je op moet letten</h2>
        {shown.map((i, k) => (
          <Banner key={k} level={i.level} title={i.title}>
            {i.text}
          </Banner>
        ))}
        {insights.length > 4 && (
          <button type="button" onClick={() => setAll(!all)} className="min-h-[44px] w-full rounded-xl text-sm font-medium text-teal-700 active:bg-gray-100">
            {all ? "Minder tonen" : `Alle ${insights.length} punten tonen`}
          </button>
        )}
        <p className="px-1 text-xs text-gray-500">Een rekenhulp met jouw aannames, geen financieel advies. Een hypotheekadviseur kan het echte leenbedrag bepalen.</p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/plan/variabelen" className={`${card} flex min-h-[64px] items-center justify-center px-4 text-center text-base font-medium text-gray-900 active:bg-gray-50`}>
          Variabelen invullen
        </Link>
        <Link href="/plan/analyse" className={`${card} flex min-h-[64px] items-center justify-center px-4 text-center text-base font-medium text-gray-900 active:bg-gray-50`}>
          Verder analyseren
        </Link>
      </div>
    </div>
  );
}
