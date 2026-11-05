import { loanFromMonthly, monthlyForLoan, type HouseInputs } from "@/lib/house/calc";
import { lawFor, type LawResolved } from "./law";
import {
  box3Tax,
  mortgageInterestRelief,
  netYear,
  transferTax,
  type NetResult,
} from "./tax";
import type { AppData, Contribution, Extra } from "./types";

export interface PlanInput {
  b: HouseInputs;
  x: Extra;
  app: AppData;
}

// ------------------------------------------------------------------- helpers

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parts = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y: y || 2026, m: (m || 1) - 1, d: d || 1 };
};

export function monthsBetween(fromIso: string, toIso: string) {
  const a = parts(fromIso);
  const b = parts(toIso);
  return (b.y - a.y) * 12 + (b.m - a.m);
}

export function dateAtMonth(startIso: string, m: number) {
  const s = parts(startIso);
  return new Date(s.y, s.m + m, 1);
}

const yearAtMonth = (startIso: string, m: number) => dateAtMonth(startIso, m).getFullYear();

// The rules of a year (limits, box 3, relief), from the table the plan keeps.
export function lawAt(x: Extra, year: number): LawResolved {
  return lawFor(x.law, year, x.limitGrowthPct, x.box3ExemptStress > 0 ? x.box3ExemptStress : null);
}
const growth = (pct: number, months: number) => Math.pow(1 + pct / 100, months / 12);
const mRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;

// ------------------------------------------------------------------- income

export const CONTRACT_FACTOR = { vast: 1, tijdelijk: 0.85, zzp: 0.8 } as const;

export interface PayRow {
  year: number;
  grossYou: number;
  netYou: NetResult;
  grossPartner: number;
  netPartner: NetResult | null;
  gross: number;
  net: number;
  netMonthly: number;
  tax: number;
  avgRate: number;
  marginalRate: number;
  bracketRate: number;
  fromInput: { you: boolean; partner: boolean };
  // what a bank counts: salary plus fixed extra pay, without bonus
  countedYou: number;
  countedPartner: number;
  bonus: number;
}

function salaryPath(base: number, growthPct: number, explicit: Record<string, number>, fromYear: number, toYear: number) {
  const out = new Map<number, { v: number; fromInput: boolean }>();
  let v = base;
  for (let y = fromYear; y <= toYear; y++) {
    if (y > fromYear) v = v * (1 + growthPct / 100);
    const e = explicit[String(y)];
    const fromInput = typeof e === "number" && e > 0;
    if (fromInput) v = e;
    out.set(y, { v, fromInput });
  }
  return out;
}

export function payroll(p: PlanInput, fromYear: number, toYear: number): PayRow[] {
  const { b, x } = p;
  const you = salaryPath(b.incomeGrossYear, x.salaryGrowthPct, x.salaryYou, fromYear, toYear);
  // The partner starts to earn in her own first year; the salary entered is that of the first year.
  const pStart = x.partnerStartYear > 0 ? Math.max(fromYear, x.partnerStartYear) : fromYear;
  const partner = salaryPath(b.partnerIncomeGrossYear, x.partnerGrowthPct, x.salaryPartner, pStart, Math.max(toYear, pStart));
  const opt = { indexPct: x.taxIndexPct };
  const extraShare = 1 + x.fixedExtraPct / 100 + x.bonusPct / 100;
  // Lease car: the addition is taxed as income, but it is not cash.
  const taxedYear = (salary: number, pensionPct: number, y: number) => {
    const withExtra = salary * extraShare;
    const lease = salary > 0 ? x.leaseTaxableYear : 0;
    const r = netYear(withExtra + lease, pensionPct, y, opt);
    return lease > 0 ? { ...r, gross: withExtra, net: r.net - lease, avgRate: withExtra > 0 ? r.tax / withExtra : 0 } : r;
  };
  const rows: PayRow[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    const yv = you.get(y)!;
    const pv = y >= pStart ? partner.get(y)! : { v: 0, fromInput: false };
    const netYou = taxedYear(yv.v, x.pensionPct, y);
    const withPartner = x.buyingTogether && pv.v > 0;
    const netPartner = withPartner ? taxedYear(pv.v, x.partnerPensionPct, y) : null;
    const gross = netYou.gross + (netPartner?.gross ?? 0);
    const net = netYou.net + (netPartner?.net ?? 0);
    const tax = netYou.tax + (netPartner?.tax ?? 0);
    rows.push({
      year: y,
      grossYou: netYou.gross,
      netYou,
      grossPartner: netPartner?.gross ?? 0,
      netPartner,
      gross,
      net,
      netMonthly: net / 12,
      tax,
      avgRate: gross > 0 ? tax / gross : 0,
      marginalRate: netYou.marginalRate,
      bracketRate: Math.max(netYou.bracketRate, netPartner?.bracketRate ?? 0),
      fromInput: { you: yv.fromInput, partner: pv.fromInput },
      countedYou: yv.v * (1 + x.fixedExtraPct / 100),
      countedPartner: withPartner ? pv.v * (1 + x.fixedExtraPct / 100) : 0,
      bonus: (yv.v + (withPartner ? pv.v : 0)) * (x.bonusPct / 100),
    });
  }
  return rows;
}

// -------------------------------------------------------------- study loan

export interface StudyPoint {
  balance: number;
  payment: number;
}

