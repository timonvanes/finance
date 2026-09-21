"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const OWN_SHARE_LABEL = "Eigen deel";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export async function getPassthroughsForTransactions(sourceIds: string[]) {
  if (sourceIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("income_passthroughs")
    .select(
      `id, source_transaction_id, amount, payout_transaction_id, people(name),
      payout:transactions!income_passthroughs_payout_transaction_id_fkey(booking_date, counterparty_name, amount)`
    )
    .in("source_transaction_id", sourceIds);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    sourceTransactionId: r.source_transaction_id as string,
    amount: Number(r.amount),
    personName: one(r.people)?.name ?? "Onbekend",
    payoutId: r.payout_transaction_id as string | null,
    payout: one(r.payout),
  }));
}

// Recent outgoing payments: candidates for the rent (to net your own share
// against) and for the payouts to your housemates.
export async function getOutgoingOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visible_transactions")
    .select("id, booking_date, amount, counterparty_name")
    .lt("amount", 0)
    .order("booking_date", { ascending: false })
    .limit(80);
  if (error) throw error;
  return data ?? [];
}

// Splits an incoming payment: each housemate's part is not your income. With a
// rent payment chosen, your own remaining part is netted against that rent
// (so the rent shows as rent minus your share of the toeslag).
export async function splitIncome(
  sourceTransactionId: string,
  splits: { personId: string; amount: number }[],
  rentTransactionId: string | null
) {
  const clean = splits.filter((s) => s.personId && s.amount > 0);
  if (clean.length === 0) throw new Error("Kies minstens één huisgenoot met een bedrag.");

  const supabase = await createClient();
  const { data: source, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("id", sourceTransactionId)
    .single();
  if (error) throw error;
  const total = Number(source.amount);
  const others = clean.reduce((s, x) => s + x.amount, 0);
  if (total <= 0) throw new Error("Dit is geen bijschrijving.");
  if (others > total + 0.005) throw new Error("De delen zijn samen meer dan het bedrag dat binnenkwam.");

  await clearSplitInternal(supabase, sourceTransactionId);

  const { error: insertError } = await supabase.from("income_passthroughs").insert(
    clean.map((s) => ({ source_transaction_id: sourceTransactionId, person_id: s.personId, amount: s.amount }))
  );
  if (insertError) throw insertError;

  const own = Math.round((total - others) * 100) / 100;
  if (rentTransactionId && own > 0.005) {
    const { error: contributionError } = await supabase.from("expense_contributions").insert({
      expense_transaction_id: rentTransactionId,
      source_transaction_id: sourceTransactionId,
      amount: own,
      label: OWN_SHARE_LABEL,
    });
    if (contributionError) throw contributionError;
  }
  revalidatePath("/", "layout");
}

async function clearSplitInternal(supabase: Awaited<ReturnType<typeof createClient>>, sourceTransactionId: string) {
  const { data: rows } = await supabase
    .from("income_passthroughs")
    .select("payout_contribution_id")
    .eq("source_transaction_id", sourceTransactionId);
  const contributionIds = (rows ?? []).map((r) => r.payout_contribution_id).filter(Boolean) as string[];
  await supabase.from("income_passthroughs").delete().eq("source_transaction_id", sourceTransactionId);
  if (contributionIds.length > 0) {
    await supabase.from("expense_contributions").delete().in("id", contributionIds);
  }
  await supabase
    .from("expense_contributions")
    .delete()
    .eq("source_transaction_id", sourceTransactionId)
    .eq("label", OWN_SHARE_LABEL);
}

export async function clearSplit(sourceTransactionId: string) {
  const supabase = await createClient();
  await clearSplitInternal(supabase, sourceTransactionId);
  revalidatePath("/", "layout");
}

// The payment you made to pass the money on: only that amount is taken out of
// the payment's spending, so a payment that also holds your own rent still
// counts for the rest.
export async function linkPassthroughPayout(passthroughId: string, transactionId: string) {
  const supabase = await createClient();
  const [{ data: row, error }, { data: tx, error: txError }] = await Promise.all([
    supabase.from("income_passthroughs").select("amount").eq("id", passthroughId).single(),
    supabase.from("transactions").select("amount").eq("id", transactionId).single(),
  ]);
  if (error) throw error;
  if (txError) throw txError;
  const amount = Math.min(Number(row.amount), Math.abs(Number(tx.amount)));

  const { data: contribution, error: contributionError } = await supabase
    .from("expense_contributions")
    .insert({ expense_transaction_id: transactionId, source_transaction_id: null, amount, label: "Doorgegeven toeslag" })
    .select("id")
    .single();
  if (contributionError) throw contributionError;

  const { error: updateError } = await supabase
    .from("income_passthroughs")
    .update({ payout_transaction_id: transactionId, payout_contribution_id: contribution.id })
    .eq("id", passthroughId);
  if (updateError) throw updateError;
  revalidatePath("/", "layout");
}

export async function unlinkPassthroughPayout(passthroughId: string) {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("income_passthroughs")
    .select("payout_contribution_id")
    .eq("id", passthroughId)
    .single();
  await supabase
    .from("income_passthroughs")
    .update({ payout_transaction_id: null, payout_contribution_id: null })
    .eq("id", passthroughId);
  if (row?.payout_contribution_id) {
    await supabase.from("expense_contributions").delete().eq("id", row.payout_contribution_id);
  }
  revalidatePath("/", "layout");
}
