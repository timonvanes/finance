import type { SupabaseClient } from "@supabase/supabase-js";

// Money put into pots (and taken out again) shows up as spending in this
// category: deposits count as spent, withdrawals take it back off.
export const SAVINGS_CATEGORY = "Sparen & beleggen";

export interface SavingsEntry {
  id: string;
  date: string;
  name: string;
  // Positive = put aside (counts as spent), negative = taken out.
  amount: number;
}

// Pot entries in [from, to) — to is exclusive — from the pot's opening-balance date onwards.
export async function savingsEntriesInRange(
  supabase: SupabaseClient,
  from: string,
  to: string
): Promise<SavingsEntry[]> {
  const { data } = await supabase
    .from("pot_entries")
    .select("id, amount, entry_date, pots(name, opening_balance_date)")
    .gte("entry_date", from)
    .lt("entry_date", to)
    .order("entry_date", { ascending: false });

  const entries: SavingsEntry[] = [];
  for (const e of data ?? []) {
    const pot = Array.isArray(e.pots) ? e.pots[0] : e.pots;
    if (pot?.opening_balance_date && e.entry_date < pot.opening_balance_date) continue;
    const amount = Number(e.amount);
    entries.push({
      id: e.id,
      date: e.entry_date,
      name: `${amount >= 0 ? "Naar" : "Uit"} ${pot?.name ?? "potje"}`,
      amount,
    });
  }
  return entries;
}
