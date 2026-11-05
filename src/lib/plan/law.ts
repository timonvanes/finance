import { BOX3_DEFAULTS, type Box3Params } from "./tax";

// Rules that change every year, one row per tax year. After Prinsjesdag (the third
// Tuesday of September) the next year's row is filled in. For years that are not in
// the table the last known row counts, and the two limits keep growing at the pace
// the plan sets, so a plan that runs to 2032 never stops for lack of a number.

export interface LawYear {
  year: number;
  nhgLimit: number;
  starterLimit: number;
  reliefMaxRate: number; // maximum rate of the mortgage interest relief, as a fraction
  box3: Box3Params;
  source: string;
  url?: string;
  checkedOn: string;
  note?: string;
}

export const LAW_TABLE_DEFAULT: LawYear[] = [
  {
    year: 2026,
    nhgLimit: 470000,
    starterLimit: 555000,
    reliefMaxRate: 0.3756,
    box3: { ...BOX3_DEFAULTS },
    source: "SRA, banken.nl, TaxLive",
    url: "https://www.sra.nl/nieuws/600041/2026/01/box-3-percentages-vrijstellingen-en-bedragen-2026",
    checkedOn: "2026-11-05",
    note: "Fictieve rendementen 2026 zijn voorlopig.",
  },
  {
    year: 2027,
    nhgLimit: 476000,
    starterLimit: 615000,
    reliefMaxRate: 0.3756,
    box3: { savingsReturnPct: 1.27, otherReturnPct: 6.37, debtReturnPct: 2.85, exemptPerPerson: 60098, debtThresholdPerPerson: 3800, ratePct: 36 },
    source: "De Hypotheker (startersgrens), Rekenmaat (NHG, geraamd), Raisin en Rendement.nl (box 3)",
    url: "https://www.hypotheker.nl/actueel/nieuwsberichten/2026/prinsjesdag-2026-wat-verandert-er-voor-huizenkopers-in-2027/",
    checkedOn: "2026-11-05",
    note: "NHG-grens is een raming (minder betrouwbare bron). Het heffingsvrije bedrag is volgens de huidige wet; het kabinet stelde € 30.846 voor, dat is nog geen wet.",
  },
];

export interface LawResolved {
  year: number;
  nhgLimit: number;
  starterLimit: number;
  reliefMaxRate: number;
  box3: Box3Params;
  known: boolean; // the year has a row of its own
}

export function lawFor(table: LawYear[], year: number, limitGrowthPct: number, box3ExemptOverride: number | null): LawResolved {
  const rows = [...table].sort((a, b) => a.year - b.year);
  const exact = rows.find((r) => r.year === year);
  const last = rows.filter((r) => r.year <= year).pop() ?? rows[0];
  const row = exact ?? last;
  const ahead = exact ? 0 : Math.max(0, year - row.year);
  const grow = Math.pow(1 + limitGrowthPct / 100, ahead);
  const box3 =
    box3ExemptOverride !== null && year >= 2027 ? { ...row.box3, exemptPerPerson: box3ExemptOverride } : row.box3;
  return {
    year,
    nhgLimit: row.nhgLimit * grow,
    starterLimit: row.starterLimit * grow,
    reliefMaxRate: row.reliefMaxRate,
    box3,
    known: Boolean(exact),
  };
}
