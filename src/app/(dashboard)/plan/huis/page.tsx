"use client";

import { Block, Grid, List, Note, NumberBox, Row, Section, euro, pct } from "../ui";
import { usePlan } from "../plan-provider";
import type { PlanEvent } from "@/lib/plan/types";

function Events() {
  const { x, patchX } = usePlan();
  const set = (id: string, p: Partial<PlanEvent>) =>
    patchX((cur) => ({ ...cur, events: cur.events.map((e) => (e.id === id ? { ...e, ...p } : e)) }));
  return (
    <div className="space-y-3">
      {x.events.length === 0 && (
        <Note>Nog geen gebeurtenissen. Denk aan een bruiloft, een auto, een schenking van je ouders, een bonus of erfenis.</Note>
      )}
      {x.events.map((e) => (
        <div key={e.id} className="space-y-2 rounded-xl bg-gray-50 p-3">
          <input
            value={e.label}
            onChange={(ev) => set(e.id, { label: ev.target.value })}
            placeholder="Omschrijving, bijvoorbeeld schenking ouders"
            className="min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberBox value={e.amount} onChange={(n) => set(e.id, { amount: n })} unit="€" placeholder="+ erbij, − eruit" />
            <NumberBox value={e.year} onChange={(n) => set(e.id, { year: Math.round(n) })} unit="jaar" />
          </div>
          <button
            type="button"
            onClick={() => patchX((cur) => ({ ...cur, events: cur.events.filter((v) => v.id !== e.id) }))}
            className="min-h-[40px] text-sm text-red-600 underline"
          >
            Verwijderen
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          patchX((cur) => ({
            ...cur,
            events: [...cur.events, { id: crypto.randomUUID(), label: "", amount: 0, year: Number(cur.startDate.slice(0, 4)) + 1 }],
          }))
        }
        className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white text-base font-medium text-gray-900 active:bg-gray-50"
      >
        + Gebeurtenis toevoegen
      </button>
      <Note>
        Een positief bedrag komt in het midden van het jaar bij je spaargeld, een negatief bedrag gaat eraf. De schenkingsbelasting is hier niet in verwerkt.
      </Note>
    </div>
  );
}

export default function HousePage() {
  const { result: r, x } = usePlan();
  const pu = r.purchase;
  return (
    <div className="space-y-4">
      <Block title="Doel en woning" sub="Waar het plan naartoe rekent.">
        <Grid
          ids={[
            "targetDate",
            "targetPrice",
            "priceGrowthPct",
            "bidPct",
            "inflationPct",
            "newBuild",
            "renovation",
            "energyLoan",
            "wozPct",
            "ewfPct",
            "bufferMonths",
            "limitGrowthPct",
          ]}
        />
        <Note>
          De prijs groeit mee met de prijsstijging. In {pu.year} kost deze woning {euro(pu.price)}. De WOZ-waarde is dan {euro(pu.mortgage.woz)}.
        </Note>
      </Block>

      <Block title="Wat het kost bij de aankoop" sub={`In ${pu.year}, in euro's van dat jaar. Tik op een regel voor de berekening.`}>
        <List>
          <Row label="Vraagprijs" value={euro(pu.price)} />
          {pu.bid > 0 && <Row label="Overbod" value={euro(pu.bid)} how={`${x.bidPct}% boven de vraagprijs. De bank leent op de taxatiewaarde (ongeveer de vraagprijs), dus dit komt uit je eigen geld.`} />}
          {pu.renovation > 0 && <Row label="Verbouwing" value={euro(pu.renovation)} />}
          {pu.costItems.map((c) => (
            <Row
              key={c.key}
              label={c.label}
              value={euro(c.amount)}
              how={`Je invoer in euro's van vandaag, met ${x.inflationPct}% inflatie per jaar tot ${pu.year}.`}
            />
          ))}
          <Row
            label="Overdrachtsbelasting"
            value={euro(pu.transfer.tax)}
            sub={pu.transfer.note}
            how={`Koper(s) zijn ${pu.ages.join(" en ")} jaar bij de levering. De grens voor de startersvrijstelling is ${euro(pu.transfer.limit)}. Over het deel zonder vrijstelling betaal je 2% van de koopprijs.`}
          />
          <Row label="NHG-borgtochtprovisie" value={euro(pu.nhgFee)} sub={pu.cap.nhg ? "0,4% van de hypotheek" : "geen NHG"} />
          <Row label="Totaal kosten koper" value={euro(pu.costsTotal)} strong how="Alle regels hierboven, behalve koopprijs en verbouwing." />
          <Row label="Af: hypotheek" value={`− ${euro(pu.loan)}`} sub={pu.loanMode} />
          <Row label="Eigen geld nodig" value={euro(pu.ownFunds)} strong />
          <Row label={`Buffer (${x.bufferMonths} maanden)`} value={euro(pu.buffer)} />
          <Row label="Totaal wat je nodig hebt" value={euro(pu.needTotal)} strong />
        </List>
      </Block>

      <Section title="Kosten koper aanpassen" hint="Elk onderdeel is een aanname die je kunt aanpassen">
        <Grid
          ids={[
            "cost.notary",
            "cost.valuation",
            "cost.advice",
            "cost.bankFee",
            "cost.buyerAgent",
            "cost.inspection",
            "cost.bankGuarantee",
            "cost.moving",
            "cost.furnishing",
            "cost.other",
          ]}
        />
        <Note>Een deel van de advieskosten en de afsluitprovisie hangt af van wat jouw adviseur rekent. Vraag om een offerte en pas de bedragen aan.</Note>
      </Section>

      <Block title="Woonlasten per maand na de aankoop" sub="Wat het huis kost, naast de hypotheek.">
        <List>
          <Row label="Onderhoud" value={euro(pu.running.maintenance)} how={`${pct(x.running.maintenancePct)} van de prijs per jaar, gedeeld door 12.`} />
          <Row label="OZB" value={euro(pu.running.ozb)} how={`${pct(x.running.ozbPct, 2)} van de WOZ-waarde per jaar.`} />
          <Row label="Waterschap, riool en afval" value={euro(pu.running.water)} />
          <Row label="Verzekeringen" value={euro(pu.running.insurance)} />
          <Row label="Energie en water" value={euro(pu.running.energy)} />
          {pu.running.vve > 0 && <Row label="VvE" value={euro(pu.running.vve)} />}
          {pu.running.groundRent > 0 && <Row label="Erfpacht" value={euro(pu.running.groundRent)} />}
          <Row label="Totaal" value={euro(pu.running.total)} strong />
        </List>
        <Grid
          ids={[
            "run.maintenancePct",
            "run.ozbPct",
            "run.waterYear",
            "run.insuranceMonth",
            "run.energyMonth",
            "run.vveMonth",
            "run.groundRentMonth",
          ]}
        />
      </Block>

      <Block title="Nu en straks" sub="Je huidige kosten tegenover straks.">
        <Grid ids={["rentNow", "otherSpendingMonth"]} />
        {x.rentNow > 0 ? (
          <Note>
            Netto woonlast zonder energie: {euro(pu.housingVsRent)} per maand, tegenover {euro(x.rentNow)} huur nu. In de woonlast zit {euro(pu.mortgage.principalYear / 12)} aflossing per maand, die je als eigen vermogen houdt.
          </Note>
        ) : (
          <Note>Vul je huidige woonkosten in om te zien wat de koop per maand scheelt.</Note>
        )}
      </Block>

      <Block title="Gebeurtenissen tot de aankoop" sub="Eenmalige bedragen die je spaargeld raken.">
        <Events />
      </Block>

      <Section title="Personen en contract" hint="Voor de startersvrijstelling en hoe banken je inkomen tellen">
        <Grid ids={["birthYear", "buyingTogether", "partnerBirthYear", "sharePctYou", "contractYou", "contractPartner", "partnerStartYear", "partnerStartSavings", "partnerStartInvest", "partnerMonthlySave", "partnerMonthlyInvest"]} />
      </Section>
    </div>
  );
}
