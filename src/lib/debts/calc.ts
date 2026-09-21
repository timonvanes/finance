export interface DebtInput {
  repay_start: string | null;
  term_years: number;
  monthly_payment: number | null;
  gift_adjustment: number;
}

export interface PartInput {
  id: string;
  name: string;
  balance: number;
  balance_date: string;
  rate: number;
  rate_fixed_until: string | null;
  is_gift: boolean;
  gift_inside?: boolean;
  repay_type?: "annuity" | "linear" | "interest_only";
  end_date?: string | null;
}

const DAY = 86_400_000;
const at = (iso: string) => Date.parse(`${iso}T00:00:00`);

// Interest compounds yearly on the balance (which already includes interest).
export function grow(balance: number, ratePct: number, fromMs: number, toMs: number) {
  if (toMs <= fromMs) return balance;
  return balance * Math.pow(1 + ratePct / 100, (toMs - fromMs) / DAY / 365);
}

export function pmt(principal: number, monthlyRate: number, months: number) {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export function summarize(debt: DebtInput, parts: PartInput[], now = new Date()) {
  const nowMs = now.getTime();
  const current = parts.map((p) => ({ ...p, current: grow(p.balance, p.rate, at(p.balance_date), nowMs) }));

  const nonGift = current.filter((p) => !p.is_gift);
  const nonGiftSum = nonGift.reduce((s, p) => s + p.current, 0);
  // The gift adjustment sits inside the parts marked "gift_inside"; if none is
  // marked it is spread over all parts.
  const marked = nonGift.filter((p) => p.gift_inside);
  const carriers = marked.length > 0 ? marked : nonGift;
  const carrierSum = carriers.reduce((s, p) => s + p.current, 0);
  // The gift amount is stated as of the balance date; its share of those parts
  // stays the same, so it also accrues interest along with them.
  const carrierAtDate = carriers.reduce((s, p) => s + p.balance, 0);
  const giftShare = carrierAtDate > 0 ? Math.min(1, Math.max(0, debt.gift_adjustment) / carrierAtDate) : 0;
  const giftAdj = carrierSum * giftShare;
  const shareOf = (p: { gift_inside?: boolean }) => (marked.length === 0 || p.gift_inside ? giftShare : 0);

  const totalAtLender = current.reduce((s, p) => s + p.current, 0);
  const giftTotal = current.filter((p) => p.is_gift).reduce((s, p) => s + p.current, 0) + giftAdj;
  const realNow = nonGiftSum - giftAdj;
  const interestPerYear = nonGift.reduce((s, p) => s + ((p.current * (1 - shareOf(p))) * p.rate) / 100, 0);

  let projectedAtStart: number | null = null;
  let blendedRate: number | null = null;
  let estimatedMonthly: number | null = null;
  let aanloopEnd: Date | null = null;
  let repayEnd: Date | null = null;
  if (debt.repay_start) {
    const startMs = at(debt.repay_start);
    const projected = nonGift.map((p) => ({
      value: grow(p.balance, p.rate, at(p.balance_date), Math.max(startMs, nowMs)) * (1 - shareOf(p)),
      rate: p.rate,
    }));
    projectedAtStart = projected.reduce((s, p) => s + p.value, 0);
    blendedRate = projectedAtStart > 0 ? projected.reduce((s, p) => s + p.value * p.rate, 0) / projectedAtStart : 0;
    estimatedMonthly = pmt(projectedAtStart, blendedRate / 100 / 12, debt.term_years * 12);
    aanloopEnd = new Date(startMs - DAY);
    repayEnd = new Date(new Date(startMs).getFullYear() + debt.term_years, new Date(startMs).getMonth(), new Date(startMs).getDate());
  }

  const repaying = debt.repay_start ? at(debt.repay_start) <= nowMs : false;
  const monthly = debt.monthly_payment ?? estimatedMonthly;

  return {
    parts: current,
    totalAtLender,
    giftTotal,
    realNow,
    interestPerYear,
    projectedAtStart,
    blendedRate,
    estimatedMonthly,
    aanloopEnd,
    repayEnd,
    repaying,
    monthlyCost: repaying && monthly ? monthly : 0,
  };
}

export interface MortgageInput {
  property_value: number | null;
  monthly_payment: number | null;
}

const monthsBetween = (fromMs: number, toMs: number) => {
  const a = new Date(fromMs);
  const b = new Date(toMs);
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
};

// One month of a mortgage part: interest plus repayment, by repayment type.
export function mortgagePartMonth(p: PartInput, balance: number, now = new Date()) {
  const rate = p.rate / 100 / 12;
  const interest = balance * rate;
  const months = p.end_date ? monthsBetween(now.getTime(), at(p.end_date)) : 0;
  const type = p.repay_type ?? "annuity";
  if (type === "interest_only" || months <= 0) return { interest, principal: 0 };
  if (type === "linear") return { interest, principal: balance / months };
  return { interest, principal: Math.max(0, pmt(balance, rate, months) - interest) };
}

// Balance of a part on a later date, month by month.
export function mortgageBalanceAt(p: PartInput, balance: number, targetMs: number, now = new Date()) {
  let b = balance;
  const steps = monthsBetween(now.getTime(), targetMs);
  for (let i = 0; i < steps; i++) {
    const at2 = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
    b = Math.max(0, b - mortgagePartMonth(p, b, at2).principal);
  }
  return b;
}

export function summarizeMortgage(debt: MortgageInput, parts: PartInput[], now = new Date()) {
  const rows = parts.map((p) => {
    const balance = p.balance; // mortgage balances are given as the current outstanding amount
    const month = mortgagePartMonth(p, balance, now);
    const fixedMs = p.rate_fixed_until ? at(p.rate_fixed_until) : null;
    return {
      ...p,
      current: balance,
      interestMonth: month.interest,
      principalMonth: month.principal,
      monthly: month.interest + month.principal,
      balanceAtFixedEnd: fixedMs ? mortgageBalanceAt(p, balance, fixedMs, now) : null,
    };
  });
  const total = rows.reduce((s, r) => s + r.current, 0);
  const interestMonth = rows.reduce((s, r) => s + r.interestMonth, 0);
  const principalMonth = rows.reduce((s, r) => s + r.principalMonth, 0);
  const computedMonthly = interestMonth + principalMonth;
  return {
    parts: rows,
    total,
    interestMonth,
    principalMonth,
    computedMonthly,
    monthlyCost: debt.monthly_payment ?? computedMonthly,
    equity: debt.property_value != null ? debt.property_value - total : null,
    ltv: debt.property_value ? (total / debt.property_value) * 100 : null,
  };
}
