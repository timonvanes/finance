import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchWbwListExpenses,
  fetchWbwListMembers,
  type WbwExpense,
  type WbwListBalance,
  type WbwSession,
} from "@/lib/wbw/client";

// What would become a transaction: still active, paid by someone else, and you
// have a part in it. What you paid yourself is already a bank transaction.
export function isImportable(e: WbwExpense, myMemberId: string): boolean {
  return e.status === "active" && e.payerId !== myMemberId && e.myShareCents > 0 && e.date !== "";
}

// Takes your part of the expenses others paid in WieBetaaltWat into the
// transactions, from the chosen date on. Safe to run again and again:
//  - a new expense becomes a transaction on your to-do list (WieBetaaltWat has no
//    categories you use: you categorise, or mark it as your own expense or send it
//    on as a reclaim, like any bank transaction);
//  - a changed one is updated (amount, date, name); what you did with it (category,
//    reviewed) is left alone;
//  - an expense that was deleted there (or is no longer yours) is removed here.
// Only transactions that came from WieBetaaltWat are ever touched.
export async function importWbwExpenses(
  supabase: SupabaseClient,
  session: WbwSession,
  userId: string,
  lists: WbwListBalance[],
  excludedListIds: string[],
  fromDate: string
): Promise<{ imported: number; updated: number; removed: number }> {
  const skip = new Set(excludedListIds);
  const wanted = new Map<
    string,
    { name: string; date: string; cents: number; category: string | null; description: string }
  >();
  const seen = new Set<string>();

  for (const list of lists) {
    if (list.currency !== "EUR" || skip.has(list.id) || !list.memberId) continue;
    const expenses = await fetchWbwListExpenses(session, list.id, list.memberId, fromDate);
    // Who paid is only looked up when something in this list is really imported.
    let nameOf: Map<string, string> | null = null;
    for (const e of expenses) {
      seen.add(e.id);
      if (!isImportable(e, list.memberId)) continue;
      if (!nameOf) {
        const members = await fetchWbwListMembers(session, list.id);
        nameOf = new Map(members.map((m) => [m.id, m.fullName || m.nickname]));
      }
      wanted.set(e.id, {
        name: e.name || "WieBetaaltWat",
        date: e.date,
        cents: e.myShareCents,
        category: e.category,
        description: `WieBetaaltWat · ${list.name} · betaald door ${nameOf?.get(e.payerId) ?? "een deelnemer"}`,
      });
    }
  }

  const { data: existing } = await supabase
    .from("transactions")
    .select("id, wbw_expense_id")
    .eq("user_id", userId)
    .eq("source", "wbw");
  const local = new Map((existing ?? []).map((r) => [r.wbw_expense_id as string, r]));

  let imported = 0;
  let updated = 0;
  let removed = 0;

  const inserts: Record<string, unknown>[] = [];
  for (const [id, w] of wanted) {
    const base = {
      booking_date: w.date,
      amount: -(w.cents / 100),
      currency: "EUR",
      counterparty_name: w.name,
      raw_description: w.description,
      wbw_category: w.category,
    };
    const row = local.get(id);
    if (!row) {
      inserts.push({
        ...base,
        user_id: userId,
        source: "wbw",
        wbw_expense_id: id,
        external_transaction_id: `wbw:${id}`,
        is_transfer: false,
        // On the to-do list, like a new bank transaction.
        reviewed: false,
        category_source: "none",
      });
    } else {
      // Only what comes from WieBetaaltWat is refreshed; your own choices stay.
      const { error } = await supabase.from("transactions").update(base).eq("id", row.id);
      if (!error) updated++;
    }
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from("transactions").insert(inserts);
    if (!error) imported = inserts.length;
  }

  // Seen in WieBetaaltWat but no longer a transaction of yours: gone there.
  const goneIds = [...local.keys()].filter((id) => seen.has(id) && !wanted.has(id));
  if (goneIds.length > 0) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("user_id", userId)
      .eq("source", "wbw")
      .in("wbw_expense_id", goneIds);
    if (!error) removed = goneIds.length;
  }

  return { imported, updated, removed };
}