// Month by month: interest on the first of every month, no payments in the
// run-up phase, then the fixed monthly amount. An extra repayment comes out of
// the balance in the month it is made.
export function studyPath(p: PlanInput, months: number): StudyPoint[] {
  const s = p.app.study;
  const out: StudyPoint[] = [];
  if (!s.hasLoan) return Array.from({ length: months + 1 }, () => ({ balance: 0, payment: 0 }));
  const r = mRate(s.blendedRate);
  const startRepay = s.repayStart ? monthsBetween(p.x.startDate, s.repayStart) : null;
  const payment =
    s.monthlyPayment ??
    s.estimatedMonthly ??
    (s.projectedAtStart && s.blendedRate ? monthlyForLoan(s.projectedAtStart, s.blendedRate, s.termYears) : 0);
  const repayMonth = Math.max(0, monthsBetween(p.x.startDate, `${p.x.studyRepayYear}-01-01`));
  let bal = s.balanceNow;
  for (let m = 0; m <= months; m++) {
    let pay = 0;
    if (m > 0) {
      bal = bal * (1 + r);
      if (startRepay !== null && m >= startRepay) {
        pay = Math.min(payment, bal);
        bal -= pay;
      }
    }
    if (m === repayMonth && p.x.studyExtraRepay > 0) bal = Math.max(0, bal - p.x.studyExtraRepay);
    out.push({ balance: Math.max(0, bal), payment: pay });
  }
  return out;
}

// ------------------------------------------------------------------- mortgage

