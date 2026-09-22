import type { SupabaseClient } from "@supabase/supabase-js";

// What others fronted for the user via WieBetaaltWat, booked as an expense
// with no bank transaction — see src/actions/wbw.ts.
export async function wbwFrontedInPeriod(supabase: SupabaseClient, periodStart: string) {
  const { data } = await supabase.from("wbw_fronted_expenses").select("amount").eq("period_start", periodStart);
  return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}
