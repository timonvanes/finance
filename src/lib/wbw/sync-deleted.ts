import type { SupabaseClient } from "@supabase/supabase-js";
import { wbwExpenseState, wbwListReachable, type WbwSession } from "@/lib/wbw/client";

// When an expense that was put into WieBetaaltWat from here is deleted there, the
// reclaims behind it are removed here too. Only reclaims this app entered itself
// (they remember the expense id) are looked at, and only a clear "gone" counts.
// Returns how many reclaims were removed.
export async function removeReclaimsOfDeletedWbwExpenses(
  supabase: SupabaseClient,
  session: WbwSession,
  userId?: string
): Promise<{ removed: number; expenses: number }> {
  let query = supabase
    .from("reclaims")
    .select("id, transaction_id, wbw_expense_id, wbw_list_id")
    .eq("status", "paid")
    .eq("settlement_method", "external_app")
    .not("wbw_expense_id", "is", null);
  if (userId) query = query.eq("user_id", userId);
  const { data } = await query;
  if (!data || data.length === 0) return { removed: 0, expenses: 0 };

  const byExpense = new Map<string, { listId: string | null; rows: { id: string; transaction_id: string }[] }>();
  for (const r of data) {
    const key = r.wbw_expense_id as string;
    const entry = byExpense.get(key) ?? { listId: r.wbw_list_id as string | null, rows: [] };
    entry.rows.push({ id: r.id as string, transaction_id: r.transaction_id as string });
    byExpense.set(key, entry);
  }

  let removed = 0;
  let expenses = 0;
  for (const [expenseId, entry] of byExpense) {
    try {
      if ((await wbwExpenseState(session, expenseId)) !== "deleted") continue;
      if (entry.listId && !(await wbwListReachable(session, entry.listId))) continue;

      const ids = entry.rows.map((r) => r.id);
      const { error } = await supabase.from("reclaims").delete().in("id", ids);
      if (error) continue;
      removed += ids.length;
      expenses++;

      // A payment without any reclaim left goes back to the to-do list.
      for (const txId of new Set(entry.rows.map((r) => r.transaction_id))) {
        const { data: remaining } = await supabase.from("reclaims").select("id").eq("transaction_id", txId).limit(1);
        if (!remaining || remaining.length === 0) {
          await supabase.from("transactions").update({ flagged_for_reclaim: false, reviewed: false }).eq("id", txId);
        }
      }
    } catch (e) {
      console.error("removeReclaimsOfDeletedWbwExpenses failed for", expenseId, e);
    }
  }
  return { removed, expenses };
}
