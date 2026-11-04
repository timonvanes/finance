import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureWbwCategory } from "@/lib/wbw-fronted";
import { euroSaldo, type WbwListBalance } from "@/lib/wbw/client";

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

// Stores freshly read lists and today's saldo over the lists that count. The
// lists are kept (name, currency, saldo) so the choice of which ones count can
// be changed later without logging in to WieBetaaltWat again.
export async function applyWbwLists(
  supabase: SupabaseClient,
  userId: string,
  lists: WbwListBalance[],
  day: string
): Promise<{ balance: number; error?: string }> {
  const { data } = await supabase.from("user_settings").select("wbw_excluded_lists").eq("user_id", userId).maybeSingle();
  const excluded = (data?.wbw_excluded_lists ?? []) as string[];

  const { error: saveError } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, wbw_lists: lists, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (saveError) return { balance: 0, error: "Opslaan mislukt. Probeer het opnieuw." };

  const balance = euroSaldo(lists, excluded);
  const result = await recordWbwBalance(supabase, userId, balance, day);
  return { balance, ...result };
}
