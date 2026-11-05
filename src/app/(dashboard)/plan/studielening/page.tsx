"use client";

import Link from "next/link";
import { Banner, Block, Grid, Legend, LineChart, List, Note, Row, Stat, euro, pct } from "../ui";
import { usePlan } from "../plan-provider";
import { capacityAt, dateAtMonth } from "@/lib/plan/model";

export default function StudyLoanPage() {
  const { result: r, b, x, app } = usePlan();
  const s = app.study;
  const T = r.targetMonth;
  const pu = r.purchase;

  if (!s.hasLoan) {
    return (
      <div className="space-y-4">
        <Banner level="info" title="Geen studielening gevonden">
          Voeg je studielening toe onder <Link href="/settings/schulden" className="underline">Instellingen, Schulden en hypotheek</Link>. Dan rekent het plan met je echte saldo, rente en aflosfase.
        </Banner>
      </div>
    );
  }

  const input = { b, x, app };
  const at = Math.min(T, r.study.length - 1);
  const balanceT = r.study[at].balance;
  const withoutStudy = capacityAt(input, T, r.study, pu.price, 0, 0);
  const lost = Math.max(0, withoutStudy.loan - pu.cap.loan);
  const paidUntilT = r.study.slice(0, at + 1).reduce((sum, p) => sum + p.payment, 0);
  const growthFactor = Math.pow(1 + b.savingsRate / 100, T / 12);

  const payoffNow = s.balanceNow;
  const costNow = payoffNow * growthFactor - paidUntilT;
  const lastYear = Math.max(0, T - 12);
  const balanceLastYear = r.study[Math.min(lastYear, r.study.length - 1)].balance;
  const paidLastYear = r.study.slice(lastYear, at + 1).reduce((sum, p) => sum + p.payment, 0);
  const costLastYear = balanceLastYear * Math.pow(1 + b.savingsRate / 100, (T - lastYear) / 12) - paidLastYear;

  const rows = r.sim.checkpoints.map((m) => ({ m, label: String(dateAtMonth(x.startDate, m).getFullYear()), v: r.study[Math.min(m, r.study.length - 1)].balance }));
  const repayStartLabel = s.repayStart ? new Date(s.repayStart).toLocaleDateString("nl-NL", { month: "long", year: "numeric" }) : "onbekend";
  const monthly = s.monthlyPayment ?? s.estimatedMonthly;

  return (
    <div className="space-y-4">
      <Block title="Je studielening nu" sub={s.note}>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Openstaand" value={euro(s.balanceNow)} sub="inclusief rente tot nu, zonder prestatiebeurs" src="app" how="Uit je schulden: saldo per deel, met maandelijkse rente tot vandaag, min het deel dat een gift wordt." />
          <Stat label="Rente" value={pct(s.blendedRate, 2)} sub="gewogen gemiddelde" src="app" how="Gewogen gemiddelde van de rente van je delen." />
          <Stat label="Aflosfase begint" value={repayStartLabel} src="app" />
          <Stat label="Maandbedrag" value={monthly ? euro(monthly) : "onbekend"} sub={s.monthlyPayment ? "door DUO bepaald" : "geschat"} src="app" how={s.monthlyPayment ? "Het bedrag dat je bij Schulden hebt ingevuld." : `Geschat als annuïteit over ${s.termYears} jaar op het saldo bij aanvang van de aflosfase.`} />
        </div>
      </Block>

      <Block title="Verloop tot de aankoop" sub="Rente loopt door in de aanloopfase. Daarna lost het maandbedrag af.">
        <LineChart labels={rows.map((p) => p.label)} lines={[{ label: "schuld", color: "#b45309", values: rows.map((p) => p.v) }]} />
        <Legend items={[{ color: "#b45309", label: "Openstaande studieschuld" }]} />
        <p className="text-sm text-gray-700">
          Bij de aankoop in {pu.year} staat er nog <strong>{euro(balanceT)}</strong> open. Je hebt dan {euro(paidUntilT)} afgelost.
        </p>
      </Block>

      <Block title="Wat het met je hypotheek doet" sub={`Berekend voor ${pu.year}`}>
        <List>
          <Row label="Maandlast die de bank meetelt" value={euro(pu.cap.obligations.study)} how={`De hoogste van het echte maandbedrag en ${pct(x.studyFactorPct, 2)} van de openstaande schuld (${euro(balanceT)}). Banken tellen dit af van de ruimte voor je hypotheek.`} />
          <Row label="Hypotheek met studielening" value={euro(pu.cap.loan)} />
          <Row label="Hypotheek zonder studielening" value={euro(withoutStudy.loan)} />
          <Row label="De studielening kost je aan hypotheek" value={euro(lost)} strong tone={lost > 0 ? "bad" : "good"} how="Het verschil tussen de twee hierboven." />
        </List>
        <Note>Een vuistregel uit de bronnen: per €100 maandlast verlies je ongeveer €20.000 tot €30.000 aan hypotheek. De factor die de bank gebruikt verschilt per geldverstrekker.</Note>
      </Block>

      <Block title="Aflossen of laten lopen?" sub="Een indicatieve vergelijking. De ontwikkeling van rente en rendement is een aanname.">
        <List>
          <Row
            label="Nu volledig aflossen"
            value={lost > 0 ? `+${euro(lost)} hypotheek` : "geen effect"}
            sub={`kost je ${euro(costNow)} aan vermogen op het aankoopmoment`}
            how={`Je lost ${euro(payoffNow)} af. Dat geld had op een spaarrekening ${euro(payoffNow * growthFactor)} opgeleverd tot ${pu.year}, min de ${euro(paidUntilT)} die je aan DUO nog zou betalen. Ervoor krijg je ongeveer ${euro(lost)} meer hypotheek, omdat de bank de maandlast niet meer meetelt.`}
          />
          <Row
            label="Een jaar voor de aankoop aflossen"
            value={lost > 0 ? `+${euro(lost)} hypotheek` : "geen effect"}
            sub={`kost ${euro(costLastYear)} aan vermogen`}
            how={`Je lost dan nog ${euro(balanceLastYear)} af. Je bent minder lang kwijt aan gemiste rente, en je moet zeker weten dat de bank de lening niet langer meetelt (de aflossing moet vóór de aanvraag staan).`}
          />
          <Row label="Laten lopen" value="geen extra geld nodig" sub="je houdt je spaargeld" />
        </List>
        <p className="text-sm text-gray-700">
          Per €1 die je aflost win je ongeveer <strong>{payoffNow > 0 ? euro(lost / payoffNow, 2) : "€0"}</strong> aan hypotheek. De DUO-rente ({pct(s.blendedRate, 2)}) is {s.blendedRate > b.savingsRate ? "hoger" : "lager"} dan je spaarrente ({pct(b.savingsRate)}) en {s.blendedRate > b.returnMid ? "hoger" : "lager"} dan het verwachte rendement op aandelen ({pct(b.returnMid)}).
        </p>
        <Note>Een lagere hypotheekrente dan de DUO-rente zou een extra reden zijn om af te lossen. Zorg dat je een buffer overhoudt: afgeloste schuld krijg je niet terug.</Note>
      </Block>

      <Block title="Probeer het zelf" sub="Hiermee verandert het hele plan, ook de overzichtspagina.">
        <Grid ids={["studyExtraRepay", "studyRepayYear", "studyFactorPct", "studyOriginal"]} />
        <Note>
          Het bedrag dat je extra aflost gaat in dat jaar van je spaargeld af (en zo nodig van obligaties en beleggingen) en van je schuld. Het plan rekent daarna met de lagere schuld en de hogere hypotheek.
        </Note>
      </Block>

      <Block title="Wat het plan over je studielening weet">
        <List>
          <Row label="Looptijd aflosfase" value={`${s.termYears} jaar`} />
          <Row label="Oorspronkelijke schuld" value={euro(x.studyOriginal > 0 ? x.studyOriginal : s.originalDebt)} sub={x.studyOriginal > 0 ? "jouw invoer" : "uit je schulden"} />
          <Row label="In box 3 telt de schuld mee" value={euro(Math.max(0, s.balanceNow - x.box3.debtThresholdPerPerson * x.box3Persons))} sub="boven de drempel, tegen een fictieve rente" />
        </List>
        <Note>Het inkomensafhankelijke deel van DUO (het maandbedrag past zich aan bij een laag inkomen) en de kwijtschelding na de looptijd zijn niet apart meegerekend.</Note>
      </Block>
    </div>
  );
}
