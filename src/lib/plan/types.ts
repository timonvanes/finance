import { BOX3_DEFAULTS, type Box3Params } from "./tax";

// ------------------------------------------------------------------ sources
// Every number in the plan says where it comes from.
export type Source = "user" | "app" | "law" | "assume" | "calc";

export const SOURCE_LABEL: Record<Source, string> = {
  user: "Jouw invoer",
  app: "Uit je app",
  law: "Wet / regel",
  assume: "Aanname",
  calc: "Berekend",
};

// ------------------------------------------------------------------- inputs

export type Contract = "vast" | "tijdelijk" | "zzp";

export interface PlanEvent {
  id: string;
  label: string;
  amount: number; // positive = money in (gift, bonus), negative = money out (wedding, car)
  year: number;
}

export interface Contribution {
  save: number;
  bonds: number;
  invest: number;
}

export interface CheckIn {
  id: string;
  date: string;
  grossYou: number;
  grossPartner: number;
  savings: number;
  bonds: number;
  stocks: number;
  studyDebt: number;
  note: string;
  // What the plan expected at that moment, so the drift is visible.
  expectedTotal: number | null;
  actualTotal: number;
}

export interface Costs {
  notary: number;
  valuation: number;
  advice: number;
  bankFee: number;
  buyerAgent: number;
  inspection: number;
  bankGuarantee: number;
  moving: number;
  furnishing: number;
  other: number;
}

export interface Running {
  maintenancePct: number; // % of the price per year
  ozbPct: number; // % of the WOZ value per year
  waterYear: number; // waterschap, sewer and waste per year
  insuranceMonth: number;
  energyMonth: number;
  vveMonth: number;
  groundRentMonth: number;
}

export interface Extra {
  startDate: string; // the date the starting balances refer to

  // people
  birthYear: number;
  partnerBirthYear: number;
  buyingTogether: boolean;
  sharePctYou: number;
  contractYou: Contract;
  contractPartner: Contract;

  // income path
  salaryGrowthPct: number;
  partnerGrowthPct: number;
  salaryYou: Record<string, number>; // explicit gross per calendar year
  salaryPartner: Record<string, number>;
  pensionPct: number;
  partnerPensionPct: number;
  taxIndexPct: number;

  // the home
  priceGrowthPct: number;
  inflationPct: number;
  newBuild: boolean;
  renovation: number;
  energyLoan: number;
  wozPct: number;
  ewfPct: number;
  costs: Costs;
  running: Running;
  bufferMonths: number;
  limitGrowthPct: number;

  // living
  rentNow: number;
  otherSpendingMonth: number;

  // mortgage
  borrowMode: "max" | "comfort" | "fixed";
  borrowFixed: number;
  comfortPct: number;
  finPctOverride: number;
  testRate: number;
  nhgMode: "auto" | "yes" | "no";
  nhgRateDiscount: number;
  otherLoanMonth: number;
  creditLimit: number;
  leaseMonth: number;
  alimonyMonth: number;
  rateShock: number;

  // study loan
  studyFactorPct: number;
  studyExtraRepay: number;
  studyRepayYear: number;
  studyOriginal: number;

  // saving and investing
  startBonds: number;
  monthlyBonds: number;
  bondsLow: number;
  bondsMid: number;
  bondsHigh: number;
  volStocks: number;
  volBonds: number;
  correlation: number;
  glide: boolean;
  glideYears: number;
  contribGrowthPct: number;
  contrib: Record<string, Contribution>;
  confidencePct: number;
  box3: Box3Params;
  box3Persons: number;

  events: PlanEvent[];
  checkins: CheckIn[];
}

export const DEFAULT_COSTS: Costs = {
  notary: 1800,
  valuation: 700,
  advice: 3000,
  bankFee: 0,
  buyerAgent: 0,
  inspection: 500,
  bankGuarantee: 250,
  moving: 1500,
  furnishing: 5000,
  other: 1000,
};

