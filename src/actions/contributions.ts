"use server";

import { createClient } from "@/lib/supabase/server";

// Batch-fetches contributions for several expense transactions at once
// (used by the transactions list), joined with the source transaction's
// display info.
export async function getContributionsForTransactions(expenseTransactionIds: string[]) {
  if (expenseTransactionIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_contributions")
    .select(
      `id, expense_transaction_id, amount, label,
      source_transaction:transactions!expense_contributions_source_transaction_id_fkey(booking_date, counterparty_name)`
    )
    .in("expense_transaction_id", expenseTransactionIds);
  if (error) throw error;
  return data;
}

// Recent incoming transactions to pick as a contribution's source — not
// filtered to "unlinked" since one incoming transfer could in principle be
// split across multiple expenses.
export async function getIncomeSourceOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visible_transactions")
    .select("id, booking_date, amount, counterparty_name")
    .gt("amount", 0)
    .eq("is_transfer", false)
    .order("booking_date", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function addContribution(
  expenseTransactionId: string,
  sourceTransactionId: string | null,
  amount: number,
  label: string | null
) {
  if (!amount || amount <= 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("expense_contributions").insert({
    expense_transaction_id: expenseTransactionId,
    source_transaction_id: sourceTransactionId,
    amount,
    label: label?.trim() || null,
  });
  if (error) throw error;
}

export async function deleteContribution(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("expense_contributions").delete().eq("id", id);
  if (error) throw error;
}
