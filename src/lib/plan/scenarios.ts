import type { HouseInputs } from "@/lib/house/calc";
import { FIELDS, FIELD_BY_ID, VARIANT_FIELDS } from "./fields";
import { computePlan, type PlanResult } from "./model";
import {
  defaultExtra,
  type AppData,
  type AssumptionMeta,
  type Extra,
  type HistoryEntry,
  type PlanDoc,
  type Scenario,
  type Snapshot,
  type Variant,
  type VariantOverride,
} from "./types";

// -------------------------------------------------------- resolving a variant

const NONE: VariantOverride = { fields: {}, salaryYou: {}, salaryPartner: {} };

export function overrideOf(sc: Scenario, variant: Variant): VariantOverride {
  return variant === "basis" ? NONE : sc.variants[variant];
}

// The inputs the model calculates with: the scenario, with the variant on top.
export function resolve(sc: Scenario, variant: Variant): { b: HouseInputs; x: Extra } {
  let b = sc.b;
  let x = sc.x;
  if (variant !== "basis") {
    const ov = sc.variants[variant];
    for (const [id, v] of Object.entries(ov.fields)) {
      const f = FIELD_BY_ID.get(id);
      if (f) [b, x] = f.set(b, x, v);
    }
    x = {
      ...x,
      salaryYou: { ...x.salaryYou, ...ov.salaryYou },
      salaryPartner: { ...x.salaryPartner, ...ov.salaryPartner },
    };
  }
  return { b, x };
}

// Writes a change of one field: into the variant when it is a field that differs per
// variant, otherwise into the scenario itself.
export function writeField(sc: Scenario, variant: Variant, id: string, v: number | string | boolean): Scenario {
  const f = FIELD_BY_ID.get(id);
  if (!f) return sc;
  if (variant !== "basis" && VARIANT_FIELDS.has(id)) {
    const ov = sc.variants[variant];
    return { ...sc, variants: { ...sc.variants, [variant]: { ...ov, fields: { ...ov.fields, [id]: v } } } };
  }
  const [b, x] = f.set(sc.b, sc.x, v);
  return { ...sc, b, x };
}

export function writeSalary(sc: Scenario, variant: Variant, who: "salaryYou" | "salaryPartner", year: number, n: number): Scenario {
  const put = (m: Record<string, number>) => {
    const next = { ...m };
    if (n > 0) next[String(year)] = n;
    else delete next[String(year)];
    return next;
  };
  if (variant === "basis") return { ...sc, x: { ...sc.x, [who]: put(sc.x[who]) } };
  const ov = sc.variants[variant];
  return { ...sc, variants: { ...sc.variants, [variant]: { ...ov, [who]: put(ov[who]) } } };
}

// ------------------------------------------------------------------- starters

const SALARY: Record<Variant, Record<string, number>> = {
  stress: { "2027": 43200, "2028": 44496, "2029": 45831, "2030": 47206, "2031": 48622, "2032": 50081 },
  basis: { "2027": 43200, "2028": 46440, "2029": 50760, "2030": 55080, "2031": 59400, "2032": 63720 },
  gunstig: { "2027": 43200, "2028": 48600, "2029": 56160, "2030": 61560, "2031": 66960, "2032": 72360 },
};

