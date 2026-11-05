// Dutch tax rules the plan calculates with. Every number lives here, with where it
// comes from, so the plan can show it and so a new year only changes this file.
// Indicative: this is a planning aid, not a tax return.

export const LAW_YEAR = 2026;

export interface LawItem {
  key: string;
  label: string;
  value: string;
  note: string;
  source: string;
  url?: string;
}

// Shown on the "Bronnen" page. Items marked "controleer" are the ones where
// sources disagreed or the exact figure could not be confirmed.
export const LAW_ITEMS: LawItem[] = [
  {
    key: "schijven",
    label: "Box 1, tarief per schijf (onder AOW-leeftijd)",
    value: "35,75% tot €38.883 · 37,56% tot €78.426 · 49,50% erboven",
    note: "De eerste twee schijven zijn inclusief premies volksverzekeringen.",
    source: "Belastingdienst / bruto-netto.nl, 2026",
    url: "https://www.bruto-netto.nl/belastingschijven-2026/",
  },
  {
    key: "ahk",
    label: "Algemene heffingskorting",
    value: "maximaal €3.115, afbouw 6,398% boven €29.736, nul vanaf €78.426",
    note: "Gebaseerd op het inkomen in box 1.",
    source: "fiscaal-overzicht.nl, 2026",
    url: "https://fiscaal-overzicht.nl/inkomstenbelasting-2026-belastingschijven-tarief-nl",
  },
  {
    key: "ak",
    label: "Arbeidskorting",
    value: "maximaal ca. €5.712 (opbouw tot ca. €45.000, daarna afbouw)",
    note: "Controleer: bronnen noemen €5.685 (KVK) en €5.712 (Auren / MKB Servicedesk). De vorm van de curve is die van 2025, geschaald naar het maximum van 2026.",
    source: "Auren Miljoenennota-special 2026; KVK",
    url: "https://www.kvk.nl/geldzaken/belastingtarieven-2026/",
  },
  {
    key: "hra",
    label: "Hypotheekrenteaftrek",
    value: "maximaal 37,56% (tarief van de tweede schijf), alleen voor annuïtair of lineair afgelost, max. 30 jaar",
    note: "Het aftrektarief is wettelijk gekoppeld aan het tarief van de tweede schijf.",
    source: "Antwoord staatssecretaris Eerenberg, 2026",
  },
  {
    key: "ewf",
    label: "Eigenwoningforfait",
    value: "0,35% van de WOZ-waarde",
    note: "Controleer: het exacte percentage voor 2026 kon ik niet bevestigen, 0,35% is het percentage van 2025. Je kunt het hier aanpassen.",
    source: "Belastingdienst (2025), aanname voor 2026",
  },
  {
    key: "box3",
    label: "Box 3 (sparen en beleggen)",
    value: "36% over een fictief rendement · heffingsvrij €59.357 per persoon · schuldendrempel €3.800",
    note: "De fictieve rendementspercentages (spaargeld, overige bezittingen, schulden) zijn voorlopig en hier aanpasbaar. Voor de jaren na 2026 rekent het plan met dezelfde regels.",
    source: "SRA, Box 3: percentages, vrijstellingen en bedragen 2026",
    url: "https://www.sra.nl/nieuws/600041/2026/01/box-3-percentages-vrijstellingen-en-bedragen-2026",
  },
  {
    key: "ovb",
    label: "Overdrachtsbelasting",
    value: "2% voor een eigen woning · 0% (startersvrijstelling) van 18 t/m 34 jaar bij een koopsom tot €555.000 (2026), €615.000 (2027)",
    note: "De leeftijd telt op de dag van de notariële levering. Boven de grens vervalt de vrijstelling. Bij samen kopen geldt de vrijstelling per koper. Na 2027 rekent het plan met een jaarlijkse stijging van de grens.",
    source: "Rijksoverheid; SRA",
    url: "https://www.rijksoverheid.nl/onderwerpen/huis-kopen/vraag-en-antwoord/vrijstelling-overdrachtsbelasting",
  },
  {
    key: "nhg",
    label: "Nationale Hypotheek Garantie",
    value: "kostengrens €470.000 (2026) · borgtochtprovisie 0,4% van de hypotheek",
    note: "Bronnen verschillen over de provisie (0,4% of 0,6%) en een paar sites noemen een verouderde grens van €435.000. De grens voor latere jaren is een aanname.",
    source: "Tweede Kamer, banken.nl, Knab",
    url: "https://www.banken.nl/nieuws/26557/nhg-grens-stijgt-naar-470000",
  },
  {
    key: "nibud",
    label: "Financieringslast (Nibud)",
    value: "ongeveer 24–26% van het bruto inkomen mag naar hypotheeklasten",
    note: "Van de echte tabel (per inkomen en rente) vond ik drie punten: ca. 25,75% bij €48.000, 24,4% bij €83.000 en 25,0% bij €97.000. Daartussen is geschat. Weet je het percentage van je adviseur, vul het dan in.",
    source: "Nibud, Advies hypotheeknormen 2026 (via homefinance.nl)",
    url: "https://www.homefinance.nl/nieuws-blog/2026/van-elke-honderd-euro-die-je-verdient-gaat-dit-deel-naar-je-hypotheek-301972/",
  },
  {
    key: "studie",
    label: "Studieschuld bij een hypotheek",
    value: "banken tellen een deel van de schuld mee als maandlast (vaak 0,35%–0,75% per maand, of de werkelijke DUO-maandlast)",
    note: "Bronnen spreken elkaar tegen over de factor. Daarom is de factor in dit plan een eigen invoer.",
    source: "hypotheker.nl, rendement.nl, Consumentenbond",
    url: "https://www.hypotheker.nl/begrippenlijst/veelgestelde-vragen/studieschuld-en-hypotheek/",
  },
];

