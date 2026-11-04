"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { periodRange } from "@/lib/month";
import { getMonthStartDay } from "@/lib/settings";
import { getWbwFrontedRows } from "@/lib/wbw-fronted";
import { fetchWbwBalances, isWbwConfigured } from "@/lib/wbw/client";
import { recordWbwBalance, todayAmsterdam } from "@/lib/wbw/record";

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
export async function syncWbwBalance(): Promise<{ error: string } | { balance: number; lists: number; other: string[] }> {
  try {
    if (!isWbwConfigured()) return { error: "WBW_EMAIL en WBW_PASSWORD staan nog niet in Vercel." };
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Niet ingelogd." };

    const b = await fetchWbwBalances();
    const result = await recordWbwBalance(supabase, user.id, b.eur, todayAmsterdam());
    if (result.error) return { error: result.error };
    revalidatePath("/", "layout");
    return {
      balance: b.eur,
      lists: b.lists,
      other: b.other.map((o) => `${o.currency} ${o.amount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`),
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
