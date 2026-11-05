"use client";

import { useState } from "react";
import { Banner, Block, List, Note, NumberBox, Row, euro } from "../ui";
import { usePlan } from "../plan-provider";
import { computePlan, type PlanResult } from "@/lib/plan/model";
import { computeVariants, resolve, VARIANT_KEYS } from "@/lib/plan/scenarios";
import { maxPriceInYear, requiredMonthly, type MaxPrice, type RequiredMonthly } from "@/lib/plan/solve";
import { VARIANTS, type Variant } from "@/lib/plan/types";

// Lets the screen paint "bezig" before a heavy calculation starts.
const later = (fn: () => void) => window.setTimeout(fn, 30);

function Verdict({ r }: { r: PlanResult }) {
  const ok = r.enough;
  return (
    <div className="space-y-0.5 text-center">
      <p className={`text-sm font-semibold ${ok ? "text-green-700" : "text-red-600"}`}>{ok ? "Lukt" : `Tekort ${euro(r.shortfall)}`}</p>
      <p className="text-xs text-gray-500">{Math.round(r.probEnough * 100)}% kans</p>
      <p className="text-xs text-gray-400">hypotheek {euro(r.purchase.loan)}</p>
      <p className="text-xs text-gray-400">nodig {euro(r.purchase.needTotal)}</p>
    </div>
  );
}