export const DEFAULT_RUNNING: Running = {
  maintenancePct: 1,
  ozbPct: 0.1,
  waterYear: 650,
  insuranceMonth: 40,
  energyMonth: 200,
  vveMonth: 0,
  groundRentMonth: 0,
};

export function defaultExtra(today: string): Extra {
  const year = Number(today.slice(0, 4));
  return {
    startDate: today,
    birthYear: year - 27,
    partnerBirthYear: year - 27,
    buyingTogether: false,
    sharePctYou: 100,
    contractYou: "vast",
    contractPartner: "vast",
    salaryGrowthPct: 3,
    partnerGrowthPct: 3,
    salaryYou: {},
    salaryPartner: {},
    pensionPct: 5,
    partnerPensionPct: 5,
    taxIndexPct: 2,
    priceGrowthPct: 3.5,
    inflationPct: 2.5,
    newBuild: false,
    renovation: 0,
    energyLoan: 0,
    wozPct: 100,
    ewfPct: 0.35,
    costs: { ...DEFAULT_COSTS },
    running: { ...DEFAULT_RUNNING },
    bufferMonths: 3,
    limitGrowthPct: 3,
    rentNow: 0,
    otherSpendingMonth: 0,
    borrowMode: "max",
    borrowFixed: 0,
    comfortPct: 30,
    finPctOverride: 0,
    testRate: 0,
    nhgMode: "auto",
    nhgRateDiscount: 0.2,
    otherLoanMonth: 0,
    creditLimit: 0,
    leaseMonth: 0,
    alimonyMonth: 0,
    rateShock: 1,
    studyFactorPct: 0.45,
    studyExtraRepay: 0,
    studyRepayYear: year,
    studyOriginal: 0,
    startBonds: 0,
    monthlyBonds: 0,
    bondsLow: 1,
    bondsMid: 3.5,
    bondsHigh: 5.5,
    volStocks: 16,
    volBonds: 5,
    correlation: 0.2,
    glide: false,
    glideYears: 3,
    contribGrowthPct: 0,
    contrib: {},
    confidencePct: 80,
    box3: { ...BOX3_DEFAULTS },
    box3Persons: 1,
    events: [],
    checkins: [],
  };
}

// Stored data may be older than this shape: fill in what is missing.
export function mergeExtra(stored: unknown, today: string): Extra {
  const base = defaultExtra(today);
  if (!stored || typeof stored !== "object") return base;
  const s = stored as Partial<Extra>;
  return {
    ...base,
    ...s,
    costs: { ...base.costs, ...(s.costs ?? {}) },
    running: { ...base.running, ...(s.running ?? {}) },
    box3: { ...base.box3, ...(s.box3 ?? {}) },
    salaryYou: s.salaryYou ?? {},
    salaryPartner: s.salaryPartner ?? {},
    contrib: s.contrib ?? {},
    events: Array.isArray(s.events) ? s.events : [],
    checkins: Array.isArray(s.checkins) ? s.checkins : [],
  };
}

// ---------------------------------------------------------- data from the app

export interface StudyLoanData {
  hasLoan: boolean;
  balanceNow: number; // what is really owed (after the gift part)
  originalDebt: number; // sum of the balances as of their dates
  blendedRate: number; // % per year
  repayStart: string | null;
  termYears: number;
  monthlyPayment: number | null; // set by DUO, otherwise estimated
  estimatedMonthly: number | null;
  projectedAtStart: number | null;
  note: string;
}

export interface AppData {
  // pots
  savingsNow: number;
  investNow: number;
  monthlySave: number;
  monthlyInvest: number;
  potNames: { saving: string[]; investing: string[] };
  // the last full months of real money in and out
  months: { label: string; income: number; spent: number; saved: number }[];
  avgIncome: number;
  avgSpentExSaving: number;
  avgSaved: number;
  study: StudyLoanData;
  today: string;
}
