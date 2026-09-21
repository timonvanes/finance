"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPots } from "@/actions/pots";
import { getDebts } from "@/actions/debts";
import { computePotBalance } from "@/lib/pots/balance";
import { effectiveMonthly } from "@/lib/pots/insights";
import { summarize } from "@/lib/debts/calc";
import type { HouseInputs } from "@/lib/house/calc";

const num = (v: unknown, fallback = 0) => (v == null ? fallback : Number(v));

export async function getHousePlanData() {
  const supabase = await createClient();
  const [{ data: plan }, pots, debts] = await Promise.all([
    supabase.from("house_plans").select("*").maybeSingle(),
    getPots(),
    getDebts(),
  ]);

  // Defaults from what the app already knows: pots (investment pots are
  // separate) and the study loan's expected monthly amount.
  let savingsBalance = 0;
  let investBalance = 0;
  let monthlySave = 0;
  let monthlyInvest = 0;
  for (const p of pots) {
    const balance = computePotBalance(p);
    const monthly = effectiveMonthly(p, balance) ?? 0;
    if (p.kind === "investment") {
      investBalance += balance;
      monthlyInvest += monthly;
    } else {
      savingsBalance += balance;
      monthlySave += monthly;
    }
  }
  const studentMonthly = debts
    .filter((d) => d.kind === "duo")
    .reduce((sum, d) => {
      const s = summarize(d, d.debt_parts);
      return sum + (d.monthly_payment ?? s.estimatedMonthly ?? 0);
    }, 0);

  const inTenYears = new Date();
  inTenYears.setFullYear(inTenYears.getFullYear() + 6);

  const defaults: HouseInputs = {
    targetDate: inTenYears.toISOString().slice(0, 10),
    targetPrice: 350000,
    incomeGrossYear: 0,
    partnerIncomeGrossYear: 0,
    rate: 4,
    termYears: 30,
    costPct: 4,
    housingPct: 28,
    studentMonthly: Math.round(studentMonthly),
    startSavings: Math.round(savingsBalance),
    startInvest: Math.round(investBalance),
    monthlySave: Math.round(monthlySave),
    monthlyInvest: Math.round(monthlyInvest),
    savingsRate: 2,
    returnLow: 1,
    returnMid: 5,
    returnHigh: 8,
  };

  const inputs: HouseInputs = plan
    ? {
        targetDate: plan.target_date,
        targetPrice: num(plan.target_price),
        incomeGrossYear: num(plan.income_gross_year),
        partnerIncomeGrossYear: num(plan.partner_income_gross_year),
        rate: num(plan.rate, 4),
        termYears: num(plan.term_years, 30),
        costPct: num(plan.cost_pct, 4),
        housingPct: num(plan.housing_pct, 28),
        studentMonthly: num(plan.student_monthly, defaults.studentMonthly),
        startSavings: num(plan.start_savings),
        startInvest: num(plan.start_invest),
        monthlySave: num(plan.monthly_save),
        monthlyInvest: num(plan.monthly_invest),
        savingsRate: num(plan.savings_rate, 2),
        returnLow: num(plan.return_low, 1),
        returnMid: num(plan.return_mid, 5),
        returnHigh: num(plan.return_high, 8),
      }
    : defaults;

  // Dates from the study loan for the calendar.
  const duo = debts.find((d) => d.kind === "duo");
  return { inputs, defaults, saved: Boolean(plan), repayStart: duo?.repay_start ?? null };
}

export async function saveHousePlan(i: HouseInputs) {
  if (!i.targetDate) throw new Error("Kies een streefdatum.");
  if (!(i.targetPrice > 0)) throw new Error("Vul een prijs in.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");

  const { error } = await supabase.from("house_plans").upsert(
    {
      user_id: user.id,
      target_date: i.targetDate,
      target_price: i.targetPrice,
      income_gross_year: i.incomeGrossYear || null,
      partner_income_gross_year: i.partnerIncomeGrossYear || null,
      rate: i.rate,
      term_years: Math.round(i.termYears) || 30,
      cost_pct: i.costPct,
      housing_pct: i.housingPct,
      student_monthly: i.studentMonthly,
      start_savings: i.startSavings,
      start_invest: i.startInvest,
      monthly_save: i.monthlySave,
      monthly_invest: i.monthlyInvest,
      savings_rate: i.savingsRate,
      return_low: i.returnLow,
      return_mid: i.returnMid,
      return_high: i.returnHigh,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
  revalidatePath("/huis");
}
