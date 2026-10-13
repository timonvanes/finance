import type { SupabaseClient } from "@supabase/supabase-js";

// Name of the real expense category that holds what others fronted for the user.
export const WBW_CATEGORY = "Via WieBetaaltWat";

// What others fronted for the user via WieBetaaltWat, booked as an expense
// with no bank transaction — see src/actions/wbw.ts.
export async function wbwFrontedInPeriod(supabase: SupabaseClient, periodStart: string) {
  const { data } = await supabase.from("wbw_fronted_expenses").select("amount").eq("period_start", periodStart);
  return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

// Makes sure the category exists so it can be budgeted like any other.
export async function ensureWbwCategory(supabase: SupabaseClient, userId: string) {
  const { data: existing } = await supabase
    .from("categories")
    .select("id, name, kind")
    .eq("user_id", userId)
    .eq("name", WBW_CATEGORY)
    .maybeSingle();
  if (existing) return existing;
  const { data: created } = await supabase
    .from("categories")
    .insert({ user_id: userId, name: WBW_CATEGORY, kind: "expense" })
    .select("id, name, kind")
    .maybeSingle();
  return created;
}
