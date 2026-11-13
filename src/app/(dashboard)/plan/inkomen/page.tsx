"use client";

import { Banner, Block, Grid, Legend, LineChart, Note, euro } from "../ui";
import { usePlan } from "../plan-provider";
import { SalaryEditor } from "../plan-editors";

export default function IncomePage() {
  const { result: r } = usePlan();
  const rows = r.pay.filter((p) => p.year <= r.purchase.year + 3);

  return (
    <div className="space-y-4">
      <Banner level="info" title="Bruto salaris per jaar tot het doel">
        Het plan rekent met je salaris per jaar. Vul zelf een bedrag in voor een jaar waarvan je meer weet (een promotie, een nieuwe baan, een stap in de cao). De jaren erna groeien daar weer vanuit. Wat je niet invult, volgt uit de groei per jaar.
      </Banner>

      <Block title="Nu" sub="Het startpunt van je inkomen.">
        <Grid
          ids={[
            "incomeGrossYear",
            "partnerIncomeGrossYear",
            "salaryGrowthPct",
            "partnerGrowthPct",
            "pensionPct",
            "partnerPensionPct",
            "taxIndexPct",
            "fixedExtraPct",
            "bonusPct",
            "leaseTaxableYear",
          ]}
        />
        <Note>
          Vul het bruto jaarinkomen in zoals het op je jaaropgave staat, inclusief vakantiegeld. De pensioenpremie is wat jij zelf betaalt; die gaat van je bruto af voordat de belasting wordt berekend.
        </Note>
      </Block>

      <Block title="Salaris per jaar" sub="Tik op een bedrag om het te veranderen. Een aangepast jaar is gemarkeerd.">
        <SalaryEditor />
      </Block>

      <Block title="Bruto en netto" sub="Hoeveel van je salaris je overhoudt.">
        <LineChart
          labels={rows.map((p) => String(p.year))}
          lines={[
            { label: "bruto", color: "#6b7280", values: rows.map((p) => p.gross) },
            { label: "netto", color: "#0f766e", values: rows.map((p) => p.net) },
          ]}
        />
        <Legend
          items={[
            { color: "#6b7280", label: "Bruto per jaar" },
            { color: "#0f766e", label: "Netto per jaar" },
          ]}
        />
        <Note>
          Netto is wat er na belasting en pensioenpremie overblijft. De zorgverzekering (ongeveer €1.800 tot €2.200 per jaar) en toeslagen zijn hier niet in verwerkt.
        </Note>
      </Block>

      <Block title="Hoe banken je inkomen zien" sub="Het deel van je inkomen dat voor de hypotheek meetelt.">
        <Grid ids={["contractYou", "contractPartner", "buyingTogether"]} />
        <p className="text-sm text-gray-700">
          Banken tellen een vast contract voor 100%, een tijdelijk contract voor ongeveer 85% (zonder werkgeversverklaring) en een zelfstandige voor het gemiddelde van drie jaar; het plan rekent met 80%. Dit zijn schattingen. Bruto jaarinkomen dat de bank in {r.purchase.year} meetelt: {euro(r.purchase.cap.counted)}.
        </p>
      </Block>
    </div>
  );
}