// ---------------------------------------------------------------- parameters

export interface TaxOptions {
  // Yearly indexation of brackets and credits after LAW_YEAR (the state indexes
  // them with inflation, so they roughly keep pace with salary).
  indexPct: number;
}

const idx = (year: number, o: TaxOptions) => Math.pow(1 + o.indexPct / 100, year - LAW_YEAR);

const B1 = 38883;
const B2 = 78426;
const R1 = 0.3575;
const R2 = 0.3756;
const R3 = 0.495;
const AHK_MAX = 3115;
const AHK_START = 29736;
const AHK_RATE = 0.06398;
const AK_MAX_2026 = 5712;
const AK_MAX_2025 = 5599;

// Box 1 tax before credits.
export function box1Tax(taxable: number, year: number, o: TaxOptions) {
  const f = idx(year, o);
  const b1 = B1 * f;
  const b2 = B2 * f;
  const s1 = Math.min(taxable, b1) * R1;
  const s2 = Math.max(0, Math.min(taxable, b2) - b1) * R2;
  const s3 = Math.max(0, taxable - b2) * R3;
  return { s1, s2, s3, total: s1 + s2 + s3 };
}

export function generalCredit(income: number, year: number, o: TaxOptions) {
  const f = idx(year, o);
  return Math.max(0, Math.min(AHK_MAX * f, AHK_MAX * f - AHK_RATE * (income - AHK_START * f)));
}

// Arbeidskorting: the 2025 curve scaled to the 2026 maximum (and indexed after).
export function labourCredit(labourIncome: number, year: number, o: TaxOptions) {
  const k = (AK_MAX_2026 / AK_MAX_2025) * idx(year, o);
  const x = labourIncome / k;
  let c: number;
  if (x <= 12169) c = 0.08053 * x;
  else if (x <= 26288) c = 980 + 0.3003 * (x - 12169);
  else if (x <= 43071) c = 5220 + 0.02258 * (x - 26288);
  else if (x <= 129078) c = Math.max(0, 5599 - 0.0651 * (x - 43071));
  else c = 0;
  return c * k;
}

export interface NetResult {
  gross: number;
  pension: number;
  taxable: number;
  taxBeforeCredits: number;
  brackets: { s1: number; s2: number; s3: number };
  generalCredit: number;
  labourCredit: number;
  tax: number;
  net: number;
  avgRate: number; // tax / gross
  bracketRate: number; // the statutory rate of the top bracket reached
  marginalRate: number; // including credits phasing out
}

// From a gross year salary (holiday allowance included) to net.
export function netYear(gross: number, pensionPct: number, year: number, o: TaxOptions): NetResult {
  const g = Math.max(0, gross);
  const pension = (g * Math.max(0, pensionPct)) / 100;
  const taxable = g - pension;
  const f = idx(year, o);
  const b = box1Tax(taxable, year, o);
  const ahk = generalCredit(taxable, year, o);
  const ak = labourCredit(taxable, year, o);
  const tax = Math.max(0, b.total - ahk - ak);
  const bracketRate = taxable > B2 * f ? R3 : taxable > B1 * f ? R2 : R1;
  // Marginal rate: the bracket plus credits that shrink as income rises.
  const k = (AK_MAX_2026 / AK_MAX_2025) * f;
  const x = taxable / k;
  let akSlope = 0;
  if (x <= 12169) akSlope = 0.08053;
  else if (x <= 26288) akSlope = 0.3003;
  else if (x <= 43071) akSlope = 0.02258;
  else if (x <= 129078) akSlope = -0.0651;
  const ahkPhase = taxable > AHK_START * f && ahk > 0 ? AHK_RATE : 0;
  const marginalRate = Math.max(0, bracketRate + ahkPhase - akSlope);
  return {
    gross: g,
    pension,
    taxable,
    taxBeforeCredits: b.total,
    brackets: { s1: b.s1, s2: b.s2, s3: b.s3 },
    generalCredit: ahk,
    labourCredit: ak,
    tax,
    net: taxable - tax,
    avgRate: g > 0 ? tax / g : 0,
    bracketRate,
    marginalRate,
  };
}