// Share of the gross income that may go to housing costs (Nibud, indicative).
export function financingPct(income: number, override: number) {
  if (override > 0) return override;
  const anchors: [number, number][] = [
    [48000, 25.75],
    [83000, 24.4],
    [97000, 25.0],
  ];
  if (income <= anchors[0][0]) return anchors[0][1];
  if (income >= anchors[2][0]) return anchors[2][1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i];
    const [x1, y1] = anchors[i + 1];
    if (income <= x1) return y0 + ((income - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 25;
}

export interface Capacity {
  counted: number;
  pct: number;
  maxMonthly: number;
  obligations: { study: number; loans: number; credit: number; lease: number; alimony: number; total: number };
  available: number;
  rate: number;
  loan: number;
  nhg: boolean;
}

export function capacityAt(p: PlanInput, m: number, study: StudyPoint[], priceNominal: number, rateShock = 0, studyBalanceOverride?: number): Capacity {
  const { b, x } = p;
  const year = yearAtMonth(x.startDate, m);
  const rows = payroll(p, yearAtMonth(x.startDate, 0), year);
  const row = rows[rows.length - 1];
  const counted =
    row.countedYou * CONTRACT_FACTOR[x.contractYou] +
    (row.netPartner ? row.countedPartner * CONTRACT_FACTOR[x.contractPartner] : 0);
  const pct = financingPct(counted, x.finPctOverride);
  const maxMonthly = (counted * pct) / 100 / 12;
  const sp = study[Math.min(m, study.length - 1)];
  const studyBal = studyBalanceOverride ?? sp.balance;
  const studyMonthly =
    studyBal > 1
      ? Math.max(sp.payment || p.app.study.monthlyPayment || p.app.study.estimatedMonthly || 0, (x.studyFactorPct / 100) * studyBal)
      : 0;
  const loans = x.otherLoanMonth;
  const credit = x.creditLimit * 0.02;
  const total = studyMonthly + loans + credit + x.leaseMonth + x.alimonyMonth;
  const available = Math.max(0, maxMonthly - total);
  const nhgOn = x.nhgMode === "yes" || (x.nhgMode === "auto" && priceNominal <= lawAt(x, year).nhgLimit);
  const rate = Math.max(0, b.rate - (nhgOn ? x.nhgRateDiscount : 0) + rateShock);
  const testRate = x.testRate > 0 ? x.testRate + rateShock : rate;
  const loan = loanFromMonthly(available, testRate, b.termYears);
  return {
    counted,
    pct,
    maxMonthly,
    obligations: { study: studyMonthly, loans, credit, lease: x.leaseMonth, alimony: x.alimonyMonth, total },
    available,
    rate,
    loan,
    nhg: nhgOn,
  };
}

// First year of an annuity: interest, repayment, and the tax relief.
export function mortgageCosts(p: PlanInput, loan: number, rate: number, year: number, priceNominal: number, bracketRate: number) {
  const { b, x } = p;
  const monthly = monthlyForLoan(loan, rate, b.termYears);
  const r = rate / 100 / 12;
  let bal = loan;
  let interest = 0;
  for (let i = 0; i < 12; i++) {
    const int = bal * r;
    interest += int;
    bal -= Math.max(0, monthly - int);
  }
  const principal = loan - bal;
  const woz = (priceNominal * x.wozPct) / 100;
  const law = lawAt(x, year);
  const relief = mortgageInterestRelief({
    interestYear: interest,
    woz,
    ewfPct: x.ewfPct,
    bracketRate,
    maxRate: law.reliefMaxRate,
    factorPct: x.reliefFactorPct,
  });
  const netMonthly = monthly - relief.benefit / 12;
  return { monthly, interestYear: interest, principalYear: principal, woz, relief, netMonthly };
}

export interface RunningCosts {
  maintenance: number;
  ozb: number;
  water: number;
  insurance: number;
  energy: number;
  vve: number;
  groundRent: number;
  total: number;
}

export function runningAt(p: PlanInput, m: number, priceNominal: number): RunningCosts {
  const { x } = p;
  const infl = growth(x.inflationPct, m);
  const r = x.running;
  const woz = (priceNominal * x.wozPct) / 100;
  const maintenance = (priceNominal * r.maintenancePct) / 100 / 12;
  const ozb = (woz * r.ozbPct) / 100 / 12;
  const water = (r.waterYear * infl) / 12;
  const insurance = r.insuranceMonth * infl;
  const energy = r.energyMonth * infl;
  const vve = r.vveMonth * infl;
  const groundRent = r.groundRentMonth * infl;
  return { maintenance, ozb, water, insurance, energy, vve, groundRent, total: maintenance + ozb + water + insurance + energy + vve + groundRent };
}

// ------------------------------------------------------------- purchase moment

export interface Purchase {
  m: number;
  year: number;
  date: string;
  price: number; // the asking price in that year
  paid: number; // what you really pay: asking price plus overbidding
  bid: number;
  cap: Capacity;
  loan: number;
  loanMode: string;
  maxLtv: number;
  costItems: { key: string; label: string; amount: number }[];
  costsTotal: number;
  transfer: ReturnType<typeof transferTax>;
  nhgFee: number;
  renovation: number;
  mortgage: ReturnType<typeof mortgageCosts>;
  running: RunningCosts;
  woonlast: number; // everything per month: mortgage after tax relief plus running costs
  housingFixed: number; // the fixed part (mortgage, OZB, water, insurance, VvE, ground rent)
  housingVsRent: number; // what a renter would compare: without energy
  netIncomeMonthly: number;
  woonquote: number;
  otherSpending: number;
  surplus: number;
  buffer: number;
  ownFunds: number;
  needTotal: number;
  ages: number[];
}

const COST_LABELS: Record<string, string> = {
  notary: "Notaris (levering en hypotheekakte)",
  valuation: "Taxatie",
  advice: "Hypotheekadvies",
  bankFee: "Afsluitprovisie bank",
  buyerAgent: "Aankoopmakelaar",
  inspection: "Bouwkundige keuring",
  bankGuarantee: "Bankgarantie",
  moving: "Verhuizing",
  furnishing: "Inrichting en meubels",
  other: "Overig",
};

export function purchaseAt(p: PlanInput, m: number, study: StudyPoint[]): Purchase {
  const { b, x } = p;
  const year = yearAtMonth(x.startDate, m);
  const infl = growth(x.inflationPct, m);
  const price = b.targetPrice * growth(x.priceGrowthPct, m);
  // The bank lends on the valuation (about the asking price); overbidding comes from own money.
  const bid = price * (x.bidPct / 100);
  const paid = price + bid;
  const renovation = x.renovation * infl;
  const cap = capacityAt(p, m, study, price);
  const rows = payroll(p, yearAtMonth(x.startDate, 0), year);
  const row = rows[rows.length - 1];
  const maxLtv = price + renovation + x.energyLoan;
  const ages = x.buyingTogether && row.netPartner ? [year - x.birthYear, year - x.partnerBirthYear] : [year - x.birthYear];
  const shares = ages.length === 2 ? [x.sharePctYou / 100, 1 - x.sharePctYou / 100] : [1];
  const transfer = transferTax({ price: paid, year, newBuild: x.newBuild, ages, shares, limit: lawAt(x, year).starterLimit });

  const netMonthlyIncome = row.netMonthly;
  const costItems = (Object.keys(COST_LABELS) as (keyof typeof x.costs)[]).map((k) => ({
    key: k,
    label: COST_LABELS[k],
    amount: x.costs[k] * infl,
  }));

  const rate = cap.rate;
  const bracket = row.bracketRate;
  const costFor = (loan: number) => mortgageCosts(p, loan, rate, year, price, bracket);
  const running = runningAt(p, m, price);
  const fixedRunning = running.ozb + running.water + running.insurance + running.vve + running.groundRent;

  let loan = Math.min(cap.loan + x.energyLoan, maxLtv);
  let loanMode = "Maximaal wat de bank geeft";
  if (x.borrowMode === "fixed") {
    loan = Math.min(x.borrowFixed, loan);
    loanMode = "Vast bedrag dat je zelf kiest";
  } else if (x.borrowMode === "comfort") {
    const target = (netMonthlyIncome * x.comfortPct) / 100;
    let lo = 0;
    let hi = loan;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (costFor(mid).netMonthly + fixedRunning > target) hi = mid;
      else lo = mid;
    }
    loan = lo;
    loanMode = `Wat past binnen ${x.comfortPct}% van je netto inkomen`;
  }
  loan = Math.max(0, loan);

  const nhgFee = cap.nhg ? loan * 0.004 : 0;
  const costsTotal = costItems.reduce((s, c) => s + c.amount, 0) + transfer.tax + nhgFee;
  const mortgage = costFor(loan);
  const otherSpending = x.otherSpendingMonth * infl;
  const woonlast = mortgage.netMonthly + running.total;
  const housingFixed = mortgage.netMonthly + fixedRunning;
  const housingVsRent = mortgage.netMonthly + running.total - running.energy;
  const buffer = x.bufferMonths * (otherSpending + mortgage.monthly + running.total);
  const ownFunds = Math.max(0, paid + renovation + costsTotal - loan);
  return {
    m,
    year,
    date: iso(dateAtMonth(x.startDate, m)),
    price,
    paid,
    bid,
    cap,
    loan,
    loanMode,
    maxLtv,
    costItems,
    costsTotal,
    transfer,
    nhgFee,
    renovation,
    mortgage,
    running,
    woonlast,
    housingFixed,
    housingVsRent,
    netIncomeMonthly: netMonthlyIncome,
    woonquote: netMonthlyIncome > 0 ? (housingFixed / netMonthlyIncome) * 100 : 0,
    otherSpending,
    surplus: netMonthlyIncome - woonlast - otherSpending - x.otherLoanMonth - x.leaseMonth - x.alimonyMonth,
    buffer,
    ownFunds,
    needTotal: ownFunds + buffer,
    ages,
  };
}

// ------------------------------------------------------------ the portfolio

export interface Alloc {
  save: number;
  bonds: number;
  stocks: number;
}

export interface Strategy {
  key: string;
  label: string;
  hint: string;
  alloc: Alloc | null; // null = as you do it now
}

export const STRATEGIES: Strategy[] = [
  { key: "now", label: "Jouw verdeling", hint: "zoals je nu spaart, obligaties koopt en belegt", alloc: null },
  { key: "save", label: "Alles sparen", hint: "alles op een spaarrekening", alloc: { save: 1, bonds: 0, stocks: 0 } },
  { key: "safe", label: "Veilig: sparen en obligaties", hint: "60% sparen, 40% obligaties", alloc: { save: 0.6, bonds: 0.4, stocks: 0 } },
  { key: "mixed", label: "Gemengd", hint: "30% sparen, 30% obligaties, 40% aandelen", alloc: { save: 0.3, bonds: 0.3, stocks: 0.4 } },
  { key: "stocks", label: "Alles aandelen", hint: "alles in aandelen of aandelenfondsen", alloc: { save: 0, bonds: 0, stocks: 1 } },
];

export function contributionFor(p: PlanInput, year: number): Contribution {
  const x = p.x;
  const explicit = x.contrib[String(year)];
  if (explicit) return explicit;
  // Nothing goes in before the first salary; growth counts from that year.
  const from = x.contribStartYear || Number(x.startDate.slice(0, 4));
  if (year < from) return { save: 0, bonds: 0, invest: 0 };
  const f = Math.pow(1 + x.contribGrowthPct / 100, year - from);
  const pf = x.buyingTogether && (x.partnerStartYear === 0 || year >= x.partnerStartYear) ? f : 0;
  return {
    save: (p.b.monthlySave + x.partnerMonthlySave * (pf > 0 ? 1 : 0)) * f,
    bonds: x.monthlyBonds * f,
    invest: (p.b.monthlyInvest + x.partnerMonthlyInvest * (pf > 0 ? 1 : 0)) * f,
  };
}

// What is in the accounts at the start, with the partner's part when buying together.
export function startBalances(p: PlanInput) {
  const { b, x } = p;
  const together = x.buyingTogether;
  return {
    save: b.startSavings + (together ? x.partnerStartSavings : 0),
    bonds: x.startBonds,
    stocks: b.startInvest + (together ? x.partnerStartInvest : 0),
  };
}

// Random numbers shared by all strategies, so they are compared on equal terms.
const noise = new Map<string, Float32Array>();
function normals(paths: number, months: number) {
  const key = `${paths}x${months}`;
  const hit = noise.get(key);
  if (hit) return hit;
  let s = 0x9e3779b9;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = new Float32Array(paths * months * 2);
  for (let i = 0; i < out.length; i += 2) {
    const u = Math.max(rnd(), 1e-12);
    const v = rnd();
    const r = Math.sqrt(-2 * Math.log(u));
    out[i] = r * Math.cos(2 * Math.PI * v);
    out[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
  if (noise.size > 6) noise.clear();
  noise.set(key, out);
  return out;
}

export interface SimResult {
  months: number;
  checkpoints: number[];
  p10: number[];
  p50: number[];
  p90: number[];
  low: number[];
  mid: number[];
  high: number[];
  endSamples: Float32Array | null;
  box3Paid: number;
}

interface SimArgs {
  alloc: Alloc | null;
  months: number; // simulated months
  target: number; // purchase month index (for the glide path)
  paths: number;
  fast?: boolean; // only the random paths: skips the three fixed scenarios
}

export function simulate(p: PlanInput, study: StudyPoint[], a: SimArgs): SimResult {
  const { b, x } = p;
  const M = a.months;
  const sb = startBalances(p);
  const startTotal = sb.save + sb.bonds + sb.stocks;
  const start: Alloc = a.alloc
    ? { save: startTotal * a.alloc.save, bonds: startTotal * a.alloc.bonds, stocks: startTotal * a.alloc.stocks }
    : { save: sb.save, bonds: sb.bonds, stocks: sb.stocks };
  const startYear = Number(x.startDate.slice(0, 4));
  const repayMonth = Math.max(0, monthsBetween(x.startDate, `${x.studyRepayYear}-01-01`));
  const glideM = Math.max(1, x.glideYears * 12);

  const contribAt = (m: number) => {
    const y = yearAtMonth(x.startDate, m);
    const c = contributionFor(p, y);
    const total = c.save + c.bonds + c.invest;
    const mix: Alloc = a.alloc ? { save: a.alloc.save, bonds: a.alloc.bonds, stocks: a.alloc.stocks } : {
      save: total > 0 ? c.save / total : 1,
      bonds: total > 0 ? c.bonds / total : 0,
      stocks: total > 0 ? c.invest / total : 0,
    };
    return { total, mix };
  };

  const eventAt = new Map<number, number>();
  for (const e of x.events) {
    const mi = Math.max(0, monthsBetween(x.startDate, `${e.year}-06-01`));
    eventAt.set(mi, (eventAt.get(mi) ?? 0) + e.amount);
  }
  if (x.studyExtraRepay > 0 && p.app.study.hasLoan) {
    eventAt.set(repayMonth, (eventAt.get(repayMonth) ?? 0) - x.studyExtraRepay);
  }

  const rs = mRate(b.savingsRate);
  const meanLog = (annual: number, vol: number) => (Math.log(1 + annual / 100) - (vol / 100) ** 2 / 2) / 12;
  const sdLog = (vol: number) => vol / 100 / Math.sqrt(12);
  const m0 = x.contribGrowthPct; // keeps lint quiet about unused growth
  void m0;

  const checkpoints: number[] = [];
  const first = a.target % 12;
  for (let m = first; m <= M; m += 12) checkpoints.push(m);
  if (!checkpoints.includes(a.target) && a.target <= M) checkpoints.push(a.target);
  checkpoints.sort((u, v) => u - v);
  const cpSet = new Set(checkpoints);

  let box3Paid = 0;

  // One path. mode "det": fixed returns with given annual rates. mode "mc": random.
  const run = (mode: "det" | "mc", z: Float32Array | null, pathIdx: number, rets: { bonds: number; stocks: number }, record: (m: number, total: number) => void) => {
    let S = start.save;
    let B = start.bonds;
    let A = start.stocks;
    const detB = mRate(rets.bonds);
    const detA = mRate(rets.stocks);
    const mlB = meanLog(rets.bonds, x.volBonds);
    const mlA = meanLog(rets.stocks, x.volStocks);
    const sdB = sdLog(x.volBonds);
    const sdA = sdLog(x.volStocks);
    const rho = x.correlation;
    const rho2 = Math.sqrt(Math.max(0, 1 - rho * rho));
    let fPrev = 1;
    record(0, S + B + A);
    for (let m = 1; m <= M; m++) {
      let rB: number;
      let rA: number;
      if (mode === "det" || !z) {
        rB = detB;
        rA = detA;
      } else {
        const zi = (pathIdx * M + (m - 1)) * 2;
        const z1 = z[zi];
        const z2 = z[zi + 1];
        rA = Math.exp(mlA + sdA * z1) - 1;
        rB = Math.exp(mlB + sdB * (rho * z1 + rho2 * z2)) - 1;
      }
      S *= 1 + rs;
      B *= 1 + rB;
      A *= 1 + rA;

      // glide path: out of risk into savings as the purchase gets close
      const f = x.glide ? Math.max(0, Math.min(1, (a.target - m) / glideM)) : 1;
      if (x.glide && f < fPrev) {
        const r = fPrev > 0 ? f / fPrev : 0;
        const moved = (A + B) * (1 - r);
        A *= r;
        B *= r;
        S += moved;
      }
      fPrev = f;

      const c = contribAt(m);
      const toRisk = x.glide ? f : 1;
      const riskShare = c.mix.bonds + c.mix.stocks;
      S += c.total * (c.mix.save + riskShare * (1 - toRisk));
      B += c.total * c.mix.bonds * toRisk;
      A += c.total * c.mix.stocks * toRisk;

      const ev = eventAt.get(m);
      if (ev) {
        if (ev >= 0) S += ev;
        else {
          let need = -ev;
          const fromS = Math.min(S, need);
          S -= fromS;
          need -= fromS;
          const fromB = Math.min(B, need);
          B -= fromB;
          need -= fromB;
          A = Math.max(0, A - need);
        }
      }

      // box 3, once a year (in the first month of the year)
      if (dateAtMonth(x.startDate, m).getMonth() === 0) {
        const debts = study[Math.min(m, study.length - 1)].balance;
        const t = box3Tax(S, B + A, debts, x.box3Persons, lawAt(x, dateAtMonth(x.startDate, m).getFullYear()).box3);
        if (t.tax > 0) {
          let need = t.tax;
          const fromS = Math.min(S, need);
          S -= fromS;
          need -= fromS;
          if (need > 0) {
            const share = B + A > 0 ? Math.min(1, need / (B + A)) : 0;
            B -= B * share;
            A -= A * share;
          }
          if (mode === "det" && m <= a.target) box3Paid += t.tax;
        }
      }
      if (cpSet.has(m)) record(m, S + B + A);
    }
    return startYear;
  };

  const mid = new Array<number>(checkpoints.length).fill(0);
  const low = new Array<number>(checkpoints.length).fill(0);
  const high = new Array<number>(checkpoints.length).fill(0);
  const idxOf = new Map(checkpoints.map((m, i) => [m, i]));
  const det = (arr: number[], rets: { bonds: number; stocks: number }) =>
    run("det", null, 0, rets, (m, t) => {
      const i = idxOf.get(m);
      if (i !== undefined) arr[i] = t;
    });
  let box3Mid = 0;
  if (!a.fast) {
    det(low, { bonds: x.bondsLow, stocks: b.returnLow });
    box3Paid = 0;
    det(mid, { bonds: x.bondsMid, stocks: b.returnMid });
    box3Mid = box3Paid;
    det(high, { bonds: x.bondsHigh, stocks: b.returnHigh });
  }

  const z = normals(a.paths, M);
  const values: Float32Array[] = checkpoints.map(() => new Float32Array(a.paths));
  for (let k = 0; k < a.paths; k++) {
    run("mc", z, k, { bonds: x.bondsMid, stocks: b.returnMid }, (m, t) => {
      const i = idxOf.get(m);
      if (i !== undefined) values[i][k] = t;
    });
  }
  const pct = (arr: Float32Array, q: number) => {
    const s = Float32Array.from(arr).sort();
    return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
  };
  const confIdx = checkpoints.indexOf(a.target);
  return {
    months: M,
    checkpoints,
    p10: values.map((v) => pct(v, 0.1)),
    p50: values.map((v) => pct(v, 0.5)),
    p90: values.map((v) => pct(v, 0.9)),
    low,
    mid,
    high,
    endSamples: confIdx >= 0 ? values[confIdx] : null,
    box3Paid: box3Mid,
  };
}

// ------------------------------------------------------------------ the plan

export interface YearRow {
  m: number;
  year: number;
  date: string;
  price: number;
  need: number;
  loan: number;
  ownFunds: number;
  p10: number;
  p50: number;
  p90: number;
  mid: number;
  enough10: boolean; // at the confidence level the user chose
  enough50: boolean;
  gap: number; // need - wealth at the chosen confidence
  woonquote: number;
  surplus: number;
  studyBalance: number;
}

export interface Insight {
  level: "ok" | "info" | "warn" | "bad";
  title: string;
  text: string;
}

export interface PlanResult {
  startYear: number;
  targetMonth: number;
  months: number;
  pay: PayRow[];
  study: StudyPoint[];
  purchase: Purchase; // at the target date
  now: Purchase; // as if you bought today
  sim: SimResult;
  years: YearRow[];
  earliest: YearRow | null;
  confidenceKey: "p10" | "p50";
  probEnough: number;
  shortfall: number; // need minus wealth at the confidence level
  enough: boolean;
  insights: Insight[];
}

const eur = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function computePlan(p: PlanInput, paths = 600): PlanResult {
  const { b, x } = p;
  const startYear = Number(x.startDate.slice(0, 4));
  const T = Math.max(1, monthsBetween(x.startDate, b.targetDate));
  const M = T + 60;
  const study = studyPath(p, M);
  const pay = payroll(p, startYear, yearAtMonth(x.startDate, M));
  const purchase = purchaseAt(p, T, study);
  const now = purchaseAt(p, 0, study);
  const sim = simulate(p, study, { alloc: null, months: M, target: T, paths });

  const conf = Math.min(99, Math.max(50, x.confidencePct));
  const q = 1 - conf / 100;
  const quant = (i: number) => {
    // percentile at the chosen confidence from the three stored ones (p10 / p50)
    return q <= 0.1 ? sim.p10[i] : sim.p10[i] + ((q - 0.1) / 0.4) * (sim.p50[i] - sim.p10[i]);
  };

  const years: YearRow[] = sim.checkpoints
    .map((m, i) => {
      const pu = purchaseAt(p, m, study);
      const w = quant(i);
      return {
        m,
        year: pu.year,
        date: pu.date,
        price: pu.price,
        need: pu.needTotal,
        loan: pu.loan,
        ownFunds: pu.ownFunds,
        p10: sim.p10[i],
        p50: sim.p50[i],
        p90: sim.p90[i],
        mid: sim.mid[i],
        enough10: w >= pu.needTotal,
        enough50: sim.p50[i] >= pu.needTotal,
        gap: pu.needTotal - w,
        woonquote: pu.woonquote,
        surplus: pu.surplus,
        studyBalance: study[Math.min(m, study.length - 1)].balance,
      };
    })
    .filter((r) => r.m >= 0);
  const earliest = years.find((r) => r.enough10) ?? null;

  const ti = sim.checkpoints.indexOf(T);
  const wealthT = ti >= 0 ? quant(ti) : 0;
  const shortfall = purchase.needTotal - wealthT;
  let probEnough = 0;
  if (sim.endSamples) {
    let ok = 0;
    for (let i = 0; i < sim.endSamples.length; i++) if (sim.endSamples[i] >= purchase.needTotal) ok++;
    probEnough = ok / sim.endSamples.length;
  }

  const result: PlanResult = {
    startYear,
    targetMonth: T,
    months: M,
    pay,
    study,
    purchase,
    now,
    sim,
    years,
    earliest,
    confidenceKey: q <= 0.1 ? "p10" : "p50",
    probEnough,
    shortfall,
    enough: shortfall <= 0,
    insights: [],
  };
  result.insights = buildInsights(p, result, wealthT);
  return result;
}

// --------------------------------------------------------- thinking along

function buildInsights(p: PlanInput, r: PlanResult, wealthT: number): Insight[] {
  const { b, x, app } = p;
  const out: Insight[] = [];
  const pu = r.purchase;
  const T = r.targetMonth;
  const yearsLeft = T / 12;
  const add = (level: Insight["level"], title: string, text: string) => out.push({ level, title, text });

  // 1. the verdict
  const conf = x.confidencePct;
  if (r.enough) {
    add("ok", `Het lukt in ${pu.year}, ook bij tegenvallende rendementen`, `Met ${conf}% zekerheid heb je dan ${eur(wealthT)} tegenover ${eur(pu.needTotal)} nodig (eigen geld ${eur(pu.ownFunds)} plus buffer ${eur(pu.buffer)}). De kans dat het lukt is ${Math.round(r.probEnough * 100)}%.`);
  } else {
    add("bad", `Tekort van ${eur(r.shortfall)} in ${pu.year}`, `Met ${conf}% zekerheid heb je ${eur(wealthT)} tegenover ${eur(pu.needTotal)} nodig. De kans dat het lukt is ${Math.round(r.probEnough * 100)}%. Wat dichter kan helpen: later kopen, meer inleggen, een lagere prijs of meer lenen.`);
  }
  if (r.earliest && r.earliest.m < T) {
    add("info", `Vroegste jaar waarin het kan: ${r.earliest.year}`, `Dan heb je met ${conf}% zekerheid ${eur(r.earliest.p10)} tegenover ${eur(r.earliest.need)} nodig.`);
  } else if (!r.earliest) {
    add("warn", "In de gesimuleerde jaren lukt het niet", "Binnen de komende jaren haal je het niet met de huidige inleg. Kijk bij Sparen en beleggen naar meer inleg of een andere prijs.");
  }

  // 2. the price runs away
  const nominalGrowth = pu.price - b.targetPrice;
  if (nominalGrowth > 0) {
    add("info", "De prijs loopt mee omhoog", `Bij ${x.priceGrowthPct.toString().replace(".", ",")}% prijsstijging per jaar kost je woning in ${pu.year} ${eur(pu.price)} in plaats van ${eur(b.targetPrice)}. Dat is ${eur(nominalGrowth)} erbij.`);
  }
  const realSave = b.savingsRate - x.priceGrowthPct;
  if (realSave < 0) {
    add("warn", "Sparen loopt achter op de huizenprijs", `Spaarrente ${b.savingsRate}% tegenover ${x.priceGrowthPct}% prijsstijging: wat je spaart wordt ten opzichte van de woning elk jaar ongeveer ${Math.abs(realSave).toFixed(1).replace(".", ",")} procentpunt minder waard.`);
  }

  // 3. the mortgage
  if (pu.cap.loan < pu.price - 1) {
    add("info", `De bank geeft ongeveer ${eur(pu.cap.loan)}`, `Dat is ${Math.round((pu.cap.loan / pu.price) * 100)}% van de verwachte prijs. Het deel dat de bank niet geeft (${eur(Math.max(0, pu.price - pu.cap.loan))}) komt uit eigen geld, plus kosten koper van ${eur(pu.costsTotal)}.`);
  } else {
    add("ok", "De hypotheek past ruim", `Op basis van je inkomen kun je de volledige prijs lenen. Kijk of je dat ook wilt: de maandlast na belasting is ongeveer ${eur(pu.mortgage.netMonthly)}.`);
  }
  if (app.study.hasLoan) {
    const sBal = r.study[Math.min(T, r.study.length - 1)].balance;
    const withoutStudy = capacityAt(p, T, r.study, pu.price, 0, 0);
    const lost = Math.max(0, withoutStudy.loan - pu.cap.loan);
    if (lost > 500) {
      add("warn", `Je studielening kost je ongeveer ${eur(lost)} aan hypotheek`, `Banken tellen ${eur(pu.cap.obligations.study)} per maand mee. Bij de aankoop staat er dan nog ${eur(sBal)} open. Op de pagina Studielening zie je wat extra aflossen oplevert.`);
    }
  }
  const shocked = capacityAt(p, T, r.study, pu.price, x.rateShock);
  const rateLoss = pu.cap.loan - shocked.loan;
  if (rateLoss > 2000) {
    add("info", `Bij ${x.rateShock.toString().replace(".", ",")} procentpunt hogere rente leen je ${eur(rateLoss)} minder`, `Je maximale hypotheek zakt dan naar ongeveer ${eur(shocked.loan)}.`);
  }

  // 4. affordability after purchase
  if (pu.woonquote > 35) {
    add("bad", `Vaste woonlasten zijn ${Math.round(pu.woonquote)}% van je netto inkomen`, `Dat is hoog. Rond ${x.comfortPct}% is een voorzichtige grens. Je houdt maandelijks ongeveer ${eur(pu.surplus)} over na woonlasten en leefgeld.`);
  } else if (pu.woonquote > x.comfortPct) {
    add("warn", `Vaste woonlasten zijn ${Math.round(pu.woonquote)}% van je netto inkomen`, `Net boven je eigen grens van ${x.comfortPct}%. Je houdt ongeveer ${eur(pu.surplus)} per maand over.`);
  } else if (pu.netIncomeMonthly > 0) {
    add("ok", `Vaste woonlasten zijn ${Math.round(pu.woonquote)}% van je netto inkomen`, `Dat past binnen je eigen grens van ${x.comfortPct}%. Je houdt ongeveer ${eur(pu.surplus)} per maand over.`);
  }
  if (pu.surplus < 0 && pu.netIncomeMonthly > 0) {
    add("bad", "Maandelijks tekort na de aankoop", `Netto inkomen min woonlasten min je gebruikelijke uitgaven geeft ${eur(pu.surplus)} per maand. Dat is onhoudbaar zonder dat je iets aanpast.`);
  }
  if (x.rentNow > 0 && pu.woonlast > 0) {
    const diff = pu.housingVsRent - x.rentNow * growth(x.inflationPct, T);
    add("info", `Wonen gaat ${diff >= 0 ? "meer" : "minder"} kosten dan huren`, `Netto woonlast (zonder energie) ${eur(pu.housingVsRent)} per maand, tegenover ${eur(x.rentNow * growth(x.inflationPct, T))} huur (met inflatie). Het verschil is ${eur(Math.abs(diff))} per maand. Een deel van wat je betaalt is aflossing: ${eur(pu.mortgage.principalYear / 12)} per maand bouwt eigen vermogen op.`);
  }

  // 5. taxes
  if (pu.transfer.tax > 0) {
    add("info", `Overdrachtsbelasting: ${eur(pu.transfer.tax)}`, pu.transfer.note);
  } else if (!x.newBuild) {
    add("ok", "Startersvrijstelling", `Je bent bij de levering ${pu.ages.join(" en ")} jaar en de koopsom ligt onder de grens: geen overdrachtsbelasting. Dat scheelt ${eur(pu.price * 0.02)}.`);
  }
  const ageLimit = x.birthYear + 35 - pu.year;
  if (ageLimit === 0 || ageLimit === 1) {
    add("warn", "De startersvrijstelling loopt bijna af", `Je wordt in ${x.birthYear + 35} 35. Op de dag van levering moet je jonger dan 35 zijn. Verschuift je streefdatum voorbij je 35e verjaardag, dan betaal je 2% (${eur(pu.price * 0.02)}).`);
  }
  if (r.sim.box3Paid > 100) {
    add("info", `Box 3 kost je tot de aankoop ongeveer ${eur(r.sim.box3Paid)}`, "Dat is vermogensbelasting over sparen en beleggen boven het heffingsvrije bedrag, geschat met de fictieve rendementen. Het rendement dat je ziet is al na deze belasting.");
  }
  const tp = r.pay[Math.min(r.pay.length - 1, Math.max(0, pu.year - r.startYear))];
  if (tp) {
    add("info", `Belastingdruk in ${tp.year}: ${(tp.avgRate * 100).toFixed(1).replace(".", ",")}% gemiddeld, ${Math.round(tp.marginalRate * 100)}% over elke extra euro`, `Van ${eur(tp.gross)} bruto blijft ${eur(tp.net)} netto over (${eur(tp.netMonthly)} per maand). De hypotheekrente-aftrek is in dat jaar ongeveer ${eur(pu.mortgage.relief.benefit)} waard.`);
  }

  // 6. the way you invest
  const horizon = yearsLeft;
  const stocksShare = (() => {
    const tot = b.startSavings + x.startBonds + b.startInvest;
    return tot > 0 ? b.startInvest / tot : 0;
  })();
  if (horizon < 5 && stocksShare > 0.3) {
    add("warn", "Een groot deel in aandelen met een korte horizon", `Je koopt over ${horizon.toFixed(1).replace(".", ",")} jaar en ${Math.round(stocksShare * 100)}% van wat je nu hebt zit in aandelen. Op die termijn kunnen aandelen flink lager staan. Kijk bij Sparen en beleggen hoe de uitkomst per verdeling verschilt, en probeer het afbouwen in de laatste jaren.`);
  }
  if (horizon >= 8 && stocksShare === 0 && b.startSavings + x.startBonds > 0 && b.monthlyInvest === 0) {
    add("info", "Alles staat veilig, met een lange horizon", `Bij ${horizon.toFixed(0)} jaar kan een deel in beleggingen meer rendement geven, maar ook tegenvallen. Vergelijk de verdelingen op de pagina Sparen en beleggen.`);
  }

  // 7. the buffer and the budget
  if (x.bufferMonths < 3) {
    add("warn", "Weinig buffer na de aankoop", `Je rekent met ${x.bufferMonths} maanden buffer. Een buffer van 3 tot 6 maanden aan vaste lasten is gebruikelijk.`);
  }
  const need = x.otherSpendingMonth;
  if (need <= 0) {
    add("warn", "Je gebruikelijke uitgaven zijn niet ingevuld", "Zonder je gewone uitgaven per maand kan het plan niet zien of je woonlasten betaalbaar zijn. Vul het in bij Huis en kosten.");
  }
  const saveNow = b.monthlySave + b.monthlyInvest + x.monthlyBonds;
  if (app.avgSaved > 0 && saveNow > app.avgSaved * 1.3) {
    add("warn", "Je plant meer in dan je de afgelopen maanden deed", `Het plan gaat uit van ${eur(saveNow)} per maand. Je hebt de laatste maanden gemiddeld ${eur(app.avgSaved)} opzij gezet.`);
  }
  if (app.avgIncome > 0 && app.avgSpentExSaving > 0) {
    const free = app.avgIncome - app.avgSpentExSaving;
    if (saveNow > free + 50) {
      add("warn", "De geplande inleg past niet in wat je overhoudt", `Gemiddeld bleef er de laatste maanden ${eur(free)} per maand over vóór sparen, en je plant ${eur(saveNow)} in.`);
    }
  }

  // 9. the extra variables
  if (x.buyingTogether && pu.ages.length === 1) {
    add("warn", "Je koopt samen, maar je partner heeft in dat jaar nog geen inkomen", `Het inkomen van je partner telt pas mee als je een bruto inkomen invult bij Inkomen. Het plan rekent nu met alleen jouw inkomen. Haar startjaar staat op ${x.partnerStartYear || "nu"}.`);
  }
  if (x.bidPct > 0) {
    add("info", `Overbieden kost je ${eur(pu.bid)}`, `Bij ${x.bidPct.toString().replace(".", ",")}% boven de vraagprijs betaal je ${eur(pu.paid)} in plaats van ${eur(pu.price)}. De bank leent op de taxatiewaarde, dus dit bedrag komt uit je eigen geld. Het is niet af te trekken van je hypotheek.`);
  }
  if (x.reliefFactorPct < 100) {
    add("info", `Hypotheekrenteaftrek staat op ${x.reliefFactorPct}%`, `Je rekent met ${x.reliefFactorPct}% van de huidige aftrek. Dat scheelt je ${eur(pu.mortgage.relief.benefit / Math.max(0.0001, x.reliefFactorPct / 100) - pu.mortgage.relief.benefit)} per jaar vergeleken met de regels van vandaag.`);
  }
  if (x.emergencyMonths > 0 && x.fixedCostsMonth > 0) {
    const target = x.emergencyMonths * x.fixedCostsMonth;
    const first = contributionFor(p, Math.max(r.startYear, x.contribStartYear || r.startYear));
    const perMonth = first.save + first.bonds + first.invest;
    const monthsToFill = perMonth > 0 ? Math.ceil(target / perMonth) : null;
    add("info", `Noodbuffer: ${eur(target)}`, monthsToFill === null ? `${x.emergencyMonths} maanden aan vaste lasten van ${eur(x.fixedCostsMonth)}. Er gaat nog niets in, dus de buffer vult zich niet.` : `${x.emergencyMonths} maanden aan vaste lasten van ${eur(x.fixedCostsMonth)}. Bij ${eur(perMonth)} inleg per maand duurt het ${monthsToFill} maanden (${(monthsToFill / 12).toFixed(1).replace(".", ",")} jaar) voor die vol is. Tot dan telt wat je overhoudt niet als geld voor de woning. Na de aankoop is dit hetzelfde geld als de buffer in het plan.`);
  }
  const ruleOfThumb = (pu.cap.counted * 4.25);
  if (pu.cap.counted > 0 && Math.abs(ruleOfThumb - pu.cap.loan) / Math.max(1, ruleOfThumb) > 0.15) {
    add("info", "Vuistregel en rekenmodel verschillen", `De vuistregel 4,25 keer bruto inkomen geeft ${eur(ruleOfThumb)}. Het plan rekent met het Nibud-percentage, je verplichtingen en de rente en komt op ${eur(pu.cap.loan)}. Het verschil komt door je studielening, de rente en de looptijd.`);
  }

  // 8. waiting
  if (T > 12) {
    const next = purchaseAt(p, T + 12, r.study);
    const gain = next.cap.loan - pu.cap.loan;
    const priceUp = next.price - pu.price;
    add("info", "Wat een jaar langer wachten doet", `Je hypotheek stijgt met ongeveer ${eur(gain)} (hoger salaris), de woning wordt ${eur(priceUp)} duurder. ${gain >= priceUp ? "De hypotheek groeit dus harder dan de prijs." : "De prijs groeit dus harder dan je hypotheek."}`);
  }
  return out;
}

// ------------------------------------------------ strategies side by side

export interface StrategyResult {
  key: string;
  label: string;
  hint: string;
  p10: number;
  p50: number;
  p90: number;
  low: number;
  mid: number;
  high: number;
  probEnough: number;
  expectedShortfall: number;
}

export function compareStrategies(p: PlanInput, r: PlanResult, paths = 400): StrategyResult[] {
  const T = r.targetMonth;
  const need = r.purchase.needTotal;
  return STRATEGIES.map((s) => {
    const sim = simulate(p, r.study, { alloc: s.alloc, months: T, target: T, paths });
    const i = sim.checkpoints.indexOf(T);
    let ok = 0;
    let short = 0;
    const samples = sim.endSamples;
    if (samples) {
      for (let k = 0; k < samples.length; k++) {
        if (samples[k] >= need) ok++;
        else short += need - samples[k];
      }
    }
    return {
      key: s.key,
      label: s.label,
      hint: s.hint,
      p10: sim.p10[i],
      p50: sim.p50[i],
      p90: sim.p90[i],
      low: sim.low[i],
      mid: sim.mid[i],
      high: sim.high[i],
      probEnough: samples ? ok / samples.length : 0,
      expectedShortfall: samples ? short / samples.length : 0,
    };
  });
}

// The extra monthly amount that would close a gap, at the expected return.
export function extraPerMonth(gap: number, months: number, annualPct: number) {
  if (gap <= 0 || months <= 0) return 0;
  const r = mRate(annualPct);
  const f = r === 0 ? months : (Math.pow(1 + r, months) - 1) / r;
  return gap / f;
}
