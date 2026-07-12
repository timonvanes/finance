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
    .select("id, booking_date, amount, counterparty_name, raw_description")
    .lt("amount", 0)
    .eq("is_transfer", false)
    .order("booking_date", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

// Transactions flagged from the transactions list as "still needs to be
// split into reclaim(s)" — the queue shown at the top of this page.
export async function getQueuedTransactions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, booking_date, amount, counterparty_name, raw_description")
    .eq("flagged_for_reclaim", true)
    .order("booking_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function flagTransactionForReclaim(formData: FormData) {
  const transactionId = formData.get("transactionId") as string;
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ flagged_for_reclaim: true, reviewed: true })
    .eq("id", transactionId);
  if (error) throw error;
}

export async function unflagTransactionForReclaim(transactionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ flagged_for_reclaim: false, reviewed: false })
    .eq("id", transactionId);
  if (error) throw error;
}

// The other half of the triage: this expense is the user's own, nothing to
// reclaim — just mark it reviewed so it drops off the to-do list.
export async function markOwnExpense(formData: FormData) {
  const transactionId = formData.get("transactionId") as string;
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ reviewed: true })
    .eq("id", transactionId);
  if (error) throw error;
}

export async function unreviewTransaction(transactionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ reviewed: false })
    .eq("id", transactionId);
  if (error) throw error;
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
    .eq("is_transfer", false)
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
      `id, person_id, amount_type, amount_value, computed_amount, tikkie_link, status, created_at, settled_transaction_id, reference_code, settlement_method,
      people(name),
      transactions!reclaims_transaction_id_fkey(booking_date, counterparty_name, amount),
      settled_transaction:transactions!reclaims_settled_transaction_id_fkey(booking_date, counterparty_name, amount)`
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Create one reclaim per selected person for the same transaction — e.g.
// split a €50 dinner among 10 people at €5 each, all in one go.
export async function createSplitReclaim(formData: FormData) {
  const transactionId = formData.get("transactionId") as string;
  const settlementMethod =
    (formData.get("settlementMethod") as string) === "external_app"
      ? "external_app"
      : "bank";
  const tikkieLink = (formData.get("tikkieLink") as string) || null;
  const personIds = formData.getAll("personId") as string[];
  if (personIds.length === 0) return;

  // One shared betaalverzoek to the whole group only needs one code — the
  // matcher disambiguates by amount/name if several reclaims share it.
  const useSharedCode = formData.get("sharedCode") === "on";
  const sharedCode = useSharedCode ? generateReferenceCode() : null;

  const supabase = await createClient();
  const createdIds: string[] = [];

  const { data: selfPerson } = await supabase
    .from("people")
    .select("id")
    .eq("is_self", true)
    .maybeSingle();

  for (const personId of personIds) {
    // Your own share of the bill isn't a reclaim — it's just accounted for
    // in the split math so everyone else's amount comes out right.
    if (selfPerson && personId === selfPerson.id) continue;

    const amountValue = Number(formData.get(`amount_${personId}`));
    if (!amountValue || amountValue <= 0) continue;

    const { data, error } = await supabase
      .from("reclaims")
      .insert({
        transaction_id: transactionId,
        person_id: personId,
        amount_type: "fixed",
        amount_value: amountValue,
        computed_amount: amountValue,
        tikkie_link: tikkieLink,
        settlement_method: settlementMethod,
        reference_code:
          settlementMethod === "bank" ? sharedCode ?? generateReferenceCode() : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    createdIds.push(data.id);
  }

  // No longer needs to sit in the "still to split" queue.
  await supabase
    .from("transactions")
    .update({ flagged_for_reclaim: false })
    .eq("id", transactionId);

  // The payback may already have arrived before this reclaim was logged.
  if (settlementMethod === "bank") {
    for (const id of createdIds) {
      await autoMatchNewReclaim(supabase, id);
    }
  }
}

export async function markReclaimPaid(reclaimId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reclaims")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", reclaimId);
  if (error) throw error;
}

export async function deleteReclaim(reclaimId: string) {
  const supabase = await createClient();

  const { data: reclaim, error: fetchError } = await supabase
    .from("reclaims")
    .select("transaction_id")
    .eq("id", reclaimId)
    .single();
  if (fetchError) throw fetchError;

  const { error } = await supabase.from("reclaims").delete().eq("id", reclaimId);
  if (error) throw error;

  // If no other reclaim still covers this transaction, send it back to the
  // transactions to-do list instead of leaving it in reviewed limbo.
  const { data: remaining } = await supabase
    .from("reclaims")
    .select("id")
    .eq("transaction_id", reclaim.transaction_id)
    .limit(1);

  if (!remaining || remaining.length === 0) {
    await supabase
      .from("transactions")
      .update({ flagged_for_reclaim: false, reviewed: false })
      .eq("id", reclaim.transaction_id);
  }
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
      supabase.from("reclaims").select("person_id").eq("id", reclaimId).single(),
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
  await learnPersonAlias(supabase, reclaim.person_id, tx.counterparty_name);
}

export async function unlinkReclaim(reclaimId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reclaims")
    .update({ settled_transaction_id: null, status: "requested", paid_at: null })
    .eq("id", reclaimId);
  if (error) throw error;
}
