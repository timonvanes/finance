import type { SupabaseClient } from "@supabase/supabase-js";

// ING's Oranje Spaarrekening sub-accounts show up as e.g.
// "Oranje spaarrekening Z16377129" — the number is unique per sub-account,
// which makes it a reliable way to tell savings pots apart.
const SAVINGS_ID = /spaarrekening\s+([a-z]?\d{6,})/i;

export function extractSavingsId(tx: {
  counterparty_name: string | null;
  raw_description: string | null;
}): string | null {
  const text = `${tx.counterparty_name ?? ""} ${tx.raw_description ?? ""}`;
  const match = text.match(SAVINGS_ID);
  return match ? match[1].toUpperCase() : null;
}

// Makes sure every savings account number seen in these transactions has a
// pot with that number as its recognition text, creating the missing ones.
// Pass userId with the admin client (no auth.uid() to fall back on).
export async function ensurePotsForSavingsIds(
  supabase: SupabaseClient,
  transactionIds: string[],
  userId?: string
): Promise<number> {
  if (transactionIds.length === 0) return 0;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, booking_date, counterparty_name, raw_description")
    .in("id", transactionIds);
  // Earliest booking date per account number: the new pot must start no later
  // than that, or its older deposits would be ignored as "before the opening balance".
  const earliest = new Map<string, string>();
  for (const tx of transactions ?? []) {
    const id = extractSavingsId(tx);
    if (!id) continue;
    const seen = earliest.get(id);
    if (!seen || tx.booking_date < seen) earliest.set(id, tx.booking_date);
  }
  const ids = new Set(earliest.keys());
  if (ids.size === 0) return 0;

  let potsQuery = supabase.from("pots").select("match_text");
  if (userId) potsQuery = potsQuery.eq("user_id", userId);
  const { data: pots } = await potsQuery;
  const known = (pots ?? []).map((p) => (p.match_text ?? "").toLowerCase()).filter(Boolean);

  const missing = [...ids].filter((id) => !known.some((k) => k.includes(id.toLowerCase())));
  if (missing.length === 0) return 0;

  const { error } = await supabase.from("pots").insert(
    missing.map((id) => ({
      ...(userId ? { user_id: userId } : {}),
      name: `Spaarrekening ${id}`,
      kind: "savings",
      match_text: id,
      opening_balance: 0,
      opening_balance_date: earliest.get(id),
    }))
  );
  if (error) throw error;
  return missing.length;
}
