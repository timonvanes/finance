import {
  monthsBetween,
  purchaseAt,
  simulate,
  studyPath,
  startBalances,
  type PlanInput,
  type SimResult,
} from "./model";

// Questions the plan can answer by trying values:
//  - how much must I put in each month to make it?
//  - what can I buy in a given year?

const quantile = (sim: SimResult, i: number, confPct: number) => {
  const q = 1 - Math.min(99, Math.max(50, confPct)) / 100;
  return q <= 0.1 ? sim.p10[i] : sim.p10[i] + ((q - 0.1) / 0.4) * (sim.p50[i] - sim.p10[i]);
};

// Everything that goes in every month, multiplied by k.
function scaled(p: PlanInput, k: number): PlanInput {
  const { b, x } = p;
  const total = b.monthlySave + b.monthlyInvest + x.monthlyBonds + x.partnerMonthlySave + x.partnerMonthlyInvest;
  // Nothing goes in yet: start from an even split between saving and investing.
  const seed = total > 0 ? null : { save: 1, invest: 1 };
  const contrib = Object.fromEntries(
    Object.entries(x.contrib).map(([y, c]) => [y, { save: c.save * k, bonds: c.bonds * k, invest: c.invest * k }])
  );
  return {
    ...p,
    b: { ...b, monthlySave: (seed ? seed.save : b.monthlySave) * k, monthlyInvest: (seed ? seed.invest : b.monthlyInvest) * k },
    x: {
      ...x,
      monthlyBonds: x.monthlyBonds * k,
      partnerMonthlySave: x.partnerMonthlySave * k,
      partnerMonthlyInvest: x.partnerMonthlyInvest * k,
      contrib,
    },
  };
}

export interface RequiredMonthly {
  feasible: boolean;
  perMonth: number; // total per month, in the first year money goes in
  current: number;
  extra: number;
  split: { save: number; bonds: number; invest: number };
  months: number;
  wealth: number;
  need: number;
}

// The smallest monthly amount (all accounts together, in the same proportion as now)
// that reaches the amount needed at the chosen certainty.
export function requiredMonthly(p: PlanInput, paths = 300): RequiredMonthly {
  const { b, x } = p;
  const T = Math.max(1, monthsBetween(x.startDate, b.targetDate));
  const study = studyPath(p, T + 1);
  const need = purchaseAt(p, T, study).needTotal;
  const cache = new Map<number, number>();
  const wealthFor = (k: number) => {
    const hit = cache.get(k);
    if (hit !== undefined) return hit;
    const sim = simulate(scaled(p, k), study, { alloc: null, months: T, target: T, paths, fast: true });
    const w = quantile(sim, sim.checkpoints.indexOf(T), x.confidencePct);
    cache.set(k, w);
    return w;
  };
  const current = b.monthlySave + b.monthlyInvest + x.monthlyBonds + x.partnerMonthlySave + x.partnerMonthlyInvest;
  if (wealthFor(0) >= need) {
    return { feasible: true, perMonth: 0, current, extra: 0, split: { save: 0, bonds: 0, invest: 0 }, months: T, wealth: wealthFor(0), need };
  }
  let lo = 0;
  let hi = 4;
  while (hi < 400 && wealthFor(hi) < need) {
    lo = hi;
    hi *= 2;
  }
  const feasible = wealthFor(hi) >= need;
  if (feasible) {
    for (let i = 0; i < 11; i++) {
      const mid = (lo + hi) / 2;
      if (wealthFor(mid) >= need) hi = mid;
      else lo = mid;
    }
  }
  const k = hi;
  const q = scaled(p, k);
  const sb = startBalances(q);
  void sb;
  const first = {
    save: q.b.monthlySave + (x.buyingTogether ? q.x.partnerMonthlySave : 0),
    bonds: q.x.monthlyBonds,
    invest: q.b.monthlyInvest + (x.buyingTogether ? q.x.partnerMonthlyInvest : 0),
  };
  const perMonth = first.save + first.bonds + first.invest;
  return {
    feasible,
    perMonth,
    current,
    extra: Math.max(0, perMonth - current),
    split: first,
    months: T,
    wealth: wealthFor(k),
    need,
  };
}

export interface MaxPrice {
  price: number; // in today's euros
  nominal: number;
  wealth: number;
  year: number;
}

// The highest price (in today's euros) that fits the money you will have in a given year.
export function maxPriceInYear(p: PlanInput, year: number, paths = 300): MaxPrice | null {
  const { x } = p;
  const date = `${year}-01-01`;
  const T = monthsBetween(x.startDate, date);
  if (T < 1) return null;
  const study = studyPath(p, T + 1);
  const sim = simulate(p, study, { alloc: null, months: T, target: T, paths, fast: true });
  const wealth = quantile(sim, sim.checkpoints.indexOf(T), x.confidencePct);
  const fits = (price: number) => {
    const q: PlanInput = { ...p, b: { ...p.b, targetPrice: price, targetDate: date } };
    return purchaseAt(q, T, study).needTotal <= wealth;
  };
  let lo = 0;
  let hi = 4_000_000;
  if (!fits(30_000)) return { price: 0, nominal: 0, wealth, year };
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  const q: PlanInput = { ...p, b: { ...p.b, targetPrice: lo, targetDate: date } };
  return { price: lo, nominal: purchaseAt(q, T, study).price, wealth, year };
}
