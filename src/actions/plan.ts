"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDebts } from "@/actions/debts";
import { getHousePlanData } from "@/actions/house";
import { getDashboardSummary, getMonthlySpendByCategory } from "@/actions/dashboard";
import { getPots } from "@/actions/pots";
import { computePotBalance } from "@/lib/pots/balance";
import { nextPeriodMonthly } from "@/lib/pots/insights";
import { SAVINGS_CATEGORY } from "@/lib/pots/savings-category";
import { getMonthStartDay } from "@/lib/settings";
import { periodRange } from "@/lib/month";
import { summarize } from "@/lib/debts/calc";
import { todayAmsterdam } from "@/lib/wbw/record";
import { defaultExtra, mergeExtra, type AppData, type PlanDoc, type StudyLoanData, type VariantOverride } from "@/lib/plan/types";
import { seedDoc } from "@/lib/plan/scenarios";

const normVariant = (v: Partial<VariantOverride> | undefined): VariantOverride => ({
  fields: v?.fields ?? {},
  salaryYou: v?.salaryYou ?? {},
  salaryPartner: v?.salaryPartner ?? {},
});

const MONTH_NAMES = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

export async function getPlanData() {
  const supabase = await createClient();
  const today = todayAmsterdam();
  const startDay = await getMonthStartDay();

  const [house, pots, debts, planRow] = await Promise.all([
    getHousePlanData(),
    getPots(),
    getDebts(),
    supabase.from("house_plans").select("extra, doc").maybeSingle(),
  ]);

  // pots: savings and investing apart
  let savingsNow = 0;
  let investNow = 0;
  let monthlySave = 0;
  let monthlyInvest = 0;
  const saving: string[] = [];
  const investing: string[] = [];
  for (const p of pots) {
    const balance = computePotBalance(p);
    const monthly = nextPeriodMonthly(p, balance, startDay) ?? 0;
    if (p.kind === "investment") {
      investNow += balance;
      monthlyInvest += monthly;
      investing.push(p.name);
    } else {
      savingsNow += balance;
      monthlySave += monthly;
      saving.push(p.name);
    }
  }

  // the last three full periods of what really came in and went out
  const months = await Promise.all(
    [1, 2, 3].map(async (ago) => {
      const [summary, spend] = await Promise.all([getDashboardSummary(ago), getMonthlySpendByCategory(ago)]);
      const saved = spend.find((c) => c.name === SAVINGS_CATEGORY)?.total ?? 0;
      const label = periodRange(ago, startDay).labelDate;
      return {
        label: MONTH_NAMES[label.getMonth()],
        income: summary.monthIncome,
        spent: Math.max(0, summary.monthExpense - saved),
        saved,
      };
    })
  );
  const avg = (f: (m: (typeof months)[number]) => number) => months.reduce((s, m) => s + f(m), 0) / Math.max(1, months.length);

  // the study loan
  const duo = debts.find((d) => d.kind === "duo");
  let study: StudyLoanData = {
    hasLoan: false,
    balanceNow: 0,
    originalDebt: 0,
    blendedRate: 0,
    repayStart: null,
    termYears: 35,
    monthlyPayment: null,
    estimatedMonthly: null,
    projectedAtStart: null,
    note: "Geen studielening ingevuld onder Instellingen > Schulden en hypotheek.",
  };
  if (duo) {
    const s = summarize(duo, duo.debt_parts);
    const nonGift = duo.debt_parts.filter((p) => !p.is_gift);
    study = {
      hasLoan: true,
      balanceNow: s.realNow,
      originalDebt: nonGift.reduce((sum, p) => sum + p.balance, 0),
      blendedRate: s.blendedRate ?? (nonGift.length ? nonGift.reduce((sum, p) => sum + p.rate, 0) / nonGift.length : 0),
      repayStart: duo.repay_start,
      termYears: duo.term_years,
      monthlyPayment: duo.monthly_payment,
      estimatedMonthly: s.estimatedMonthly,
      projectedAtStart: s.projectedAtStart,
      note: `Uit je schulden: ${duo.name}, ${duo.debt_parts.length} ${duo.debt_parts.length === 1 ? "deel" : "delen"}.`,
    };
  }

  const app: AppData = {
    savingsNow: Math.round(savingsNow),
    investNow: Math.round(investNow),
    monthlySave: Math.round(monthlySave),
    monthlyInvest: Math.round(monthlyInvest),
    potNames: { saving, investing },
    months,
    avgIncome: Math.round(avg((m) => m.income)),
    avgSpentExSaving: Math.round(avg((m) => m.spent)),
    avgSaved: Math.round(avg((m) => m.saved)),
    study,
    today,
  };

  // The plan document: stored scenarios win. On the first visit it is built from the
  // starting scenarios A and B, and what was filled in before is kept as a scenario.
  const row = planRow.data as { extra?: unknown; doc?: unknown } | null;
  const storedDoc = row?.doc as PlanDoc | null | undefined;
  let doc: PlanDoc;
  if (storedDoc && Array.isArray(storedDoc.scenarios) && storedDoc.scenarios.length > 0) {
    doc = {
      ...storedDoc,
      scenarios: storedDoc.scenarios.map((sc) => ({
        ...sc,
        x: mergeExtra(sc.x, today),
        variants: {
          stress: normVariant(sc.variants?.stress),
          gunstig: normVariant(sc.variants?.gunstig),
        },
      })),
      meta: storedDoc.meta ?? {},
      history: storedDoc.history ?? [],
      snapshots: storedDoc.snapshots ?? [],
    };
  } else {
    const hadPlan = house.saved;
    const oldX = row?.extra ? mergeExtra(row.extra, today) : defaultExtra(today);
    doc = seedDoc(app, hadPlan ? { b: house.inputs, x: oldX } : null);
  }
  return { doc, app, hasDoc: Boolean(storedDoc) };
}

export async function savePlan(doc: PlanDoc) {
  const active = doc.scenarios.find((s) => s.id === doc.activeId) ?? doc.scenarios[0];
  if (!active) return { error: "Er is geen scenario om op te slaan." };
  const b = active.b;
  const x = active.x;
  if (!b.targetDate) return { error: "Kies een streefdatum." };
  if (!(b.targetPrice > 0)) return { error: "Vul een prijs in." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  const { error } = await supabase.from("house_plans").upsert(
    {
      user_id: user.id,
      target_date: b.targetDate,
      target_price: b.targetPrice,
      income_gross_year: b.incomeGrossYear || null,
      partner_income_gross_year: b.partnerIncomeGrossYear || null,
      rate: b.rate,
      term_years: Math.round(b.termYears) || 30,
      cost_pct: b.costPct,
      housing_pct: b.housingPct,
      student_monthly: b.studentMonthly,
      start_savings: b.startSavings,
      start_invest: b.startInvest,
      monthly_save: b.monthlySave,
      monthly_invest: b.monthlyInvest,
      savings_rate: b.savingsRate,
      return_low: b.returnLow,
      return_mid: b.returnMid,
      return_high: b.returnHigh,
      extra: x,
      doc,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) return { error: "Opslaan mislukt. Is de database bijgewerkt?" };
  revalidatePath("/plan", "layout");
  return {};
}
