import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureWbwCategory } from "@/lib/wbw-fronted";

// "Today" the way the user sees it (the server runs in UTC).
export const todayAmsterdam = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });

// Stores the WieBetaaltWat saldo for a day. The same day twice is a correction:
// the later one replaces the earlier. Works with the user's own client and with
// the admin client (the daily job), so the user is always passed explicitly.
export async function recordWbwBalance(
  supabase: SupabaseClient,
  userId: string,
  balance: number,
  day: string
): Promise<{ error?: string }> {
  if (!Number.isFinite(balance)) return { error: "Vul een geldig bedrag in." };

  await supabase.from("wbw_entries").delete().eq("user_id", userId).eq("kind", "balance").eq("entry_date", day);
  const { error } = await supabase
    .from("wbw_entries")
    .insert({ user_id: userId, entry_date: day, kind: "balance", amount: Math.round(balance * 100) / 100 });
  if (error) return { error: "Opslaan mislukt. Probeer het opnieuw." };

  await ensureWbwCategory(supabase, userId);
  return {};
}
