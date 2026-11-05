"use client";

import { useState } from "react";
import { Banner, Block, Grid, List, Note, Row, Section, euro, pct } from "../ui";
import { usePlan } from "../plan-provider";
import { LAW_YEAR, box3Tax } from "@/lib/plan/tax";
import type { NetResult } from "@/lib/plan/tax";

function Person({ title, n }: { title: string; n: NetResult }) {
  return (
    <List>
      <Row label={`${title}, bruto per jaar`} value={euro(n.gross)} strong />
      <Row label="Pensioenpremie" value={`− ${euro(n.pension)}`} how="Je eigen bijdrage aan pensioen. Die is aftrekbaar, je betaalt er geen belasting over." />
      <Row label="Belastbaar inkomen box 1" value={euro(n.taxable)} />
      <Row label="Schijf 1 (35,75%)" value={euro(n.brackets.s1)} sub="belasting over het eerste deel, tot €38.883" how="In 2026 is het tarief in de eerste schijf 35,75% (inclusief premies volksverzekeringen). Na 2026 gaat het plan uit van meeverhogen van de schijfgrenzen." />
      <Row label="Schijf 2 (37,56%)" value={euro(n.brackets.s2)} sub="tot €78.426" />
      <Row label="Schijf 3 (49,50%)" value={euro(n.brackets.s3)} sub="boven €78.426" />
      <Row label="Belasting vóór kortingen" value={euro(n.taxBeforeCredits)} />
      <Row label="Algemene heffingskorting" value={`− ${euro(n.generalCredit)}`} how="Maximaal €3.115. Wordt afgebouwd met 6,398% van je inkomen boven €29.736 en is nul vanaf €78.426." />
      <Row label="Arbeidskorting" value={`− ${euro(n.labourCredit)}`} how="Een korting voor wie werkt. Loopt op tot ongeveer €45.000 en wordt daarna afgebouwd. Maximaal ca. €5.712 (controleer: bronnen noemen €5.685 of €5.712)." />
      <Row label="Te betalen belasting" value={euro(n.tax)} strong />
      <Row label="Netto per jaar" value={euro(n.net)} strong tone="good" sub={`${euro(n.net / 12)} per maand`} />
      <Row label="Gemiddelde belastingdruk" value={pct(n.avgRate * 100)} how="Te betalen belasting gedeeld door bruto." />
      <Row label="Over een extra euro" value={pct(n.marginalRate * 100)} how="Het schijftarief plus de heffingskortingen die je kwijtraakt als je inkomen stijgt. Zo betaal je in het deel van €43.000 tot €78.000 ongeveer 50% over elke extra euro." />
    </List>
  );
}

