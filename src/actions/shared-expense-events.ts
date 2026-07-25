"use server";

import { createClient } from "@/lib/supabase/server";

export async function getSharedExpenseEvents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shared_expense_events")
    .select(
      `id, name, settlement_amount, settlement_direction, settlement_transaction_id, created_at,
      transactions!transactions_shared_expense_event_id_fkey(id, booking_date, amount, counterparty_name),
      settled_transaction:transactions!shared_expense_events_settlement_transaction_id_fkey(booking_date, counterparty_name, amount)`
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createSharedExpenseEvent(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  const supabase = await createClient();
  const { error } = await supabase.from("shared_expense_events").insert({ name });
  if (error) throw error;
}

export async function deleteSharedExpenseEvent(eventId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("shared_expense_events").delete().eq("id", eventId);
  if (error) throw error;
}

// Recent expense transactions not yet tagged to any event, to pick from.
export async function getTaggableTransactions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visible_transactions")
    .select("id, booking_date, amount, counterparty_name")
    .lt("amount", 0)
    .eq("is_transfer", false)
    .is("shared_expense_event_id", null)
    .order("booking_date", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function tagTransactionToEvent(eventId: string, transactionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ shared_expense_event_id: eventId })
    .eq("id", transactionId);
  if (error) throw error;
}

export async function untagTransaction(transactionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ shared_expense_event_id: null })
    .eq("id", transactionId);
  if (error) throw error;
}

export async function setSettlement(
  eventId: string,
  amount: number | null,
  direction: "owed_to_me" | "owed_by_me" | null
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("shared_expense_events")
    .update({
      settlement_amount: amount && amount > 0 ? amount : null,
      settlement_direction: amount && amount > 0 ? direction : null,
    })
    .eq("id", eventId);
  if (error) throw error;
}

// Candidate transactions to link as the actual settlement payment — either
// sign, since it depends on the event's settlement direction (filtered
// client-side once picked).
export async function getSettlementCandidates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visible_transactions")
    .select("id, booking_date, amount, counterparty_name")
    .eq("is_transfer", false)
    .is("shared_expense_event_id", null)
    .order("booking_date", { ascending: false })
    .limit(150);
  if (error) throw error;
  return data;
}

// The settlement payment is a reimbursement, not real income/expense — mark
// it as a transfer so it drops out of category totals, budgets, and the
// income/expense summary, same treatment as a transfer between own accounts.
export async function linkSettlementTransaction(eventId: string, transactionId: string) {
  const supabase = await createClient();
  const { error: eventError } = await supabase
    .from("shared_expense_events")
    .update({ settlement_transaction_id: transactionId })
    .eq("id", eventId);
  if (eventError) throw eventError;

  const { error: txError } = await supabase
    .from("transactions")
    .update({ is_transfer: true, reviewed: true })
    .eq("id", transactionId);
  if (txError) throw txError;
}

export async function unlinkSettlementTransaction(eventId: string) {
  const supabase = await createClient();

  const { data: event, error: fetchError } = await supabase
    .from("shared_expense_events")
    .select("settlement_transaction_id")
    .eq("id", eventId)
    .single();
  if (fetchError) throw fetchError;

  const { error: eventError } = await supabase
    .from("shared_expense_events")
    .update({ settlement_transaction_id: null })
    .eq("id", eventId);
  if (eventError) throw eventError;

  if (event.settlement_transaction_id) {
    const { error: txError } = await supabase
      .from("transactions")
      .update({ is_transfer: false, reviewed: false })
      .eq("id", event.settlement_transaction_id);
    if (txError) throw txError;
  }
}