// Scenario A of the document: buying alone around 2032. B copies it and changes
// what differs. Numbers and reasons are in "Financieel plan aannames en uitbreidingen".
function scenarioA(app: AppData): Scenario {
  const today = app.today;
  const x = defaultExtra(today);
  const year = Number(today.slice(0, 4));
  x.birthYear = 2002;
  x.buyingTogether = false;
  x.sharePctYou = 100;
  x.contractYou = "vast";
  x.salaryYou = { ...SALARY.basis };
  x.salaryGrowthPct = 3;
  x.partnerGrowthPct = 3;
  x.pensionPct = 4;
  x.taxIndexPct = 2;
  x.inflationPct = 2.5;
  x.priceGrowthPct = 4;
  x.bidPct = 6;
  x.newBuild = false;
  x.renovation = 5000;
  x.wozPct = 100;
  x.ewfPct = 0.35;
  x.bufferMonths = 6;
  x.limitGrowthPct = 3;
  x.running = { ...x.running, energyMonth: 150, vveMonth: 270 };
  x.costs = { ...x.costs, buyerAgent: 0 };
  x.rentNow = 1000;
  x.otherSpendingMonth = Math.max(0, Math.round(app.avgSpentExSaving));
  x.emergencyMonths = 5;
  x.fixedCostsMonth = 1500;
  x.contribStartYear = year + 1;
  x.contribGrowthPct = 5;
  x.reliefFactorPct = 100;
  x.studyFactorPct = 0.45;
  x.studyExtraRepay = 0;
  x.confidencePct = 80;
  x.box3Persons = 1;
  x.startDate = today;
  x.studyRepayYear = year;

  const b: HouseInputs = {
    targetDate: "2032-01-01",
    targetPrice: 400000,
    incomeGrossYear: 43200,
    partnerIncomeGrossYear: 0,
    rate: 4,
    termYears: 30,
    costPct: 4,
    housingPct: 28,
    studentMonthly: 0,
    startSavings: 0,
    startInvest: 5750,
    monthlySave: 200,
    monthlyInvest: 200,
    savingsRate: 2,
    returnLow: 1,
    returnMid: 5,
    returnHigh: 8,
  };
  return {
    id: "A",
    name: "A. Alleen kopen rond 2032",
    description: "Je koopt alleen, rond je 30e. Startsalaris ongeveer € 40.000 exclusief vakantiegeld, een woning in Amsterdam of Utrecht.",
    b,
    x,
    variants: {
      stress: {
        fields: {
          priceGrowthPct: 6.5,
          bidPct: 10,
          contribGrowthPct: 0,
          limitGrowthPct: 0,
          "run.vveMonth": 350,
          "cost.buyerAgent": 4000,
          reliefFactorPct: 50,
          box3ExemptStress: 30846,
        },
        salaryYou: { ...SALARY.stress },
        salaryPartner: {},
      },
      gunstig: {
        fields: { priceGrowthPct: 2.5, bidPct: 0, contribGrowthPct: 8 },
        salaryYou: { ...SALARY.gunstig },
        salaryPartner: {},
      },
    },
  };
}

function scenarioB(a: Scenario): Scenario {
  const copy: Scenario = JSON.parse(JSON.stringify(a));
  copy.id = "B";
  copy.name = "B. Samen kopen rond 2035";
  copy.description = "Je koopt later samen met een partner. Haar gegevens zijn nog onbekend: vul ze in bij Personen en Inkomen zodra je ze weet.";
  copy.b.targetDate = "2035-01-01";
  copy.b.targetPrice = 550000;
  copy.x.buyingTogether = true;
  copy.x.sharePctYou = 50;
  copy.x.partnerBirthYear = 2004;
  copy.x.contractPartner = "vast";
  copy.x.partnerStartYear = 2031;
  copy.x.box3Persons = 2;
  copy.x.running = { ...copy.x.running, energyMonth: 175 };
  return copy;
}

export function seedDoc(app: AppData, existing: { b: HouseInputs; x: Extra } | null): PlanDoc {
  const a = scenarioA(app);
  const scenarios: Scenario[] = [a, scenarioB(a)];
  if (existing) {
    scenarios.push({
      id: "oud",
      name: "Eerder ingevuld",
      description: "Wat je invulde voordat de scenario's A en B erbij kwamen.",
      b: existing.b,
      x: existing.x,
      variants: { stress: { fields: {}, salaryYou: {}, salaryPartner: {} }, gunstig: { fields: {}, salaryYou: {}, salaryPartner: {} } },
    });
  }
  return { version: 1, activeId: "A", variant: "basis", scenarios, meta: seedMeta(), history: [], snapshots: [] };
}

// ------------------------------------------------- where the assumptions come from

const T0 = "2026-11-05";
const LAW_NEXT = "2027-10-01"; // after Prinsjesdag
const NEXT = "2027-01-15"; // when the year's figures are in

const m = (source: string, url: string | undefined, nextCheck: string, note?: string): AssumptionMeta => ({ source, url, checkedOn: T0, nextCheck, note });

