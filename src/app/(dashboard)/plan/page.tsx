"use client";

import Link from "next/link";
import { Banner, Block, Grid, Legend, LineChart, List, Note, Row, Section, Stat, card, euro, pct } from "./ui";
import { usePlan } from "./plan-provider";
import { extraPerMonth } from "@/lib/plan/model";

export default function PlanOverview() {
  const { result: r, b, x, calculating, hasDoc } = usePlan();
  const pu = r.purchase;
  const T = r.targetMonth;
  const ti = r.sim.checkpoints.indexOf(T);
  const wealth = r.confidenceKey === "p10" ? r.sim.p10[ti] : r.sim.p50[ti];
  const conf = x.confidencePct;
  const extra = extraPerMonth(Math.max(0, r.shortfall), T, b.returnMid);
  const rows = r.years.filter((y) => y.m >= 0);

  return (
    <div className={`space-y-4 ${calculating ? "opacity-70" : ""}`}>
      {!hasDoc && (
        <Banner level="info" title="Dit is je startpunt">
          Het plan is vooringevuld met wat de app weet: je potjes, je studielening en je inkomsten en uitgaven van de laatste maanden. Loop de tabbladen langs en pas aan wat niet klopt. Bij elk getal staat waar het vandaan komt. Tik op het label om het te lezen.
        </Banner>
      )}

      <section className={`${card} space-y-4 p-5`}>
        <div>
          <p className="text-sm text-gray-500">
            Kopen in {pu.year} · {new Date(pu.date).toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}
          </p>
          <p className={`text-3xl font-semibold ${r.enough ? "text-green-700" : "text-red-600"}`}>
            {r.enough ? `Overschot van ${euro(-r.shortfall)}` : `Tekort van ${euro(r.shortfall)}`}
          </p>
          <p className="text-sm text-gray-500">
            Met {conf}% zekerheid heb je dan {euro(wealth)} tegenover {euro(pu.needTotal)} nodig. De kans dat het lukt is {Math.round(r.probEnough * 100)}%.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
          <Stat
            label="Woning in dat jaar"
            value={euro(pu.price)}
            sub={`nu ${euro(b.targetPrice)}, ${pct(x.priceGrowthPct)} stijging per jaar`}
            how={`Prijs nu ${euro(b.targetPrice)} × (1 + ${x.priceGrowthPct}%) ^ ${(T / 12).toFixed(1)} jaar.`}
          />
          <Stat
            label="Realistische hypotheek"
            value={euro(pu.loan)}
            sub={pu.loanMode}
            how={`De bank rekent met ${euro(pu.cap.counted)} bruto inkomen × ${pct(pu.cap.pct, 2)} = ${euro(pu.cap.maxMonthly)} per maand, min ${euro(pu.cap.obligations.total)} aan verplichtingen. Dat is ${euro(pu.cap.available)} per maand, over ${b.termYears} jaar tegen ${pct(pu.cap.rate, 2)}.`}
          />
          <Stat
            label="Eigen geld nodig"
            value={euro(pu.ownFunds)}
            sub={`${euro(pu.costsTotal)} kosten koper`}
            how={`Prijs ${euro(pu.price)} + verbouwing ${euro(pu.renovation)} + kosten koper ${euro(pu.costsTotal)} − hypotheek ${euro(pu.loan)}.`}
          />
          <Stat
            label="Plus buffer"
            value={euro(pu.buffer)}
            sub={`${x.bufferMonths} maanden aan vaste lasten`}
            how={`${x.bufferMonths} × (uitgaven ${euro(pu.otherSpending)} + hypotheek ${euro(pu.mortgage.monthly)} + woonlasten ${euro(pu.running.total)}) per maand.`}
          />
        </div>
        {!r.enough && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Om dit tekort te dichten heb je ongeveer {euro(extra)} extra per maand nodig, bij {pct(b.returnMid)} rendement.
          </p>
        )}
        {r.earliest && (
          <p className="text-sm text-gray-700">
            Vroegste jaar waarin het volgens het plan kan: <strong>{r.earliest.year}</strong>.
          </p>
        )}
      </section>

      <Link
        href="/plan/scenarios"
        className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-white px-5 py-3 ring-1 ring-gray-200 active:bg-gray-50"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium text-gray-900">Hoeveel moet ik per maand sparen?</span>
          <span className="block text-sm text-gray-500">Reken het uit per scenario en variant, en zie wat je in welk jaar kunt kopen.</span>
        </span>
        <span className="text-2xl text-gray-300">›</span>
      </Link>

      <Block title="Hoe je vermogen zich ontwikkelt" sub={`Het groene vlak loopt van de slechtste 10% tot de beste 10% van ${600} gesimuleerde verlopen. Rood is wat je nodig hebt.`}>
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
            { color: "#0f766e", label: "Verwacht (midden)" },
            { color: "#14b8a6", label: "Tegenvallend (slechtste 10%)", dash: true },
            { color: "#ef4444", label: "Wat je nodig hebt", dash: true },
          ]}
        />
      </Block>

      <section className="space-y-2">
        <h2 className="px-1 text-lg font-semibold text-gray-900">Meedenken</h2>
        {r.insights.map((i, k) => (
          <Banner key={k} level={i.level} title={i.title}>
            {i.text}
          </Banner>
        ))}
        <Note>Dit is een rekenhulp met eigen aannames en geen financieel advies. Een hypotheekadviseur kan het echte leenbedrag en de beste verdeling voor jouw situatie bepalen.</Note>
      </section>

      <Block title="Na de aankoop" sub="Wat het wonen per maand kost en wat er overblijft.">
        <List>
          <Row label="Netto inkomen per maand" value={euro(pu.netIncomeMonthly)} how={`Bruto ${euro(r.pay.find((p) => p.year === pu.year)?.gross ?? 0)} per jaar min belasting en pensioenpremie, gedeeld door 12. Zie het tabblad Inkomen en Belasting.`} />
          <Row label="Hypotheek bruto" value={euro(pu.mortgage.monthly)} sub={`${euro(pu.loan)} tegen ${pct(pu.cap.rate, 2)}`} how="Annuïteit over de looptijd: elke maand hetzelfde bedrag, de eerste jaren vooral rente." />
          <Row label="Terugkrijgen via hypotheekrenteaftrek" value={`− ${euro(pu.mortgage.relief.benefit / 12)}`} sub="per maand, in het eerste jaar" how={`Rente in jaar 1 ${euro(pu.mortgage.interestYear)} min eigenwoningforfait ${euro(pu.mortgage.relief.forfait)} = ${euro(pu.mortgage.relief.deductible)} aftrekbaar, tegen ${pct(pu.mortgage.relief.rate * 100, 2)}.`} />
          <Row label="Hypotheek netto" value={euro(pu.mortgage.netMonthly)} strong />
          <Row label="Overige woonlasten" value={euro(pu.running.total)} sub="onderhoud, OZB, water, verzekering, energie" how="Zie het tabblad Huis en kosten voor elk onderdeel." />
          <Row label="Je gebruikelijke uitgaven" value={euro(pu.otherSpending)} sub="zonder wonen" />
          <Row label="Blijft over per maand" value={euro(pu.surplus)} strong tone={pu.surplus >= 0 ? "good" : "bad"} />
        </List>
        <p className="text-sm text-gray-600">Vaste woonlasten zijn {Math.round(pu.woonquote)}% van je netto inkomen.</p>
      </Block>

      <Section title="Jaar voor jaar: wanneer kan het?" hint="Als je in dat jaar zou kopen" open>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-2 py-2 font-medium">Jaar</th>
                <th className="px-2 py-2 text-right font-medium">Nodig</th>
                <th className="px-2 py-2 text-right font-medium">Hypotheek</th>
                <th className="px-2 py-2 text-right font-medium">Tegenval</th>
                <th className="px-2 py-2 text-right font-medium">Midden</th>
                <th className="px-2 py-2 text-center font-medium">Lukt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((y) => (
                <tr key={y.m} className={`border-t border-gray-100 ${y.m === T ? "bg-teal-50" : ""}`}>
                  <td className="px-2 py-2 font-medium text-gray-900">{y.year}</td>
                  <td className="px-2 py-2 text-right">{euro(y.need)}</td>
                  <td className="px-2 py-2 text-right">{euro(y.loan)}</td>
                  <td className="px-2 py-2 text-right">{euro(y.p10)}</td>
                  <td className="px-2 py-2 text-right">{euro(y.p50)}</td>
                  <td className="px-2 py-2 text-center">{y.enough10 ? "✓" : y.enough50 ? "~" : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>✓ lukt ook bij tegenvallende rendementen (met {conf}% zekerheid). ~ lukt alleen als het rendement meezit. – lukt niet. Je streefjaar is gemarkeerd.</Note>
      </Section>

      <Section title="Speel met de belangrijkste getallen" hint="Alles werkt direct door in het plan">
        <Grid ids={["targetDate", "targetPrice", "incomeGrossYear", "monthlySave", "monthlyInvest", "monthlyBonds", "rate", "priceGrowthPct"]} />
      </Section>

      <p className="px-1 text-xs text-gray-400">
        Alle getallen, hun bronnen en de wettelijke regels staan op het tabblad <Link href="/plan/bronnen" className="underline">Bronnen</Link>.
      </p>
    </div>
  );
}
