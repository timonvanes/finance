"use client";

import { Banner, Block, Grid, Legend, LineChart, List, Note, Row, Section, Stat, euro, pct } from "../ui";
import { usePlan } from "../plan-provider";
import { capacityAt, mortgageCosts, purchaseAt, runningAt } from "@/lib/plan/model";
import { monthlyForLoan } from "@/lib/house/calc";
import { nhgLimit } from "@/lib/plan/tax";

export default function MortgagePage() {
  const { result: r, b, x, app } = usePlan();
  const T = r.targetMonth;
  const pu = r.purchase;
  const input = { b, x, app };
  const c = pu.cap;
  const nhgMax = nhgLimit(pu.year, x.limitGrowthPct);

  // the three ways of deciding how much to borrow, side by side
  const modes = (["max", "comfort", "fixed"] as const).map((mode) => {
    const p = purchaseAt({ b, x: { ...x, borrowMode: mode, borrowFixed: x.borrowFixed > 0 ? x.borrowFixed : pu.price * 0.6 }, app }, T, r.study);
    const label = mode === "max" ? "Zoveel als de bank geeft" : mode === "comfort" ? `Binnen ${x.comfortPct}% woonquote` : "Vast bedrag";
    return { mode, label, p };
  });

  // interest rate sensitivity
  const shocks = [-1, 0, 1, 2];
  const sens = shocks.map((sh) => {
    const cap = capacityAt(input, T, r.study, pu.price, sh);
    const loan = Math.min(cap.loan, pu.maxLtv);
    const m = mortgageCosts(input, loan, cap.rate, pu.year, pu.price, 0.3756);
    return { sh, rate: cap.rate, loan, monthly: m.monthly, net: m.netMonthly, ownFunds: Math.max(0, pu.price + pu.renovation + pu.costsTotal - loan) };
  });

  // annuity versus linear
  const linearFirst = pu.loan / (b.termYears * 12) + (pu.loan * pu.cap.rate) / 100 / 12;
  const linearAt10 = (pu.loan * (1 - 120 / (b.termYears * 12))) * (pu.cap.rate / 100 / 12) + pu.loan / (b.termYears * 12);
  const annuity = monthlyForLoan(pu.loan, pu.cap.rate, b.termYears);

  const years = r.years.filter((y) => y.m >= 0);
  const run = runningAt(input, T, pu.price);
  void run;

  return (
    <div className="space-y-4">
      <Banner level="info" title={`Realistisch te lenen in ${pu.year}: ongeveer ${euro(pu.cap.loan)}`}>
        Dit is de schatting van wat een bank zou toestaan op basis van je inkomen, je verplichtingen en de normen van het Nibud. Een adviseur kan het exacte bedrag vaststellen. Je kunt ook voor minder kiezen: kijk hieronder wat je comfortabel kunt dragen.
      </Banner>

      <Block title="Zo komt de bank aan dit bedrag" sub="Elke stap is aan te passen. Tik op een regel voor de berekening.">
        <List>
          <Row label="Bruto inkomen dat meetelt" value={euro(c.counted)} how={`Jouw bruto salaris in ${pu.year}${x.buyingTogether ? " plus dat van je partner" : ""}, elk vermenigvuldigd met de factor van het contract (vast 100%, tijdelijk 85%, zelfstandige 80%).`} />
          <Row label="Toegestaan deel van je bruto inkomen" value={pct(c.pct, 2)} how="De financieringslast uit de Nibud-normen. Het plan schat dit uit drie bekende punten. Vul je eigen percentage in onder Aannames als je het van je adviseur weet." />
          <Row label="Maximale hypotheekmaandlast" value={euro(c.maxMonthly)} how={`${euro(c.counted)} × ${pct(c.pct, 2)} gedeeld door 12.`} strong />
          {c.obligations.study > 0 && <Row label="Min: studielening" value={`− ${euro(c.obligations.study)}`} />}
          {c.obligations.loans > 0 && <Row label="Min: andere leningen" value={`− ${euro(c.obligations.loans)}`} />}
          {c.obligations.credit > 0 && <Row label="Min: kredietlimieten (2%)" value={`− ${euro(c.obligations.credit)}`} />}
          {c.obligations.lease > 0 && <Row label="Min: autolease" value={`− ${euro(c.obligations.lease)}`} />}
          {c.obligations.alimony > 0 && <Row label="Min: alimentatie" value={`− ${euro(c.obligations.alimony)}`} />}
          <Row label="Ruimte voor hypotheek per maand" value={euro(c.available)} strong />
          <Row label="Rente waarmee gerekend wordt" value={pct(c.rate, 2)} how={`Hypotheekrente ${pct(b.rate, 2)}${c.nhg ? `, min ${pct(x.nhgRateDiscount, 2)} NHG-korting` : ""}${x.testRate > 0 ? `. Toetsrente ${pct(x.testRate, 2)}` : ""}.`} />
          <Row label="Ter vergelijking: vuistregel 4,25 × bruto" value={euro(c.counted * 4.25)} how="Een snelle schatting die vaak wordt gebruikt. Het rekenmodel hierboven houdt rekening met de rente, de looptijd en je verplichtingen." />
          <Row label="Hypotheek die de bank geeft" value={euro(c.loan)} strong tone="good" how={`Wat ${euro(c.available)} per maand over ${b.termYears} jaar tegen ${pct(c.rate, 2)} aan lening kan dragen.`} />
        </List>
        <Note>NHG: {c.nhg ? `ja, de koopsom ligt onder de grens van ${euro(nhgMax)}` : `nee, de koopsom ligt boven de grens van ${euro(nhgMax)} of NHG staat uit`}.</Note>
      </Block>

      <Block title="Bank tegenover comfortabel" sub="Lenen kan meer zijn dan je wilt dragen. Zo verschillen de keuzes.">
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-2 py-2 font-medium" />
                {modes.map((m) => (
                  <th key={m.mode} className="px-2 py-2 text-right font-medium">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Hypotheek", (p: typeof pu) => euro(p.loan)],
                ["Maandlast bruto", (p: typeof pu) => euro(p.mortgage.monthly)],
                ["Maandlast netto", (p: typeof pu) => euro(p.mortgage.netMonthly)],
                ["Vaste woonquote", (p: typeof pu) => `${Math.round(p.woonquote)}%`],
                ["Blijft over p/m", (p: typeof pu) => euro(p.surplus)],
                ["Eigen geld nodig", (p: typeof pu) => euro(p.ownFunds)],
              ].map(([label, f]) => (
                <tr key={label as string} className="border-t border-gray-100">
                  <td className="px-2 py-2 text-gray-600">{label as string}</td>
                  {modes.map((m) => (
                    <td key={m.mode} className="px-2 py-2 text-right">
                      {(f as (p: typeof pu) => string)(m.p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Grid ids={["borrowMode", "comfortPct", "borrowFixed"]} cols={1} />
        <Note>Je gekozen manier telt nu mee in het hele plan: {pu.loanMode.toLowerCase()}.</Note>
      </Block>

      <Block title="Als de rente anders is" sub={`Stresstest rond ${pct(b.rate, 2)}`}>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[440px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-2 py-2 font-medium">Rente</th>
                <th className="px-2 py-2 text-right font-medium">Max. hypotheek</th>
                <th className="px-2 py-2 text-right font-medium">Maandlast netto</th>
                <th className="px-2 py-2 text-right font-medium">Eigen geld</th>
              </tr>
            </thead>
            <tbody>
              {sens.map((s) => (
                <tr key={s.sh} className={`border-t border-gray-100 ${s.sh === 0 ? "bg-teal-50" : ""}`}>
                  <td className="px-2 py-2 font-medium text-gray-900">
                    {pct(s.rate, 2)} <span className="text-xs font-normal text-gray-400">{s.sh === 0 ? "nu" : `${s.sh > 0 ? "+" : ""}${s.sh} pt`}</span>
                  </td>
                  <td className="px-2 py-2 text-right">{euro(s.loan)}</td>
                  <td className="px-2 py-2 text-right">{euro(s.net)}</td>
                  <td className="px-2 py-2 text-right">{euro(s.ownFunds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>Bij een hogere rente leen je minder, en moet je meer zelf inleggen. De rente die je vastzet voor 10 of 20 jaar zorgt dat je maandlast zeker is.</Note>
      </Block>

      <Block title="Hypotheek per jaar dat je zou kopen" sub="Wachten verhoogt je inkomen, maar de woning wordt ook duurder.">
        <LineChart
          labels={years.map((y) => String(y.year))}
          lines={[
            { label: "hypotheek", color: "#0f766e", values: years.map((y) => y.loan) },
            { label: "prijs", color: "#6b7280", values: years.map((y) => y.price) },
          ]}
        />
        <Legend items={[{ color: "#0f766e", label: "Hypotheek die de bank geeft" }, { color: "#6b7280", label: "Prijs van de woning" }]} />
      </Block>

      <Block title="Annuïteit of lineair" sub="Twee manieren om af te lossen.">
        <List>
          <Row label="Annuïtair, elke maand" value={euro(annuity)} how="Elke maand hetzelfde bedrag. In het begin vooral rente, later vooral aflossing." />
          <Row label="Lineair, eerste maand" value={euro(linearFirst)} how="Elke maand dezelfde aflossing plus rente over wat er nog openstaat." />
          <Row label="Lineair, na 10 jaar" value={euro(linearAt10)} sub="de maandlast daalt elk jaar" />
        </List>
        <Note>Lineair is in het begin duurder maar loopt dalen en kost over de hele looptijd minder rente. Voor de hypotheekrenteaftrek is een aflossingsvrij deel niet meer toegestaan voor nieuwe hypotheken.</Note>
      </Block>

      <Section title="Aannames voor de hypotheek" hint="Rente, looptijd, verplichtingen en NHG">
        <Grid ids={["rate", "termYears", "nhgMode", "nhgRateDiscount", "reliefFactorPct", "finPctOverride", "testRate", "rateShock", "otherLoanMonth", "creditLimit", "leaseMonth", "alimonyMonth"]} />
      </Section>

      <Stat label="Totaal eigen geld in beeld" value={euro(pu.ownFunds)} sub={`plus buffer ${euro(pu.buffer)}`} />
    </div>
  );
}
