"use client";

import { Banner, Block, Grid, Legend, LineChart, Note, NumberBox, SrcBadge, euro, pct } from "../ui";
import { usePlan } from "../plan-provider";

export default function IncomePage() {
  const { result: r, x, patchX } = usePlan();
  const rows = r.pay.filter((p) => p.year <= r.purchase.year + 3);
  const setYear = (who: "salaryYou" | "salaryPartner", year: number, n: number) =>
    patchX((cur) => {
      const next = { ...cur[who] };
      if (n > 0) next[String(year)] = n;
      else delete next[String(year)];
      return { ...cur, [who]: next };
    });
  const edited = Object.keys(x.salaryYou).length + Object.keys(x.salaryPartner).length;

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
          ]}
        />
        <Note>
          Vul het bruto jaarinkomen in zoals het op je jaaropgave staat, inclusief vakantiegeld. De pensioenpremie is wat jij zelf betaalt; die gaat van je bruto af voordat de belasting wordt berekend.
        </Note>
      </Block>

      <Block title="Salaris per jaar" sub="Tik op een bedrag om het te veranderen. Een aangepast jaar is gemarkeerd.">
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-2 py-2 font-medium">Jaar</th>
                <th className="px-2 py-2 font-medium">Jij, bruto</th>
                {x.buyingTogether && <th className="px-2 py-2 font-medium">Partner, bruto</th>}
                <th className="px-2 py-2 text-right font-medium">Netto/mnd</th>
                <th className="px-2 py-2 text-right font-medium">Belasting</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.year} className={`border-t border-gray-100 ${p.year === r.purchase.year ? "bg-teal-50" : ""}`}>
                  <td className="px-2 py-2 font-medium text-gray-900">{p.year}</td>
                  <td className="px-2 py-1.5">
                    <NumberBox
                      value={Math.round(p.grossYou)}
                      onChange={(n) => setYear("salaryYou", p.year, n)}
                      className={p.fromInput.you ? "!border-teal-500 !bg-teal-50" : ""}
                    />
                  </td>
                  {x.buyingTogether && (
                    <td className="px-2 py-1.5">
                      <NumberBox
                        value={Math.round(p.grossPartner)}
                        onChange={(n) => setYear("salaryPartner", p.year, n)}
                        className={p.fromInput.partner ? "!border-teal-500 !bg-teal-50" : ""}
                      />
                    </td>
                  )}
                  <td className="px-2 py-2 text-right">{euro(p.netMonthly)}</td>
                  <td className="px-2 py-2 text-right">{pct(p.avgRate * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {edited > 0 && (
          <button
            type="button"
            onClick={() => patchX((cur) => ({ ...cur, salaryYou: {}, salaryPartner: {} }))}
            className="min-h-[44px] text-sm text-red-600 underline"
          >
            Alle aangepaste jaren wissen ({edited})
          </button>
        )}
        <p className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <SrcBadge src="calc" /> bruto volgt uit {pct(x.salaryGrowthPct)} groei per jaar tot jij een bedrag invult.
          <SrcBadge src="law" /> netto en belasting volgen uit de regels van 2026 (zie Belasting).
        </p>
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
