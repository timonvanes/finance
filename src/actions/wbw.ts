"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { periodRange } from "@/lib/month";
import { getMonthStartDay } from "@/lib/settings";
import { getWbwFrontedRows } from "@/lib/wbw-fronted";
import { fetchWbwBalancesTimed, isWbwConfigured, wbwLogin } from "@/lib/wbw/client";
import { removeReclaimsOfDeletedWbwExpenses } from "@/lib/wbw/sync-deleted";
import { importWbwExpenses } from "@/lib/wbw/import";
import { isoDate } from "@/lib/month";
import { applyWbwLists, recordWbwBalance, todayAmsterdam } from "@/lib/wbw/record";
import { euroSaldo, type WbwListBalance } from "@/lib/wbw/client";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface WbwEntryRow {
  id: string;
  date: string;
  kind: "balance" | "settlement";
  amount: number;
  transactionName: string | null;
}

export interface WbwCandidate {
  id: string;
  date: string;
  name: string;
  amount: number;
}

export async function getWbwStatus() {
  const supabase = await createClient();
  const startDay = await getMonthStartDay();
  const period = periodRange(0, startDay);

  const { data: entries } = await supabase
    .from("wbw_entries")
    .select("id, entry_date, kind, amount, transaction_id, created_at, transactions(counterparty_name)")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);

  const { data: settings } = await supabase.from("user_settings").select("wbw_excluded_lists, wbw_lists").maybeSingle();
  const excludedIds = new Set<string>((settings?.wbw_excluded_lists ?? []) as string[]);
  const wbwLists = ((settings?.wbw_lists ?? []) as WbwListBalance[])
    .map((l) => ({ ...l, included: !excludedIds.has(l.id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));

  const { data: importRows } = await supabase
    .from("transactions")
    .select("wbw_category")
    .eq("source", "wbw")
    .limit(3000);
  const { data: mapRows } = await supabase.from("wbw_category_map").select("wbw_category, category_id");
  const mapped = new Map((mapRows ?? []).map((m) => [m.wbw_category as string, (m.category_id as string | null) ?? null]));
  const counts = new Map<string, number>();
  for (const r of importRows ?? []) {
    const key = (r.wbw_category as string | null) ?? "Overig";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const { data: expenseCategories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("kind", "expense")
    .order("name");
  const { data: importSettings } = await supabase.from("user_settings").select("wbw_import_from").maybeSingle();

  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [rows, { data: recent }] = await Promise.all([
    getWbwFrontedRows(),
    supabase
      .from("visible_transactions")
      .select("id, booking_date, amount, counterparty_name")
      .eq("is_transfer", false)
      .gte("booking_date", since)
      .order("booking_date", { ascending: false })
      .limit(60),
  ]);

  const list: WbwEntryRow[] = (entries ?? []).map((e) => {
    const tx = Array.isArray(e.transactions) ? e.transactions[0] : e.transactions;
    return {
      id: e.id,
      date: e.entry_date,
      kind: e.kind as "balance" | "settlement",
      amount: Number(e.amount),
      transactionName: tx?.counterparty_name ?? null,
    };
  });
  const latest = list.find((e) => e.kind === "balance") ?? null;
  const linked = new Set((entries ?? []).map((e) => e.transaction_id).filter(Boolean));
  const candidates: WbwCandidate[] = (recent ?? [])
    .filter((t) => !linked.has(t.id))
    .map((t) => ({
      id: t.id,
      date: t.booking_date,
      name: t.counterparty_name ?? "Onbekend",
      amount: Number(t.amount),
    }));

  return {
    periodLabel: period.labelDate.toLocaleDateString("nl-NL", { month: "long", year: "numeric" }),
    configured: isWbwConfigured(),
    importFrom: (importSettings?.wbw_import_from as string | null | undefined) ?? null,
    importedCount: (importRows ?? []).length,
    importCategories: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, categoryId: mapped.get(name) ?? null })),
    categories: (expenseCategories ?? []).map((c) => ({ id: c.id as string, name: c.name as string })),
    lists: wbwLists,
    latestBalance: latest ? latest.amount : null,
    latestDate: latest ? latest.date : null,
    othersFrontedThisPeriod: rows.find((r) => r.period_start === period.start)?.amount ?? 0,
    entries: list,
    candidates,
  };
}

// A saldo can be filled in on any day, as often as you like. The same day twice
// is a correction: the later one replaces the earlier. Returns {error} because
// thrown messages are hidden in production.
export async function saveWbwBalance(balance: number, date?: string): Promise<{ error?: string }> {
  const day = date && ISO_DAY.test(date) ? date : todayAmsterdam();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  const result = await recordWbwBalance(supabase, user.id, balance, day);
  if (!result.error) revalidatePath("/", "layout");
  return result;
}

// Reads the saldo of all lists from WieBetaaltWat itself (read-only) and stores
// it as today's saldo, so it no longer has to be typed in.
export async function syncWbwBalance(): Promise<
  | { error: string }
  | {
      balance: number;
      lists: number;
      other: string[];
      timings: string;
      removed: number;
      imports: { imported: number; updated: number; removed: number } | null;
    }
