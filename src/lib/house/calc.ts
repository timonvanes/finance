export interface HouseInputs {
  targetDate: string;
  targetPrice: number;
  incomeGrossYear: number;
  partnerIncomeGrossYear: number;
  rate: number;
  termYears: number;
  costPct: number;
  housingPct: number;
  studentMonthly: number;
  startSavings: number;
  startInvest: number;
  monthlySave: number;
  monthlyInvest: number;
  savingsRate: number;
  returnLow: number;
  returnMid: number;
  returnHigh: number;
}

const monthlyRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;

// Present value of a monthly payment stream: the loan a monthly amount supports.
export function loanFromMonthly(monthly: number, ratePct: number, years: number) {
  const r = ratePct / 100 / 12;
  const n = years * 12;
  if (monthly <= 0) return 0;
  return r === 0 ? monthly * n : (monthly * (1 - Math.pow(1 + r, -n))) / r;
}

export function monthlyForLoan(loan: number, ratePct: number, years: number) {
  const r = ratePct / 100 / 12;
  const n = years * 12;
  if (loan <= 0) return 0;
  return r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
}

export function monthsUntil(targetIso: string, now = new Date()) {
  const t = new Date(`${targetIso}T00:00:00`);
  return Math.max(0, (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth()));
}

// Indicative only: a share of gross monthly income may go to housing, minus
// what the study loan takes. Lenders apply their own tables.
export function mortgageCapacity(i: HouseInputs) {
  const grossMonthly = (i.incomeGrossYear + i.partnerIncomeGrossYear) / 12;
  const housingBudget = Math.max(0, (grossMonthly * i.housingPct) / 100 - i.studentMonthly);
  const maxLoan = loanFromMonthly(housingBudget, i.rate, i.termYears);
  return { grossMonthly, housingBudget, maxLoan };
}

export function ownFundsNeeded(i: HouseInputs, maxLoan: number) {
  const costs = (i.targetPrice * i.costPct) / 100;
  const shortfallOnPrice = Math.max(0, i.targetPrice - maxLoan);
  return { costs, shortfallOnPrice, total: costs + shortfallOnPrice };
}

export type Scenario = "keep" | "save" | "invest";

export interface Point {
  month: number;
  low: number;
  mid: number;
  high: number;
}

// Balance month by month. Money put into savings grows at the savings rate;
// money invested grows at each return assumption (low / mid / high).
export function project(i: HouseInputs, scenario: Scenario, months: number): Point[] {
  const startSave = scenario === "keep" ? i.startSavings : scenario === "save" ? i.startSavings + i.startInvest : 0;
  const startInv = scenario === "keep" ? i.startInvest : scenario === "save" ? 0 : i.startSavings + i.startInvest;
  const total = i.monthlySave + i.monthlyInvest;
  const monthlySave = scenario === "keep" ? i.monthlySave : scenario === "save" ? total : 0;
  const monthlyInv = scenario === "keep" ? i.monthlyInvest : scenario === "save" ? 0 : total;

  const rs = monthlyRate(i.savingsRate);
  const rates = { low: monthlyRate(i.returnLow), mid: monthlyRate(i.returnMid), high: monthlyRate(i.returnHigh) };
  let save = startSave;
  const inv = { low: startInv, mid: startInv, high: startInv };
  const points: Point[] = [{ month: 0, low: save + inv.low, mid: save + inv.mid, high: save + inv.high }];
  for (let m = 1; m <= months; m++) {
    save = save * (1 + rs) + monthlySave;
    inv.low = inv.low * (1 + rates.low) + monthlyInv;
    inv.mid = inv.mid * (1 + rates.mid) + monthlyInv;
    inv.high = inv.high * (1 + rates.high) + monthlyInv;
    points.push({ month: m, low: save + inv.low, mid: save + inv.mid, high: save + inv.high });
  }
  return points;
}

// Extra amount per month that closes a gap by the target date, at a given return.
export function extraMonthlyToClose(gap: number, annualPct: number, months: number) {
  if (gap <= 0 || months <= 0) return 0;
  const r = monthlyRate(annualPct);
  const factor = r === 0 ? months : (Math.pow(1 + r, months) - 1) / r;
  return gap / factor;
}
