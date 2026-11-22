import type { Scenario } from "./types";

// The test environment: a few sliders on top of a scenario. Nothing is saved until the person
// chooses to keep the result as a new scenario.
export interface Sandbox {
  shiftYears: number; // buying later, in whole years
  price: number; // asking price today
  priceGrowth: number; // % per year
  bid: number; // overbidding, %
  salaryPct: number; // all salaries higher or lower than now, %
  extraGrowth: number; // extra salary growth per year, percentage points
  partnerGross: number; // partner's gross salary (0 = buying alone)
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
    salaryPct: 0,
    extraGrowth: 0,
    partnerGross: sc.x.buyingTogether ? sc.b.partnerIncomeGrossYear : 0,
    rate: sc.b.rate,
    buffer: sc.x.bufferMonths,
    renovation: sc.x.renovation,
  };
}

const grow = (v: number, factor: number, extra: number, years: number) => v * factor * Math.pow(1 + extra / 100, Math.max(0, years));

// The scenario with the sliders applied, on a copy. The variants move along: where stress or
// gunstig has a figure of its own for something, it shifts by the same amount as the basis.
export function applySandbox(base: Scenario, s: Sandbox): Scenario {
  const sc: Scenario = JSON.parse(JSON.stringify(base));
  const was = sandboxOf(base);
  const startYear = Number(sc.x.startDate.slice(0, 4));
  const factor = 1 + s.salaryPct / 100;

  const [y, rest] = [Number(sc.b.targetDate.slice(0, 4)), sc.b.targetDate.slice(4)];
  sc.b.targetDate = `${y + s.shiftYears}${rest}`;
  sc.b.targetPrice = s.price;
  sc.b.rate = s.rate;
  sc.x.priceGrowthPct = s.priceGrowth;
  sc.x.bidPct = s.bid;
  sc.x.bufferMonths = s.buffer;
  sc.x.renovation = s.renovation;

  // salaries: scaled, and grown by the extra growth from the first year on
  sc.b.incomeGrossYear = grow(sc.b.incomeGrossYear, factor, 0, 0);
  const rescale = (m: Record<string, number>) => {
    for (const k of Object.keys(m)) m[k] = Math.round(grow(m[k], factor, s.extraGrowth, Number(k) - startYear));
  };
  rescale(sc.x.salaryYou);
  sc.x.salaryGrowthPct += s.extraGrowth;

  // the variants move with the basis
  for (const key of ["stress", "gunstig"] as const) {
    const ov = sc.variants[key];
    rescale(ov.salaryYou);
    if ("salaryGrowthPct" in ov.fields) ov.fields.salaryGrowthPct = Number(ov.fields.salaryGrowthPct) + s.extraGrowth;
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
  if (s.salaryPct) parts.push(`salaris ${s.salaryPct > 0 ? "+" : ""}${s.salaryPct}%`);
  if (s.extraGrowth) parts.push(`salarisgroei ${s.extraGrowth > 0 ? "+" : ""}${s.extraGrowth} pt`);
  if (s.partnerGross !== was.partnerGross) parts.push(s.partnerGross > 0 ? `samen, partner € ${eur(s.partnerGross)}` : "alleen");
  if (s.rate !== was.rate) parts.push(`rente ${s.rate}%`);
  if (s.buffer !== was.buffer) parts.push(`buffer ${s.buffer} mnd`);
  if (s.renovation !== was.renovation) parts.push(`verbouwing € ${eur(s.renovation)}`);
  return parts.length ? `Uit ${base.name}: ${parts.join(", ")}.` : `Kopie van ${base.name}.`;
}