function seedMeta(): Record<string, AssumptionMeta> {
  const out: Record<string, AssumptionMeta> = {
    priceGrowthPct: m("Calcasa WOX Q2 2026 (Amsterdam +22% in 5 jaar, +89% in 10 jaar) en Rabobank (circa 1% voor 2026)", "https://calcasa.nl/files/Calcasa_WOX_2026Q2_NL.pdf", NEXT, "Eigen pad: gunstig 2,5%, basis 4%, stress 6,5%."),
    bidPct: m("De Hypotheker: 7 tot 10% overbieden in Amsterdam, 8 tot 9% in Utrecht (mei 2026)", "https://www.hypotheker.nl/blog/moet-je-tegenwoordig-wel-of-niet-overbieden/", NEXT, "Basis 6% ligt onder het huidige niveau omdat de markt kan afkoelen. Eigen keuze."),
    inflationPct: m("ECB-doel 2%, eurozone loopt weer op (HomeFinance)", "https://www.homefinance.nl/nieuws-blog/2026/de-hypotheekrente-staat-op-het-hoogste-punt-van-dit-jaar-en-dit-kost-het-je-per-maand-301972/", NEXT, "2,5% is de voorzichtige kant."),
    rate: m("HomeFinance: gemiddeld 4,01% voor 10 jaar vast met NHG (september 2026)", "https://www.homefinance.nl/nieuws-blog/2026/de-hypotheekrente-staat-op-het-hoogste-punt-van-dit-jaar-en-dit-kost-het-je-per-maand-301972/", NEXT),
    incomeGrossYear: m("Nationale Beroepengids, Indeed, Consultancy.nl (junior consultant)", "https://www.nationaleberoepengids.nl/salaris/beginnend-consultant", NEXT, "€ 40.000 exclusief vakantiegeld is € 43.200 inclusief 8%. Nog geen aanbod: pas aan zodra je het hebt."),
    salaryGrowthPct: m("Eigen aanname op basis van salarisbronnen (Banken.nl, Nationale Beroepengids, Levels.fyi)", "https://www.banken.nl/carriere/salaris-van-consultants", NEXT, "Vanaf 2033 geldt 3% per jaar in alle varianten."),
    pensionPct: m("Eigen aanname", undefined, NEXT, "Vervang door het echte percentage bij het aanbod."),
    ewfPct: m("Belastingdienst, 2025 (nog niet bevestigd voor 2026)", undefined, LAW_NEXT, "Controleer voor het jaar van aankoop."),
    "run.vveMonth": m("HomeFinance: gemiddelde VvE-bijdrage 2026 circa € 270 per maand", "https://www.homefinance.nl/nieuws-blog/2026/deze-vve-bijdrage-stijgt-harder-dan-de-hypotheekrente-301972/", NEXT, "Stress: € 350."),
    "run.energyMonth": m("HomeFinance: gemiddeld € 124,25 per maand voor gas, water en stroom (2026)", "https://www.homefinance.nl/nieuws-blog/2026/zo-check-je-in-een-half-uur-of-je-te-veel-betaalt-voor-je-vaste-lasten-301972/", NEXT, "Het plan rekent bewust hoger."),
    "run.ozbPct": m("Gemeenten Utrecht en Amsterdam, tarieven nog niet gecontroleerd", "https://bghu.nl/Alles-over/Belastingen/Tarieven-2026/Utrecht-2026", NEXT),
    "run.waterYear": m("Gemeente Utrecht, bedragen niet gecontroleerd", "https://www.utrecht.nl/wonen-en-leven/gemeentebelasting", NEXT),
    limitGrowthPct: m("NHG-grens 2027 geraamd € 476.000 (Rekenmaat), startersgrens 2027 € 615.000 (De Hypotheker)", "https://www.hypotheker.nl/actueel/nieuwsberichten/2026/prinsjesdag-2026-wat-verandert-er-voor-huizenkopers-in-2027/", LAW_NEXT, "De startersgrens is politiek: daarom ook getest met 0%."),
    reliefFactorPct: m("TaxLive en NOS: maximaal 37,56% in 2026, afbouw of afschaffing besproken", "https://www.taxlive.nl/nl/documenten/vn-vandaag/nog-geen-duidelijkheid-over-uitvoering-motie-stultiens-over-hypotheekrenteaftrek/", LAW_NEXT, "Eigen aanname voor de varianten."),
    box3ExemptStress: m("Raisin en Financieel onafhankelijk blog: het kabinet stelde € 30.846 voor (29 september 2026)", "https://www.raisin.com/nl-nl/nieuws/heffingsvrij-vermogen-2027-gehalveerd/", LAW_NEXT, "Nog geen wet."),
    studyFactorPct: m("Eigen aanname uit de app, bronnen verschillen", "https://www.hypotheker.nl/begrippenlijst/veelgestelde-vragen/studieschuld-en-hypotheek/", NEXT, "Controleer de factor van de verstrekker."),
    bufferMonths: m("Eigen keuze: 3 tot 6 maanden is gebruikelijk, hier de bovenkant", undefined, NEXT),
    emergencyMonths: m("Eigen keuze: 4 tot 6 maanden vaste lasten", undefined, NEXT),
    fixedCostsMonth: m("Eigen aanname: circa € 1.500 per maand", undefined, NEXT, "Vul in na drie maanden salaris."),
    contribGrowthPct: m("Eigen aanname, gekoppeld aan de salarisvarianten", undefined, NEXT, "Stress 0%, basis 5%, gunstig 8%."),
    rentNow: m("Opgave van Timon: € 750 nu, verwacht € 1.000", undefined, NEXT),
    birthYear: m("Opgave van Timon", undefined, "2030-01-01"),
    targetDate: m("Eigen wens: rond je 30e kopen", undefined, NEXT),
    targetPrice: m("Startpunt, geen voorspelling. Gemiddeld Amsterdam appartement € 595.105, Utrecht € 453.332 (Q1 2026)", "https://www.hypotheker.nl/actueel/huizenprijzen-amsterdam", NEXT),
  };
  for (const k of ["notary", "valuation", "advice", "bankFee", "buyerAgent", "inspection", "bankGuarantee", "moving", "furnishing", "other"]) {
    out[`cost.${k}`] = m("De Hypotheker, kosten koper; bedragen zijn eigen aannames", "https://www.hypotheker.nl/begrippenlijst/huis-kopen/kosten-koper/", NEXT);
  }
  return out;
}

