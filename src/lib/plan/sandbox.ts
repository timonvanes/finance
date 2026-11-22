import type { Scenario } from "./types";

// The test environment: a few sliders on top of a scenario. Nothing is saved until the person
// chooses to keep the result as a new scenario.
export interface Sandbox {
  shiftYears: number; // buying later, in whole years
  price: number; // asking price today
  priceGrowth: number; // % per year
  bid: number; // overbidding, %
  salary: number; // gross salary per year now (without holiday allowance); later years move along
  salaryGrowth: number; // salary growth per year, %
  partnerGross: number; // partner's gross salary (0 = buying alone)
  workStart: number; // your first year with a salary (0 = already working)
  partnerStart: number; // the partner's first year with a salary (0 = already working)
  rate: number; // mortgage rate, %
  buffer: number; // months of buffer after the purchase
  renovation: number;
}

export function sandboxOf(sc: Scenario): Sandbox {
  return {
    shiftYears: 0,
    price: sc.b.targetPrice,
    priceGrowth: sc.x.priceGrowthPct,
    bid: sc.x.bidPct,
    salary: sc.b.incomeGrossYear,
    salaryGrowth: sc.x.salaryGrowthPct,
    partnerGross: sc.x.buyingTogether ? sc.b.partnerIncomeGrossYear : 0,
    workStart: sc.x.workStartYear,
    partnerStart: sc.x.partnerStartYear,
    rate: sc.b.rate,
    buffer: sc.x.bufferMonths,
    renovation: sc.x.renovation,
  };
}

const grow = (v: number, factor: number, extra: number, years: number) => v * factor * Math.pow(1 + extra / 100, Math.max(0, years));
const extraOf = (s: Sandbox, was: Sandbox) => s.salaryGrowth - was.salaryGrowth;

// The scenario with the sliders applied, on a copy. The variants move along: where stress or
// gunstig has a figure of its own for something, it shifts by the same amount as the basis.
export function applySandbox(base: Scenario, s: Sandbox): Scenario {
  const sc: Scenario = JSON.parse(JSON.stringify(base));
  const was = sandboxOf(base);
  const startYear = Number(sc.x.startDate.slice(0, 4));
  // The salary you type replaces the one of now; the explicit salaries of later years scale with it.
  const factor = was.salary > 0 ? s.salary / was.salary : 1;
  const extra = extraOf(s, was);

  const [y, rest] = [Number(sc.b.targetDate.slice(0, 4)), sc.b.targetDate.slice(4)];
  sc.b.targetDate = `${y + s.shiftYears}${rest}`;
  sc.b.targetPrice = s.price;
  sc.b.rate = s.rate;
  sc.x.priceGrowthPct = s.priceGrowth;
  sc.x.bidPct = s.bid;
  sc.x.bufferMonths = s.buffer;
  sc.x.workStartYear = s.workStart;
  sc.x.partnerStartYear = s.partnerStart;
  sc.x.renovation = s.renovation;

  // salaries: scaled, and grown by the extra growth from the first year on
  sc.b.incomeGrossYear = s.salary;
  const rescale = (m: Record<string, number>) => {
    for (const k of Object.keys(m)) m[k] = Math.round(grow(m[k], factor, extra, Number(k) - startYear));
  };
  rescale(sc.x.salaryYou);
  sc.x.salaryGrowthPct = s.salaryGrowth;

  // the variants move with the basis
  for (const key of ["stress", "gunstig"] as const) {
    const ov = sc.variants[key];
    rescale(ov.salaryYou);
    if ("salaryGrowthPct" in ov.fields) ov.fields.salaryGrowthPct = Number(ov.fields.salaryGrowthPct) + extra;
    if ("priceGrowthPct" in ov.fields) ov.fields.priceGrowthPct = Number(ov.fields.priceGrowthPct) + (s.priceGrowth - was.priceGrowth);
    if ("bidPct" in ov.fields) ov.fields.bidPct = Math.max(0, Number(ov.fields.bidPct) + (s.bid - was.bid));
  }

  // partner
  if (s.partnerGross > 0) {
    sc.x.buyingTogether = true;
    sc.b.partnerIncomeGrossYear = s.partnerGross;
    if (sc.x.partnerGrowthPct === 0) sc.x.partnerGrowthPct = sc.x.salaryGrowthPct;
  } else {
    sc.x.buyingTogether = false;
  }
  return sc;
}

export function describeSandbox(base: Scenario, s: Sandbox): string {
  const was = sandboxOf(base);
  const parts: string[] = [];
  const eur = (n: number) => n.toLocaleString("nl-NL", { maximumFractionDigits: 0 });
  if (s.shiftYears) parts.push(`${s.shiftYears} jaar later kopen`);
  if (s.price !== was.price) parts.push(`prijs € ${eur(s.price)}`);
  if (s.priceGrowth !== was.priceGrowth) parts.push(`prijsstijging ${s.priceGrowth}%`);
  if (s.bid !== was.bid) parts.push(`overbod ${s.bid}%`);
  if (s.salary !== was.salary) parts.push(`salaris € ${eur(s.salary)}`);
  if (s.salaryGrowth !== was.salaryGrowth) parts.push(`salarisgroei ${s.salaryGrowth}%`);
  if (s.partnerGross !== was.partnerGross) parts.push(s.partnerGross > 0 ? `samen, partner € ${eur(s.partnerGross)}` : "alleen");
  if (s.workStart !== was.workStart) parts.push(s.workStart ? `jij begint in ${s.workStart}` : "jij werkt al");
  if (s.partnerStart !== was.partnerStart && s.partnerGross > 0) parts.push(s.partnerStart ? `partner begint in ${s.partnerStart}` : "partner werkt al");
  if (s.rate !== was.rate) parts.push(`rente ${s.rate}%`);
  if (s.buffer !== was.buffer) parts.push(`buffer ${s.buffer} mnd`);
  if (s.renovation !== was.renovation) parts.push(`verbouwing € ${eur(s.renovation)}`);
  return parts.length ? `Uit ${base.name}: ${parts.join(", ")}.` : `Kopie van ${base.name}.`;
}
