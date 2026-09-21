"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { summarize, summarizeMortgage, type PartInput } from "@/lib/debts/calc";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  return { supabase, userId: user.id };
}

export async function getDebts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debts")
    .select(
      "id, kind, name, regime, repay_start, term_years, monthly_payment, gift_adjustment, property_value, property_value_date, debt_parts(id, name, balance, balance_date, rate, rate_fixed_until, is_gift, gift_inside, gift_amount, sort, repay_type, end_date)"
    )
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d) => ({
    ...d,
    monthly_payment: d.monthly_payment == null ? null : Number(d.monthly_payment),
    gift_adjustment: Number(d.gift_adjustment),
    property_value: d.property_value == null ? null : Number(d.property_value),
    debt_parts: ((d.debt_parts ?? []) as (PartInput & { sort: number })[])
      .map((p) => ({ ...p, balance: Number(p.balance), rate: Number(p.rate), gift_amount: Number(p.gift_amount ?? 0) }))
      .sort((a, b) => a.sort - b.sort),
  }));
}

// Monthly costs of debts that are in their repayment phase, for the fixed costs.
export async function getDebtFixedCosts() {
  const debts = await getDebts();
  return debts
    .map((d) => {
      if (d.kind === "mortgage") {
        const s = summarizeMortgage(d, d.debt_parts);
        return { id: d.id, name: d.name, amount: s.monthlyCost, estimated: d.monthly_payment == null };
      }
      const s = summarize(d, d.debt_parts);
      return { id: d.id, name: d.name, amount: s.monthlyCost, estimated: d.monthly_payment == null };
    })
    .filter((c) => c.amount > 0);
}

export async function createDebt(kind: "duo" | "mortgage" | "other", name: string) {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("debts").insert({
    user_id: userId,
    kind,
    name: name.trim() || (kind === "mortgage" ? "Hypotheek" : "Lening"),
    term_years: kind === "mortgage" ? 30 : 35,
  });
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function deleteDebt(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function saveDebt(
  id: string,
  values: {
    name: string;
    repayStart: string | null;
    termYears: number;
    monthlyPayment: number | null;
    giftAdjustment: number;
    propertyValue?: number | null;
  }
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("debts")
    .update({
      name: values.name.trim() || "Lening",
      repay_start: values.repayStart || null,
      term_years: Math.min(50, Math.max(1, Math.round(values.termYears) || 35)),
      monthly_payment: values.monthlyPayment && values.monthlyPayment > 0 ? values.monthlyPayment : null,
      gift_adjustment: Math.max(0, values.giftAdjustment || 0),
      property_value: values.propertyValue && values.propertyValue > 0 ? values.propertyValue : null,
      property_value_date: values.propertyValue && values.propertyValue > 0 ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function savePart(
  id: string | null,
  debtId: string,
  values: {
    name: string;
    balance: number;
    balanceDate: string;
    rate: number;
    rateFixedUntil: string | null;
    isGift: boolean;
    giftInside?: boolean;
    giftAmount?: number;
    repayType?: "annuity" | "linear" | "interest_only";
    endDate?: string | null;
  }
) {
  if (!values.name.trim()) throw new Error("Geef het onderdeel een naam.");
  if (!(values.balance >= 0)) throw new Error("Vul een bedrag in.");
  const { supabase, userId } = await requireUser();
  const row = {
    name: values.name.trim(),
    balance: values.balance,
    balance_date: values.balanceDate,
    rate: values.rate,
    rate_fixed_until: values.rateFixedUntil || null,
    is_gift: values.isGift,
    gift_inside: values.giftInside ?? false,
    gift_amount: Math.max(0, values.giftAmount ?? 0),
    repay_type: values.repayType ?? "annuity",
    end_date: values.endDate || null,
  };
  const { error } = id
    ? await supabase.from("debt_parts").update(row).eq("id", id)
    : await supabase.from("debt_parts").insert({ ...row, debt_id: debtId, user_id: userId });
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function deletePart(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("debt_parts").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}
