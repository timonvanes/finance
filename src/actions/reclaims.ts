"use server";

import { createClient } from "@/lib/supabase/server";
import { autoMatchNewReclaim, learnPersonAlias } from "@/lib/reclaims/matching";

const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I to avoid confusion

function generateReferenceCode() {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `TR-${code}`;
}

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

// Incoming transactions not yet used to settle another reclaim — candidates
// for "link this payment to that reclaim".
export async function getUnlinkedIncomingTransactions() {
  const supabase = await createClient();

  const { data: alreadyLinked } = await supabase
    .from("reclaims")
    .select("settled_transaction_id")
    .not("settled_transaction_id", "is", null);
  const usedIds = (alreadyLinked ?? []).map((r) => r.settled_transaction_id);

  let query = supabase
    .from("transactions")
    .select("id, booking_date, amount, counterparty_name")
    .gt("amount", 0)
    .order("booking_date", { ascending: false })
    .limit(100);

  if (usedIds.length > 0) {
    query = query.not("id", "in", `(${usedIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getReclaims() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reclaims")
    .select(
      `id, person_name, amount_type, amount_value, computed_amount, tikkie_link, status, created_at, settled_transaction_id, reference_code,
      transactions!reclaims_transaction_id_fkey(booking_date, counterparty_name, amount),
      settled_transaction:transactions!reclaims_settled_transaction_id_fkey(booking_date, counterparty_name, amount)`
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

  // Reference codes are unique; a random collision is astronomically
  // unlikely at personal scale, but retry a couple of times just in case.
  let reclaim: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !reclaim; attempt++) {
    const { data, error } = await supabase
      .from("reclaims")
      .insert({
        transaction_id: transactionId,
        person_name: personName,
        amount_type: amountType,
        amount_value: amountValue,
        computed_amount: computedAmount,
        tikkie_link: tikkieLink,
        reference_code: generateReferenceCode(),
      })
      .select("id")
      .single();
    if (error && error.code !== "23505") throw error; // 23505 = unique_violation
    if (data) reclaim = data;
  }
  if (!reclaim) throw new Error("Kon geen unieke referentiecode genereren");

  // The payback may already have arrived before this reclaim was logged —
  // check immediately instead of waiting for the next sync.
  await autoMatchNewReclaim(supabase, reclaim.id);
}

export async function markReclaimPaid(reclaimId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reclaims")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", reclaimId);
  if (error) throw error;
}

// Link an incoming transaction (the actual payback) to a reclaim, and mark
// it settled — this is how we know money has genuinely arrived rather than
// just trusting a manual "paid" click.
export async function linkReclaimToTransaction(
  reclaimId: string,
  transactionId: string
) {
  const supabase = await createClient();

  const [{ data: tx, error: txError }, { data: reclaim, error: reclaimError }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("booking_date, counterparty_name")
        .eq("id", transactionId)
        .single(),
      supabase.from("reclaims").select("person_name").eq("id", reclaimId).single(),
    ]);
  if (txError) throw txError;
  if (reclaimError) throw reclaimError;

  const { error } = await supabase
    .from("reclaims")
    .update({
      settled_transaction_id: transactionId,
      status: "paid",
      paid_at: tx.booking_date,
    })
    .eq("id", reclaimId);
  if (error) throw error;

  // A manual link is a confirmed ground truth — learn it for next time.
  await learnPersonAlias(supabase, reclaim.person_name, tx.counterparty_name);
}

export async function unlinkReclaim(reclaimId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reclaims")
    .update({ settled_transaction_id: null, status: "requested", paid_at: null })
    .eq("id", reclaimId);
  if (error) throw error;
}
