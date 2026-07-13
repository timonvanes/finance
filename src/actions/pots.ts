"use server";

import { createClient } from "@/lib/supabase/server";
import { rematchPotHistory } from "@/lib/pots/matching";

export async function getPots() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pots")
    .select(
      "id, name, kind, target_amount, match_text, opening_balance, opening_balance_date, pot_entries(id, amount, note, entry_date, transaction_id)"
    )
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createPot(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  const kind = (formData.get("kind") as string) || "savings";
  const targetRaw = formData.get("targetAmount") as string;
  const targetAmount = targetRaw ? Number(targetRaw) : null;
  const openingBalanceRaw = formData.get("openingBalance") as string;
  const openingBalanceDate = (formData.get("openingBalanceDate") as string) || undefined;

  const supabase = await createClient();
  const { error } = await supabase.from("pots").insert({
    name,
    kind,
    target_amount: targetAmount && targetAmount > 0 ? targetAmount : null,
    opening_balance: openingBalanceRaw ? Number(openingBalanceRaw) : 0,
    ...(openingBalanceDate ? { opening_balance_date: openingBalanceDate } : {}),
  });
  if (error) throw error;
}

// The opening balance is a starting point as of a date, not a regular
// entry — entries dated before it aren't counted, to avoid double-counting
// money that's already baked into the manually-entered starting amount.
export async function updatePotOpeningBalance(potId: string, amount: number, date: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pots")
    .update({ opening_balance: amount || 0, opening_balance_date: date })
    .eq("id", potId);
  if (error) throw error;
}

export async function deletePot(potId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pots").delete().eq("id", potId);
  if (error) throw error;
}

// Setting/changing the match text also re-scans existing history, since
// ongoing sync only checks newly-synced transactions going forward.
export async function updatePotMatchText(potId: string, matchText: string | null) {
  const supabase = await createClient();
  const trimmed = matchText?.trim() || null;
  const { error } = await supabase.from("pots").update({ match_text: trimmed }).eq("id", potId);
  if (error) throw error;

  if (trimmed) {
    return rematchPotHistory(supabase, potId);
  }
  return 0;
}

// direction "withdraw" stores the amount negative.
export async function addPotEntry(
  potId: string,
  amount: number,
  direction: "deposit" | "withdraw",
  note: string | null
) {
  if (!amount || amount <= 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("pot_entries").insert({
    pot_id: potId,
    amount: direction === "withdraw" ? -amount : amount,
    note,
  });
  if (error) throw error;
}

export async function deletePotEntry(entryId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pot_entries").delete().eq("id", entryId);
  if (error) throw error;
}