> {
  try {
    if (!isWbwConfigured()) return { error: "WBW_EMAIL en WBW_PASSWORD staan nog niet in Vercel." };
    const started = Date.now();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Niet ingelogd." };

    const session = await wbwLogin();
    const { lists, timings } = await fetchWbwBalancesTimed(session);
    const savedAt = Date.now();
    const result = await applyWbwLists(supabase, user.id, lists, todayAmsterdam());
    if (result.error) return { error: result.error };
    const saveMs = Date.now() - savedAt;
    // Expenses deleted in WieBetaaltWat are removed here too (never blocks the sync).
    let removed = 0;
    try {
      removed = (await removeReclaimsOfDeletedWbwExpenses(supabase, session)).removed;
    } catch (e) {
      console.error("following WBW deletions failed", e);
    }
    // Your part of what others paid, as transactions (only when switched on).
    let imports: { imported: number; updated: number; removed: number } | null = null;
    try {
      const { data: st } = await supabase
        .from("user_settings")
        .select("wbw_import_from, wbw_excluded_lists")
        .maybeSingle();
      if (st?.wbw_import_from) {
        imports = await importWbwExpenses(
          supabase,
          session,
          user.id,
          lists,
          (st.wbw_excluded_lists ?? []) as string[],
          st.wbw_import_from as string
        );
      }
    } catch (e) {
      console.error("importing WieBetaaltWat expenses failed", e);
    }
    revalidatePath("/", "layout");
    const sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
    return {
      removed,
      imports,
      timings: `inloggen ${sec(timings.loginMs)}, saldo's ${sec(timings.balancesMs)}, opslaan ${sec(saveMs)}, totaal op de server ${sec(Date.now() - started)}`,
      balance: result.balance,
      lists: lists.length,
      other: lists
        .filter((l) => l.currency !== "EUR" && l.amount !== 0)
        .map((l) => `${l.currency} ${l.amount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })} (${l.name})`),
    };
  } catch (e) {
    console.error("syncWbwBalance failed", e);
    return { error: e instanceof Error ? e.message : "Saldo ophalen mislukt." };
  }
}

// Squaring up: money that went back and forth to bring the saldo toward 0.
// received > 0 = you received, < 0 = you paid. It moves the saldo but is no
// cost. A linked bank payment becomes an own-account transfer, so it counts as
// neither income nor spending.
export async function addWbwSettlement(
  received: number,
  date: string,
  transactionId: string | null
): Promise<{ error?: string }> {
  if (!Number.isFinite(received) || received === 0) return { error: "Vul een bedrag in." };
  if (!ISO_DAY.test(date)) return { error: "Kies een geldige datum." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  const { error } = await supabase.from("wbw_entries").insert({
    user_id: user.id,
    entry_date: date,
    kind: "settlement",
    amount: Math.round(received * 100) / 100,
    transaction_id: transactionId,
  });
  if (error) return { error: "Opslaan mislukt. Probeer het opnieuw." };

  if (transactionId) {
    await supabase
      .from("transactions")
      .update({ is_transfer: true, reviewed: true, flagged_for_reclaim: false })
      .eq("id", transactionId);
  }
  revalidatePath("/", "layout");
  return {};
}

// Chooses whether a WieBetaaltWat list counts towards the saldo. Today's saldo
// is worked out again from the lists read last time, without logging in again.
export async function setWbwListIncluded(listId: string, included: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  const { data } = await supabase.from("user_settings").select("wbw_excluded_lists, wbw_lists").maybeSingle();
  const excluded = new Set<string>((data?.wbw_excluded_lists ?? []) as string[]);
  if (included) excluded.delete(listId);
  else excluded.add(listId);

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, wbw_excluded_lists: [...excluded], updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { error: "Opslaan mislukt. Probeer het opnieuw." };

  const lists = (data?.wbw_lists ?? null) as WbwListBalance[] | null;
  if (lists && lists.length > 0) {
    const result = await recordWbwBalance(supabase, user.id, euroSaldo(lists, [...excluded]), todayAmsterdam());
    if (result.error) return result;
  }
  revalidatePath("/", "layout");
  return {};
}

export async function deleteWbwEntry(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("wbw_entries")
    .select("id, kind, transaction_id")
    .eq("id", id)
    .maybeSingle();
  if (!entry) return { error: "Niet gevonden." };

  const { error } = await supabase.from("wbw_entries").delete().eq("id", id);
  if (error) return { error: "Verwijderen mislukt." };

  // The payment was made an own-account transfer for this entry; undo that.
  if (entry.kind === "settlement" && entry.transaction_id) {
    await supabase.from("transactions").update({ is_transfer: false }).eq("id", entry.transaction_id);
  }
  revalidatePath("/", "layout");
  return {};
}


// Switches importing of your part of what others paid on or off. On: from the
// start of the current period. Off: the imported transactions are removed again
// (they come back when it is switched on), as the estimate takes over.
export async function setWbwImport(enabled: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  const startDay = await getMonthStartDay();
  const from = enabled ? isoDate(periodRange(0, startDay).startDate) : null;
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, wbw_import_from: from, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { error: "Opslaan mislukt. Probeer het opnieuw." };

  if (!enabled) {
    await supabase.from("transactions").delete().eq("user_id", user.id).eq("source", "wbw");
  }
  revalidatePath("/", "layout");
  return {};
}

// Which of your categories a WieBetaaltWat category becomes. Applies to the
// imported transactions as well, except where you picked a category by hand.
export async function setWbwCategoryMapping(wbwCategory: string, categoryId: string | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  const { error } = await supabase
    .from("wbw_category_map")
    .upsert({ user_id: user.id, wbw_category: wbwCategory, category_id: categoryId }, { onConflict: "user_id,wbw_category" });
  if (error) return { error: "Opslaan mislukt. Probeer het opnieuw." };

  await supabase
    .from("transactions")
    .update({ category_id: categoryId, category_source: categoryId ? "rule" : "none" })
    .eq("user_id", user.id)
    .eq("source", "wbw")
    .eq("wbw_category", wbwCategory)
    .neq("category_source", "manual");
  revalidatePath("/", "layout");
  return {};
}