export default function ScenariosPage() {
  const { doc, scenario, app, today } = usePlan();
  const [all, setAll] = useState<Record<string, Record<Variant, PlanResult>> | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [need, setNeed] = useState<Record<Variant, RequiredMonthly> | null>(null);
  const [busyNeed, setBusyNeed] = useState(false);
  const [maxes, setMaxes] = useState<{ year: number; v: Record<Variant, MaxPrice | null> }[] | null>(null);
  const [busyMax, setBusyMax] = useState(false);
  const [wantPrice, setWantPrice] = useState(400000);
  const [earliest, setEarliest] = useState<Record<Variant, number | null> | null>(null);
  const [busyEarly, setBusyEarly] = useState(false);
  const [calcIncome, setCalcIncome] = useState(75000);
  const [calcPrice, setCalcPrice] = useState(350000);
  const [calc, setCalc] = useState<{ need: number; own: number; loan: number; monthly: RequiredMonthly } | null>(null);
  const [busyCalc, setBusyCalc] = useState(false);

  const targetYear = Number(scenario.b.targetDate.slice(0, 4));
  const inputFor = (v: Variant) => ({ ...resolve(scenario, v), app });

  const runAll = () => {
    setBusyAll(true);
    later(() => {
      const out: Record<string, Record<Variant, PlanResult>> = {};
      for (const sc of doc.scenarios) out[sc.id] = computeVariants(sc, app, 200);
      setAll(out);
      setBusyAll(false);
    });
  };

  const runNeed = () => {
    setBusyNeed(true);
    later(() => {
      const out = {} as Record<Variant, RequiredMonthly>;
      for (const v of VARIANT_KEYS) out[v] = requiredMonthly(inputFor(v));
      setNeed(out);
      setBusyNeed(false);
    });
  };

  const runMax = () => {
    setBusyMax(true);
    later(() => {
      const years = Array.from({ length: 9 }, (_, i) => Number(today.slice(0, 4)) + 2 + i);
      setMaxes(years.map((year) => ({ year, v: { stress: maxPriceInYear(inputFor("stress"), year), basis: maxPriceInYear(inputFor("basis"), year), gunstig: maxPriceInYear(inputFor("gunstig"), year) } })));
      setBusyMax(false);
    });
  };

  const runEarliest = () => {
    setBusyEarly(true);
    later(() => {
      const out = {} as Record<Variant, number | null>;
      for (const v of VARIANT_KEYS) {
        const i = inputFor(v);
        const r = computePlan({ ...i, b: { ...i.b, targetPrice: wantPrice } }, 250);
        out[v] = r.earliest?.year ?? null;
      }
      setEarliest(out);
      setBusyEarly(false);
    });
  };

  const runCalc = () => {
    setBusyCalc(true);
    later(() => {
      const i = inputFor("basis");
      const q = {
        ...i,
        b: { ...i.b, targetPrice: calcPrice },
        x: { ...i.x, salaryYou: { ...i.x.salaryYou, [String(targetYear)]: calcIncome } },
      };
      const r = computePlan(q, 250);
      const m = requiredMonthly(q);
      setCalc({ need: r.purchase.needTotal, own: r.purchase.ownFunds, loan: r.purchase.loan, monthly: m });
      setBusyCalc(false);
    });
  };

  const btn = "min-h-[48px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50";

  return (
    <div className="space-y-4">
      <Banner level="info" title="Scenario's en varianten naast elkaar">
        Elk scenario (bijvoorbeeld alleen of samen kopen) heeft drie varianten: stress, basis en gunstig. Hieronder vergelijk je ze en reken je uit wat je nodig hebt. Berekeningen starten pas als je erop tikt, omdat ze even duren.
      </Banner>

      <Block title="Alles naast elkaar" sub="Elk scenario in elke variant, naar de streefdatum van dat scenario.">
        <button type="button" onClick={runAll} disabled={busyAll} className={btn}>
          {busyAll ? "Bezig…" : all ? "Opnieuw berekenen" : "Vergelijk alle scenario's"}
        </button>
        {all && (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="px-2 py-2 text-left font-medium" />
                  {VARIANTS.map((v) => (
                    <th key={v.key} className="px-2 py-2 text-center font-medium">
                      {v.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doc.scenarios.map((sc) => (
                  <tr key={sc.id} className="border-t border-gray-100 align-top">
                    <td className="px-2 py-3">
                      <p className="text-sm font-medium text-gray-900">{sc.name}</p>
                      <p className="text-xs text-gray-500">
                        {sc.b.targetDate.slice(0, 4)} · {euro(sc.b.targetPrice)}
                      </p>
                    </td>
                    {VARIANT_KEYS.map((v) => (
                      <td key={v} className="px-2 py-3">
                        {all[sc.id] ? <Verdict r={all[sc.id][v]} /> : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block title="Hoeveel moet ik sparen?" sub={`${scenario.name}: de inleg per maand die nodig is om in ${targetYear} met ${resolve(scenario, "basis").x.confidencePct}% zekerheid te halen wat je nodig hebt.`}>
        <button type="button" onClick={runNeed} disabled={busyNeed} className={btn}>
          {busyNeed ? "Bezig…" : need ? "Opnieuw berekenen" : "Bereken benodigde inleg"}
        </button>
        {need && (
          <>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="px-2 py-2 text-left font-medium" />
                    {VARIANTS.map((v) => (
                      <th key={v.key} className="px-2 py-2 text-right font-medium">
                        {v.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-100">
                    <td className="px-2 py-2 text-gray-600">Nodig per maand</td>
                    {VARIANT_KEYS.map((v) => (
                      <td key={v} className="px-2 py-2 text-right font-semibold text-gray-900">
                        {need[v].feasible ? euro(need[v].perMonth) : "te veel"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-gray-100">
                    <td className="px-2 py-2 text-gray-600">Nu ingepland</td>
                    {VARIANT_KEYS.map((v) => (
                      <td key={v} className="px-2 py-2 text-right">
                        {euro(need[v].current)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-gray-100">
                    <td className="px-2 py-2 text-gray-600">Extra nodig</td>
                    {VARIANT_KEYS.map((v) => (
                      <td key={v} className={`px-2 py-2 text-right font-medium ${need[v].extra > 0 ? "text-red-600" : "text-green-700"}`}>
                        {need[v].feasible ? euro(need[v].extra) : "–"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-gray-100">
                    <td className="px-2 py-2 text-gray-600">Nodig in totaal</td>
                    {VARIANT_KEYS.map((v) => (
                      <td key={v} className="px-2 py-2 text-right">
                        {euro(need[v].need)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <Note>
              De inleg is het totaal per maand van sparen, obligaties en beleggen samen, in dezelfde verhouding als nu, vanaf het eerste jaar dat er geld in gaat. In het basispad groeit de inleg daarna mee met de ingestelde stijging per jaar. Een hoger inkomen werkt zwaarder dan een hogere inleg: daarom kan de uitkomst bij stress onhaalbaar zijn.
            </Note>
          </>
        )}
      </Block>

      <Block title="Wat kan ik in jaar X kopen?" sub="De hoogste prijs (in euro's van vandaag) die past bij wat je dan hebt en kunt lenen.">
        <button type="button" onClick={runMax} disabled={busyMax} className={btn}>
          {busyMax ? "Bezig…" : maxes ? "Opnieuw berekenen" : "Bereken per jaar"}
        </button>
        {maxes && (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="px-2 py-2 text-left font-medium">Jaar</th>
                  {VARIANTS.map((v) => (
                    <th key={v.key} className="px-2 py-2 text-right font-medium">
                      {v.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {maxes.map((row) => (
                  <tr key={row.year} className="border-t border-gray-100">
                    <td className="px-2 py-2 font-medium text-gray-900">{row.year}</td>
                    {VARIANT_KEYS.map((v) => (
                      <td key={v} className="px-2 py-2 text-right">
                        {row.v[v] && row.v[v]!.price > 0 ? euro(row.v[v]!.price) : "geen"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {maxes && <Note>Bij &quot;geen&quot; reikt je geld niet eens voor de kosten koper en de buffer. Het plan rekent met het overbieden en de kosten van het gekozen scenario.</Note>}
      </Block>

      <Block title="Vanaf welk jaar kan ik een woning van € Y kopen?" sub="Het eerste jaar waarin het lukt, in elke variant.">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">Prijs van de woning (euro&apos;s van vandaag)</span>
          <NumberBox value={wantPrice} onChange={setWantPrice} unit="€" />
        </label>
        <button type="button" onClick={runEarliest} disabled={busyEarly} className={btn}>
          {busyEarly ? "Bezig…" : "Zoek het vroegste jaar"}
        </button>
        {earliest && (
          <List>
            {VARIANT_KEYS.map((v) => (
              <Row key={v} label={VARIANTS.find((q) => q.key === v)!.label} value={earliest[v] ? String(earliest[v]) : "in de komende jaren niet"} strong />
            ))}
          </List>
        )}
      </Block>

      <Block title="Welk inkomen en welke inleg passen bij welke woning?" sub={`${scenario.name}, basisvariant, kopen in ${targetYear}`}>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">Bruto inkomen in {targetYear}</span>
            <NumberBox value={calcIncome} onChange={setCalcIncome} unit="€" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">Prijs woning nu</span>
            <NumberBox value={calcPrice} onChange={setCalcPrice} unit="€" />
          </label>
        </div>
        <button type="button" onClick={runCalc} disabled={busyCalc} className={btn}>
          {busyCalc ? "Bezig…" : "Bereken"}
        </button>
        {calc && (
          <List>
            <Row label="Maximale hypotheek" value={euro(calc.loan)} />
            <Row label="Eigen geld nodig" value={euro(calc.own)} />
            <Row label="Inclusief buffer" value={euro(calc.need)} />
            <Row label="Inleg per maand nodig" value={calc.monthly.feasible ? euro(calc.monthly.perMonth) : "niet haalbaar"} strong />
          </List>
        )}
        <Note>Alleen het inkomen van het jaar van aankoop wordt vervangen. Een hoger inkomen verlaagt het eigen geld dat je nodig hebt met ongeveer € 4,25 voor elke extra euro bruto inkomen (volgens de vuistregel); een extra euro inleg levert ongeveer € 1 tot € 1,40 op.</Note>
      </Block>
    </div>
  );
}