// --------------------------------------------------------------- history and drift

const show = (v: unknown) => (typeof v === "boolean" ? (v ? "ja" : "nee") : typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v ?? ""));

// What changed between two versions of a scenario, one entry per field.
export function diffHistory(before: Scenario, after: Scenario, date: string): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const f of FIELDS) {
    const u = f.get(before.b, before.x);
    const v = f.get(after.b, after.x);
    if (u !== v) out.push({ date, scenario: after.id, field: f.id, label: f.label, from: show(u), to: show(v) });
  }
  return out;
}

// How the plan looked at one moment, to compare later.
export function snapshotOf(date: string, scenarioId: string, variant: Variant, r: PlanResult): Snapshot {
  const pu = r.purchase;
  const ti = r.sim.checkpoints.indexOf(r.targetMonth);
  return {
    date,
    scenarioId,
    variant,
    need: Math.round(pu.needTotal),
    wealth: Math.round(r.sim.p10[ti] ?? 0),
    prob: Math.round(r.probEnough * 100) / 100,
    earliestYear: r.earliest?.year ?? null,
    loan: Math.round(pu.loan),
    shortfall: Math.round(r.shortfall),
  };
}

export const VARIANT_KEYS: Variant[] = ["stress", "basis", "gunstig"];

// All three variants of a scenario, for side-by-side views.
export function computeVariants(sc: Scenario, app: AppData, paths = 300): Record<Variant, PlanResult> {
  const out = {} as Record<Variant, PlanResult>;
  for (const v of VARIANT_KEYS) {
    const { b, x } = resolve(sc, v);
    out[v] = computePlan({ b, x, app }, paths);
  }
  return out;
}