export default function TaxPage() {
  const { result: r, x, b, app } = usePlan();
  const [year, setYear] = useState(r.purchase.year);
  const row = r.pay.find((p) => p.year === year) ?? r.pay[0];
  const pu = r.purchase;

  const totalTax = r.pay.filter((p) => p.year >= r.startYear && p.year <= pu.year).reduce((s, p) => s + p.tax, 0);
  const totalGross = r.pay.filter((p) => p.year >= r.startYear && p.year <= pu.year).reduce((s, p) => s + p.gross, 0);
  const studyDebtNow = app.study.hasLoan ? app.study.balanceNow : 0;
  const b3 = box3Tax(b.startSavings, b.startInvest + x.startBonds, studyDebtNow, x.box3Persons, x.box3);

  return (
    <div className="space-y-4">
      <Banner level="info" title={`Regels van ${LAW_YEAR}`}>
        Belastingschijven, heffingskortingen, box 3, overdrachtsbelasting en NHG komen uit de regels van {LAW_YEAR}. Voor latere jaren gaat het plan uit van meestijgen met de indexatie die je instelt. Bij Bronnen staat waar elk getal vandaan komt en waar bronnen elkaar tegenspraken.
      </Banner>

      <Block title="Wat belasting je kost tot de aankoop" sub={`Van ${r.startYear} tot en met ${pu.year}`}>
        <List>
          <Row label="Inkomstenbelasting (alle jaren)" value={euro(totalTax)} how={`Som van de te betalen belasting per jaar. Gemiddeld ${totalGross > 0 ? pct((totalTax / totalGross) * 100) : "0%"} van je bruto inkomen.`} />
          <Row label="Box 3 (sparen en beleggen)" value={euro(r.sim.box3Paid)} how="Vermogensbelasting over de fictieve rendementen boven het heffingsvrije bedrag, geschat in het verwachte verloop." />
          <Row label={`Overdrachtsbelasting in ${pu.year}`} value={euro(pu.transfer.tax)} sub={pu.transfer.note} />
          <Row label="Hypotheekrenteaftrek, eerste jaar" value={`+ ${euro(pu.mortgage.relief.benefit)}`} sub="geld dat je terugkrijgt" tone="good" />
        </List>
      </Block>

      <Block title="Belasting per jaar" sub="Kies een jaar om de volledige berekening te zien.">
        <div className="flex flex-wrap gap-2">
          {r.pay
            .filter((p) => p.year <= pu.year + 2)
            .map((p) => (
              <button
                key={p.year}
                type="button"
                onClick={() => setYear(p.year)}
                className={`min-h-[40px] rounded-full px-4 text-sm ${p.year === year ? "bg-teal-700 font-medium text-white" : "bg-white text-gray-700 ring-1 ring-gray-200"}`}
              >
                {p.year}
              </button>
            ))}
        </div>
        <Person title="Jij" n={row.netYou} />
        {row.netPartner && <Person title="Partner" n={row.netPartner} />}
        <Note>De zorgverzekering, de eigen bijdrage Zvw en toeslagen (zorg, huur) zijn niet meegenomen.</Note>
      </Block>

      <Block title="Belastingdruk over de jaren">
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-2 py-2 font-medium">Jaar</th>
                <th className="px-2 py-2 text-right font-medium">Bruto</th>
                <th className="px-2 py-2 text-right font-medium">Belasting</th>
                <th className="px-2 py-2 text-right font-medium">Gemiddeld</th>
                <th className="px-2 py-2 text-right font-medium">Extra euro</th>
              </tr>
            </thead>
            <tbody>
              {r.pay
                .filter((p) => p.year <= pu.year + 2)
                .map((p) => (
                  <tr key={p.year} className="border-t border-gray-100">
                    <td className="px-2 py-2 font-medium text-gray-900">{p.year}</td>
                    <td className="px-2 py-2 text-right">{euro(p.gross)}</td>
                    <td className="px-2 py-2 text-right">{euro(p.tax)}</td>
                    <td className="px-2 py-2 text-right">{pct(p.avgRate * 100)}</td>
                    <td className="px-2 py-2 text-right">{pct(p.marginalRate * 100)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block title={`Hypotheekrenteaftrek in ${pu.year}`} sub="Wat je terugkrijgt over de rente die je betaalt.">
        <List>
          <Row label="Hypotheek" value={euro(pu.loan)} />
          <Row label="Rente in het eerste jaar" value={euro(pu.mortgage.interestYear)} how={`${euro(pu.loan)} tegen ${pct(pu.cap.rate, 2)}, annuïtair, de rente van de eerste twaalf maanden.`} />
          <Row label="Eigenwoningforfait" value={`− ${euro(pu.mortgage.relief.forfait)}`} how={`${pct(x.ewfPct, 2)} van de WOZ-waarde ${euro(pu.mortgage.woz)}. Dit tel je als inkomen mee omdat je in je eigen huis woont.`} />
          <Row label="Aftrekbaar bedrag" value={euro(pu.mortgage.relief.deductible)} />
          <Row label="Tarief van de aftrek" value={pct(pu.mortgage.relief.rate * 100, 2)} how="Maximaal 37,56%, het tarief van de tweede schijf, ook al betaal je zelf meer over de laatste euro's." />
          <Row label="Belasting die je terugkrijgt" value={euro(pu.mortgage.relief.benefit)} strong tone="good" sub={`${euro(pu.mortgage.relief.benefit / 12)} per maand`} />
        </List>
        <Note>Alleen voor een annuïtaire of lineaire hypotheek van maximaal 30 jaar. Als de hypotheek bijna is afgelost en de rente lager is dan het forfait, wordt de aftrek een bijtelling.</Note>
      </Block>

      <Block title="Overdrachtsbelasting en startersvrijstelling" sub={`In ${pu.year}`}>
        <List>
          <Row label="Koopsom" value={euro(pu.price)} />
          <Row label="Leeftijd bij levering" value={pu.ages.map((a) => `${a} jaar`).join(" en ")} how="Geboortejaar in het tabblad Huis en kosten. De vrijstelling geldt van 18 tot en met 34 jaar op de dag van de levering." />
          <Row label="Grens startersvrijstelling" value={euro(pu.transfer.limit)} how="€555.000 in 2026, €615.000 voor 2027, daarna volgens je ingestelde stijging per jaar." />
          <Row label="Overdrachtsbelasting" value={euro(pu.transfer.tax)} strong sub={pu.transfer.note} />
        </List>
      </Block>

      <Block title="Box 3 nu" sub="Belasting over je vermogen, op de stand van vandaag.">
        <List>
          <Row label="Sparen" value={euro(b.startSavings)} />
          <Row label="Obligaties en beleggingen" value={euro(b.startInvest + x.startBonds)} />
          {studyDebtNow > 0 && <Row label="Studielening (schuld)" value={`− ${euro(studyDebtNow)}`} sub={`telt pas mee boven ${euro(x.box3.debtThresholdPerPerson * x.box3Persons)}`} />}
          <Row label="Heffingsvrij" value={`− ${euro(x.box3.exemptPerPerson * x.box3Persons)}`} />
          <Row label="Fictief rendement" value={pct(b3.effectivePct, 2)} how="Gewogen gemiddelde van de percentages voor sparen, beleggen en schulden." />
          <Row label="Box 3 belasting per jaar" value={euro(b3.tax)} strong />
        </List>
        <Note>De overheid stapt vanaf 2028 mogelijk over op belasting over het werkelijke rendement. Dat is hier niet verwerkt.</Note>
      </Block>

      <Section title="Belastingaannames aanpassen">
        <Grid
          ids={[
            "taxIndexPct",
            "pensionPct",
            "partnerPensionPct",
            "ewfPct",
            "box3.savingsReturnPct",
            "box3.otherReturnPct",
            "box3.debtReturnPct",
            "box3.exemptPerPerson",
            "box3.debtThresholdPerPerson",
            "box3.ratePct",
            "box3Persons",
          ]}
        />
      </Section>
    </div>
  );
}