// ------------------------------------------------------------------- box 3

export interface Box3Params {
  savingsReturnPct: number; // fictitious return on savings
  otherReturnPct: number; // fictitious return on other assets (investments)
  debtReturnPct: number;
  exemptPerPerson: number;
  debtThresholdPerPerson: number;
  ratePct: number;
}

export const BOX3_DEFAULTS: Box3Params = {
  savingsReturnPct: 1.28,
  otherReturnPct: 6.0,
  debtReturnPct: 2.7,
  exemptPerPerson: 59357,
  debtThresholdPerPerson: 3800,
  ratePct: 36,
};

// Yearly box 3 tax on savings + investments, minus debts (e.g. the study loan).
export function box3Tax(savings: number, other: number, debts: number, persons: number, p: Box3Params) {
  const debtExcess = Math.max(0, debts - p.debtThresholdPerPerson * persons);
  const assets = savings + other;
  const base = assets - debtExcess;
  if (base <= 0 || assets <= 0) return { tax: 0, base: 0, effectivePct: 0 };
  const fictitious =
    (savings * p.savingsReturnPct) / 100 + (other * p.otherReturnPct) / 100 - (debtExcess * p.debtReturnPct) / 100;
  const effective = fictitious / base;
  const taxable = Math.max(0, base - p.exemptPerPerson * persons);
  return { tax: Math.max(0, taxable * effective * (p.ratePct / 100)), base, effectivePct: effective * 100 };
}

// ------------------------------------------------------------- house taxes

// The starter's limit for the purchase price, by year.
export function starterLimit(year: number, growthPct: number) {
  if (year <= 2026) return 555000;
  if (year === 2027) return 615000;
  return 615000 * Math.pow(1 + growthPct / 100, year - 2027);
}

export function nhgLimit(year: number, growthPct: number) {
  return year <= 2026 ? 470000 : 470000 * Math.pow(1 + growthPct / 100, year - 2026);
}

export interface TransferTaxInput {
  price: number;
  year: number;
  newBuild: boolean;
  ages: number[]; // age of each buyer on the day of delivery
  shares: number[]; // each buyer's share of the home (adds up to 1)
  limit: number; // the starter's limit for that year
}

export function transferTax(i: TransferTaxInput) {
  const limit = i.limit;
  if (i.newBuild) return { tax: 0, rate: 0, exemptShare: 1, limit, note: "Nieuwbouw: geen overdrachtsbelasting (btw zit in de prijs)." };
  let tax = 0;
  let exempt = 0;
  i.ages.forEach((age, n) => {
    const share = i.shares[n] ?? 0;
    const qualifies = age >= 18 && age < 35 && i.price <= limit;
    if (qualifies) exempt += share;
    else tax += share * i.price * 0.02;
  });
  const note =
    exempt >= 0.999
      ? "Startersvrijstelling: geen overdrachtsbelasting."
      : exempt > 0
        ? "Een deel van de kopers valt onder de startersvrijstelling."
        : i.price > limit
          ? `De koopsom ligt boven de startersgrens van ${Math.round(limit).toLocaleString("nl-NL")} euro: 2% over de hele prijs.`
          : "Geen startersvrijstelling (leeftijd): 2% overdrachtsbelasting.";
  return { tax, rate: i.price > 0 ? tax / i.price : 0, exemptShare: exempt, limit, note };
}

// What the home loan interest returns in tax (negative = extra tax when the
// eigenwoningforfait is higher than the interest).
export function mortgageInterestRelief(args: {
  interestYear: number;
  woz: number;
  ewfPct: number;
  bracketRate: number;
  maxRate?: number; // the maximum rate of the relief in that year
  factorPct?: number; // how much of today's relief is left (policy may change)
}) {
  const forfait = (args.woz * args.ewfPct) / 100;
  const net = args.interestYear - forfait;
  const cap = args.maxRate ?? R2;
  const factor = (args.factorPct ?? 100) / 100;
  const rate = net >= 0 ? Math.min(args.bracketRate, cap) * factor : args.bracketRate;
  return { forfait, deductible: net, benefit: net * rate, rate };
}

export const MAX_RELIEF_RATE = R2;
