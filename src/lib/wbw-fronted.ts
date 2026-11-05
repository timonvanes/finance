import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMonthStartDay } from "@/lib/settings";
import { wbwFrontedByPeriod, type WbwEntry } from "@/lib/wbw-balance";
import { isoDate, periodStartFor } from "@/lib/month";

// Name of the real expense category that holds what others fronted for the user.
export const WBW_CATEGORY = "Via WieBetaaltWat";

// What others fronted for the user via WieBetaaltWat, per budget period. It is
// derived from the saldo's the user filled in (see src/lib/wbw-balance.ts), so
// it stays right when reclaims or fill-ins change. Booked as an expense with no
// bank transaction. From the period the real expenses are imported in (the
// "Uitgaven inladen" setting) on, the estimate stops: those expenses are real
// transactions then and would count twice. Cached per request: the overview asks
// for it several times.
export const getWbwFrontedRows = cache(async (): Promise<{ period_start: string; amount: number }[]> => {
  const supabase = await createClient();
  const { data: entries } = await supabase.from("wbw_entries").select("entry_date, kind, amount, created_at");
  if (!entries || entries.filter((e) => e.kind === "balance").length < 2) return [];

  const { data: reclaims } = await supabase
    .from("reclaims")
    .select("computed_amount, transactions!reclaims_transaction_id_fkey!inner(booking_date)")
    .eq("settlement_method", "external_app");
  const fronted = (reclaims ?? []).flatMap((r) => {
    const tx = Array.isArray(r.transactions) ? r.transactions[0] : r.transactions;
    return tx?.booking_date ? [{ booking_date: String(tx.booking_date), amount: Number(r.computed_amount) }] : [];
  });

  const startDay = await getMonthStartDay();
  const rows = wbwFrontedByPeriod(
    entries.map((e) => ({ ...e, amount: Number(e.amount) }) as WbwEntry),
    fronted,
    startDay
  );

  const { data: settings } = await supabase.from("user_settings").select("wbw_import_from").maybeSingle();
  const importFrom = settings?.wbw_import_from as string | null | undefined;
  if (!importFrom) return rows;
  const cutoff = isoDate(periodStartFor(new Date(`${importFrom}T00:00:00`), startDay));
  return rows.filter((r) => r.period_start < cutoff);
});

export async function wbwFrontedInPeriod(periodStart: string) {
  const rows = await getWbwFrontedRows();
  return rows.filter((r) => r.period_start === periodStart).reduce((sum, r) => sum + r.amount, 0);
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
