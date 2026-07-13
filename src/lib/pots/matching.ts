import type { SupabaseClient } from "@supabase/supabase-js";

// Sub-accounts like Rabobank's internal "potjes" don't have their own IBAN,
// so the only signal that a transaction belongs to one is its name showing
// up in the counterparty/description text.
export async function matchPotTransfers(supabase: SupabaseClient, transactionIds: string[]) {
  if (transactionIds.length === 0) return;

  const { data: pots } = await supabase.from("pots").select("id, match_text").not("match_text", "is", null);
  const activePots = (pots ?? []).filter(
    (p): p is { id: string; match_text: string } => !!p.match_text?.trim()
  );
  if (activePots.length === 0) return;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, amount, booking_date, counterparty_name, raw_description, is_transfer")
    .in("id", transactionIds);

  for (const tx of transactions ?? []) {
    if (tx.is_transfer) continue;
    const haystack = `${tx.counterparty_name ?? ""} ${tx.raw_description ?? ""}`.toLowerCase();
    const pot = activePots.find((p) => haystack.includes(p.match_text.toLowerCase()));
    if (!pot) continue;

    // Money leaving the checking account (negative) is money going into the
    // pot (deposit, positive); money coming back (positive) is a withdrawal.
    const { error } = await supabase.from("pot_entries").insert({
      pot_id: pot.id,
      amount: -tx.amount,
      entry_date: tx.booking_date,
      transaction_id: tx.id,
    });
    // Unique index on transaction_id — ignore if this transaction was
    // already matched by an earlier sync/rematch run.
    if (error && error.code !== "23505") throw error;

    await supabase.from("transactions").update({ is_transfer: true, reviewed: true }).eq("id", tx.id);
  }
}

// Re-scans full transaction history for a single pot after its match_text
// is set/changed, since ongoing sync only checks newly-inserted rows.
export async function rematchPotHistory(supabase: SupabaseClient, potId: string) {
  const { data: pot } = await supabase.from("pots").select("match_text").eq("id", potId).single();
  const matchText = pot?.match_text?.trim();
  if (!matchText) return 0;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, amount, booking_date, counterparty_name, raw_description")
    .eq("is_transfer", false)
    .or(
      `counterparty_name.ilike.%${matchText}%,raw_description.ilike.%${matchText}%`
    );

  let matched = 0;
  for (const tx of transactions ?? []) {
    const { error } = await supabase.from("pot_entries").insert({
      pot_id: potId,
      amount: -tx.amount,
      entry_date: tx.booking_date,
      transaction_id: tx.id,
    });
    if (error) {
      if (error.code === "23505") continue;
      throw error;
    }
    await supabase.from("transactions").update({ is_transfer: true, reviewed: true }).eq("id", tx.id);
    matched++;
  }
  return matched;
}
