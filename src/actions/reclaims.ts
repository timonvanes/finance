"use server";

import { createClient } from "@/lib/supabase/server";

export async function getRecentExpenseTransactions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, booking_date, amount, counterparty_name")
    .lt("amount", 0)
    .order("booking_date", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function getReclaims() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reclaims")
    .select(
      "id, person_name, amount_type, amount_value, computed_amount, tikkie_link, status, created_at, transactions(booking_date, counterparty_name, amount)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createReclaim(formData: FormData) {
  const transactionId = formData.get("transactionId") as string;
  const personName = formData.get("personName") as string;
  const amountType = formData.get("amountType") as "fraction" | "fixed";
  const amountValue = Number(formData.get("amountValue"));
  const tikkieLink = (formData.get("tikkieLink") as string) || null;

  const supabase = await createClient();

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select("amount")
    .eq("id", transactionId)
    .single();
  if (txError) throw txError;

  const computedAmount =
    amountType === "fraction"
      ? Math.abs(tx.amount) * amountValue
      : amountValue;

  const { error } = await supabase.from("reclaims").insert({
    transaction_id: transactionId,
    person_name: personName,
    amount_type: amountType,
    amount_value: amountValue,
    computed_amount: computedAmount,
    tikkie_link: tikkieLink,
  });
  if (error) throw error;
}

export async function markReclaimPaid(reclaimId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reclaims")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", reclaimId);
  if (error) throw error;
}
