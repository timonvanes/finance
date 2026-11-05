"use client";

import { useDeferredValue, useMemo } from "react";
import { Banner, Bar, Block, Grid, Legend, LineChart, List, Note, NumberBox, Row, Section, euro, pct } from "../ui";
import { usePlan } from "../plan-provider";
import { compareStrategies, contributionFor } from "@/lib/plan/model";

export default function InvestPage() {
  const { result: r, b, x, app, patchX } = usePlan();
  const db = useDeferredValue(b);
  const dx = useDeferredValue(x);
  const strategies = useMemo(() => compareStrategies({ b: db, x: dx, app }, r), [db, dx, app, r]);
  const T = r.targetMonth;
  const pu = r.purchase;
  const need = pu.needTotal;
  const years = r.years.filter((y) => y.m >= 0);
  const startYear = r.startYear;
  const firstYears = Array.from({ length: Math.min(10, Math.max(1, pu.year - startYear + 1)) }, (_, i) => startYear + i);
  const total0 = b.startSavings + x.startBonds + b.startInvest;
  const monthly0 = b.monthlySave + x.monthlyBonds + b.monthlyInvest;
  const real = Math.pow(1 + x.inflationPct / 100, T / 12);
  const best = [...strategies].sort((a, c) => c.probEnough - a.probEnough)[0];
  const horizon = T / 12;

  const setContrib = (year: number, k: "save" | "bonds" | "invest", n: number) =>
    patchX((cur) => {
      const base = contributionFor({ b, x: cur, app }, year);
      return { ...cur, contrib: { ...cur.contrib, [String(year)]: { ...base, [k]: n } } };
    });

  return (
    <div className="space-y-4">
      <Banner level="info" title="Sparen, obligaties en aandelen naast elkaar">
        Het plan simuleert {600} mogelijke verlopen van de markt en laat zien hoe vaak je het bedrag haalt dat je nodig hebt. Dit zijn aannames en geen voorspellingen, en geen financieel advies.
      </Banner>

      <Block title="Wat je nu hebt" sub="De startwaarden komen uit je potjes en je invoer.">
        <List>
          <Row label="Gespaard" value={euro(b.startSavings)} sub={`${pct(b.savingsRate)} rente`} />
          <Row label="Obligaties" value={euro(x.startBonds)} sub={`verwacht ${pct(x.bondsMid)}`} />
          <Row label="Aandelen en beleggingen" value={euro(b.startInvest)} sub={`verwacht ${pct(b.returnMid)}`} />
          <Row label="Totaal" value={euro(total0)} strong />
          <Row label="Inleg per maand" value={euro(monthly0)} sub={`${euro(b.monthlySave)} sparen · ${euro(x.monthlyBonds)} obligaties · ${euro(b.monthlyInvest)} beleggen`} />
        </List>
        <Grid ids={["startSavings", "startBonds", "startInvest", "monthlySave", "monthlyBonds", "monthlyInvest", "contribGrowthPct"]} />
      </Block>

      <Block title={`Welke verdeling haalt ${euro(need)} in ${pu.year}?`} sub="Zelfde totaalbedrag en inleg, verschillende verdeling. De kans is het aandeel van de simulaties waarin je het haalt.">
        <ul className="space-y-3">
          {strategies.map((s) => (
            <li key={s.key} className="space-y-1.5 rounded-xl bg-gray-50 p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-base font-medium text-gray-900">{s.label}</span>
                <span className={`text-base font-semibold ${s.probEnough >= 0.8 ? "text-green-700" : s.probEnough >= 0.5 ? "text-amber-700" : "text-red-600"}`}>
                  {Math.round(s.probEnough * 100)}% kans
                </span>
              </div>
              <Bar value={s.probEnough * 100} max={100} color={s.probEnough >= 0.8 ? "bg-green-600" : s.probEnough >= 0.5 ? "bg-amber-500" : "bg-red-500"} />
              <p className="text-xs text-gray-500">{s.hint}</p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-gray-400">Tegenvallend</p>
                  <p className="text-sm font-medium text-gray-900">{euro(s.p10)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Midden</p>
                  <p className="text-sm font-medium text-gray-900">{euro(s.p50)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Meevallend</p>
                  <p className="text-sm font-medium text-gray-900">{euro(s.p90)}</p>
                </div>
              </div>
              {s.expectedShortfall > 1 && <p className="text-xs text-gray-500">Gemiddeld tekort in de mislukte verlopen: {euro(s.expectedShortfall)}.</p>}
            </li>
          ))}
        </ul>
        <Note>
          Tegenvallend is de slechtste 10% van de verlopen, meevallend de beste 10%. Met een korte horizon ({horizon.toFixed(1).replace(".", ",")} jaar) zie je dat aandelen een grotere spreiding geven: ze kunnen veel opleveren maar ook veel lager staan op het moment dat je moet kopen. Sparen heeft nauwelijks spreiding maar groeit langzamer dan de huizenprijs.
        </Note>
        {best && <p className="text-sm text-gray-700">In deze berekening heeft <strong>{best.label.toLowerCase()}</strong> de grootste kans om het bedrag te halen ({Math.round(best.probEnough * 100)}%). Het hangt sterk af van je aannames hieronder.</p>}
      </Block>

      <Block title="Het verloop met jouw verdeling" sub="Zonder inflatie (nominaal).">
        <LineChart
          labels={years.map((y) => String(y.year))}
          band={{ lo: years.map((y) => y.p10), hi: years.map((y) => y.p90), color: "#0f766e" }}
          lines={[
            { label: "midden", color: "#0f766e", values: years.map((y) => y.p50) },
            { label: "laag", color: "#6b7280", values: years.map((y) => r.sim.low[r.sim.checkpoints.indexOf(y.m)] ?? 0), dash: true },
            { label: "hoog", color: "#6b7280", values: years.map((y) => r.sim.high[r.sim.checkpoints.indexOf(y.m)] ?? 0), dash: true },
          ]}
          need={years.map((y) => y.need)}
        />
        <Legend
          items={[
            { color: "#0f766e", label: "Midden van de simulaties" },
            { color: "#6b7280", label: "Vast laag / hoog rendement", dash: true },
            { color: "#ef4444", label: "Wat je nodig hebt", dash: true },
          ]}
        />
        <p className="text-sm text-gray-700">
          In euro&apos;s van vandaag is {euro(r.sim.p50[r.sim.checkpoints.indexOf(T)] ?? 0)} straks ongeveer {euro((r.sim.p50[r.sim.checkpoints.indexOf(T)] ?? 0) / real)} waard, bij {pct(x.inflationPct)} inflatie.
        </p>
      </Block>

      <Block title="Inleg per jaar" sub="Wat je elk jaar per maand opzij zet. Pas een jaar aan om een verhoging of verlaging mee te nemen.">
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-2 py-2 font-medium">Jaar</th>
                <th className="px-2 py-2 font-medium">Sparen</th>
                <th className="px-2 py-2 font-medium">Obligaties</th>
                <th className="px-2 py-2 font-medium">Beleggen</th>
              </tr>
            </thead>
            <tbody>
              {firstYears.map((y) => {
                const c = contributionFor({ b, x, app }, y);
                const custom = Boolean(x.contrib[String(y)]);
                return (
                  <tr key={y} className="border-t border-gray-100">
                    <td className="px-2 py-2 font-medium text-gray-900">{y}</td>
                    {(["save", "bonds", "invest"] as const).map((k) => (
                      <td key={k} className="px-1.5 py-1.5">
                        <NumberBox value={Math.round(c[k])} onChange={(n) => setContrib(y, k, n)} className={custom ? "!border-teal-500 !bg-teal-50" : ""} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {Object.keys(x.contrib).length > 0 && (
          <button type="button" onClick={() => patchX((cur) => ({ ...cur, contrib: {} }))} className="min-h-[44px] text-sm text-red-600 underline">
            Aangepaste jaren wissen
          </button>
        )}
        <Note>Groen is door jou aangepast. De rest volgt uit je huidige inleg en de stijging per jaar.</Note>
      </Block>

      <Block title="Afbouwen voor de aankoop" sub="Een deel van het risico weghalen vlak voor je het geld nodig hebt.">
        <Grid ids={["glide", "glideYears"]} />
        <Note>
          Als je dit aanzet, schuift het plan in de laatste jaren stap voor stap geld van aandelen en obligaties naar de spaarrekening, en gaat nieuwe inleg ook naar sparen. Dan doet een beurscrash vlak voor de koop minder, maar je mist ook herstel. Probeer aan en uit om te zien wat het met de kans doet.
        </Note>
      </Block>

      <Block title="Wat het rendement kost aan belasting" sub="Box 3 over sparen en beleggen, geschat.">
        <List>
          <Row label="Box 3 tot de aankoop" value={euro(r.sim.box3Paid)} how="Over elk jaar rekent het plan 36% over het fictieve rendement boven het heffingsvrije bedrag, en haalt dat uit je spaargeld." />
          <Row label="Heffingsvrij per persoon" value={euro(x.box3.exemptPerPerson)} />
          <Row label="Aantal personen" value={String(x.box3Persons)} />
        </List>
      </Block>

      <Section title="Rendementen en schommeling" hint="Alle aannames van de simulatie">
        <Grid
          ids={[
            "savingsRate",
            "bondsLow",
            "bondsMid",
            "bondsHigh",
            "returnLow",
            "returnMid",
            "returnHigh",
            "volStocks",
            "volBonds",
            "correlation",
            "confidencePct",
          ]}
        />
        <Note>
          Het verwachte rendement is het gemiddelde waarrond de simulatie loopt; de schommeling bepaalt hoe wijd de verlopen uitwaaieren. Het lage en hoge rendement worden als vaste scenario&apos;s naast de simulatie getoond. Kosten van fondsen en transactiekosten zijn hier niet in verwerkt: trek ze af van het rendement dat je invult.
        </Note>
      </Section>
    </div>
  );
}
