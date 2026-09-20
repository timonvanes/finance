"use server";

import { createClient } from "@/lib/supabase/server";
import { matchPotTransfers, rematchPotHistory } from "@/lib/pots/matching";
import { ensurePotsForSavingsIds } from "@/lib/pots/detect";
import { computePotBalance } from "@/lib/pots/balance";

export async function getPots() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pots")
    .select(
      "id, name, kind, created_at, target_amount, target_date, monthly_amount, match_text, opening_balance, opening_balance_date, pot_entries(id, amount, note, entry_date, transaction_id)"
    )
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getPotsTotalBalance() {
  const pots = await getPots();
  return pots.reduce((sum, pot) => sum + computePotBalance(pot), 0);
}

export async function createPot(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  const kind = (formData.get("kind") as string) || "savings";
  const targetRaw = formData.get("targetAmount") as string;
  const targetAmount = targetRaw ? Number(targetRaw) : null;
  const targetDate = (formData.get("targetDate") as string) || null;
  const matchText = ((formData.get("matchText") as string) || "").trim() || null;
  const monthlyRaw = formData.get("monthlyAmount") as string;
  const monthlyAmount = monthlyRaw ? Number(monthlyRaw) : null;
  const openingBalanceRaw = formData.get("openingBalance") as string;
  const openingBalanceDate = (formData.get("openingBalanceDate") as string) || undefined;

  const supabase = await createClient();

  // With a recognition text and no explicit start date, start at the first
  // matching transaction so older deposits count towards the balance.
  let startDate = openingBalanceDate;
  if (matchText && !startDate) {
    const safe = matchText.replace(/[,()]/g, "");
    const { data: first } = await supabase
      .from("transactions")
      .select("booking_date")
      .or(`counterparty_name.ilike.%${safe}%,raw_description.ilike.%${safe}%`)
      .order("booking_date", { ascending: true })
      .limit(1);
    startDate = first?.[0]?.booking_date;
  }

  const { data: created, error } = await supabase.from("pots").insert({
    name,
    kind,
    match_text: matchText,
    monthly_amount: monthlyAmount && monthlyAmount > 0 ? monthlyAmount : null,
    target_amount: targetAmount && targetAmount > 0 ? targetAmount : null,
    target_date: targetAmount && targetAmount > 0 ? targetDate : null,
    opening_balance: openingBalanceRaw ? Number(openingBalanceRaw) : 0,
    ...(startDate ? { opening_balance_date: startDate } : {}),
  }).select("id").single();
  if (error) throw error;

  // Pick up transfers that already happened.
  if (matchText) await rematchPotHistory(supabase, created.id);
}

export async function updatePotTarget(potId: string, targetAmount: number | null, targetDate: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pots")
    .update({
      target_amount: targetAmount && targetAmount > 0 ? targetAmount : null,
      target_date: targetAmount && targetAmount > 0 ? targetDate : null,
    })
    .eq("id", potId);
  if (error) throw error;
}

// The opening balance is a starting point as of a date, not a regular
// entry — entries dated before it aren't counted, to avoid double-counting
// money that's already baked into the manually-entered starting amount.
export async function updatePotOpeningBalance(potId: string, amount: number, date: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pots")
    .update({ opening_balance: amount || 0, opening_balance_date: date })
    .eq("id", potId);
  if (error) throw error;
}

export async function deletePot(potId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pots").delete().eq("id", potId);
  if (error) throw error;
}

// Setting/changing the match text also re-scans existing history, since
// ongoing sync only checks newly-synced transactions going forward.
export async function updatePotMatchText(potId: string, matchText: string | null) {
  const supabase = await createClient();
  const trimmed = matchText?.trim() || null;
  const { error } = await supabase.from("pots").update({ match_text: trimmed }).eq("id", potId);
  if (error) throw error;

  if (trimmed) {
    return rematchPotHistory(supabase, potId);
  }
  return 0;
}

// direction "withdraw" stores the amount negative.
export async function addPotEntry(
  potId: string,
  amount: number,
  direction: "deposit" | "withdraw",
  note: string | null
) {
  if (!amount || amount <= 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("pot_entries").insert({
    pot_id: potId,
    amount: direction === "withdraw" ? -amount : amount,
    note,
  });
  if (error) throw error;
}

export async function deletePotEntry(entryId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pot_entries").delete().eq("id", entryId);
  if (error) throw error;
}

export async function setPotMonthlyAmount(potId: string, amount: number | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pots")
    .update({ monthly_amount: amount && amount > 0 ? amount : null })
    .eq("id", potId);
  if (error) throw error;
}

export async function getPlannedSavingsTotal() {
  const supabase = await createClient();
  const { data } = await supabase.from("pots").select("monthly_amount").not("monthly_amount", "is", null);
  return (data ?? []).reduce((sum, p) => sum + Number(p.monthly_amount), 0);
}

// One tap for "I transferred the planned amount this month" when the
// transfer isn't recognised automatically.
export async function depositPlanned(potId: string, amount?: number) {
  const supabase = await createClient();
  let value = amount;
  if (!value) {
    const { data, error } = await supabase.from("pots").select("monthly_amount").eq("id", potId).single();
    if (error) throw error;
    value = Number(data.monthly_amount);
  }
  if (!value || value <= 0) throw new Error("Geen bedrag om in te leggen.");
  const { error } = await supabase
    .from("pot_entries")
    .insert({ pot_id: potId, amount: value, note: "Maandelijkse inleg" });
  if (error) throw error;
}

// Compare the real balance at the bank with what the app thinks the pot
// holds; optionally book the difference as a correction entry.
export async function checkPotBalance(potId: string, actual: number, correct: boolean) {
  const supabase = await createClient();
  const { data: pot, error } = await supabase
    .from("pots")
    .select("opening_balance, opening_balance_date, pot_entries(amount, entry_date)")
    .eq("id", potId)
    .single();
  if (error) throw error;

  const expected = computePotBalance(pot as never);
  const difference = actual - expected;
  const willCorrect = correct && Math.abs(difference) >= 0.005;

  const { error: checkError } = await supabase
    .from("pot_balance_checks")
    .insert({ pot_id: potId, actual, expected, corrected: willCorrect });
  if (checkError) throw checkError;

  if (willCorrect) {
    const { error: entryError } = await supabase.from("pot_entries").insert({
      pot_id: potId,
      amount: Math.round(difference * 100) / 100,
      note: "Correctie na saldocontrole",
    });
    if (entryError) throw entryError;
  }
  return { expected, difference };
}

export async function getLastChecks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pot_balance_checks")
    .select("pot_id, actual, expected, corrected, checked_at")
    .order("checked_at", { ascending: false });
  if (error) throw error;
  const latest = new Map<string, { actual: number; expected: number; corrected: boolean; checkedAt: string }>();
  for (const c of data ?? []) {
    if (!latest.has(c.pot_id)) {
      latest.set(c.pot_id, {
        actual: Number(c.actual),
        expected: Number(c.expected),
        corrected: c.corrected,
        checkedAt: c.checked_at,
      });
    }
  }
  return latest;
}

const SAVINGS_HINTS = [
  "spaarrekening", "oranje spaar", "sparen", "spaarpot", "potje", "beleggen", "degiro",
  "bitvavo", "meesman", "brand new day", "binck", "saxo", "trading 212", "bux",
];

// Transactions that look like moving money to/from savings or investments
// but aren't linked to any pot yet.
export async function getSavingsInbox() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
  const filters = SAVINGS_HINTS.flatMap((h) => [`counterparty_name.ilike.%${h}%`, `raw_description.ilike.%${h}%`]).join(",");

  const { data, error } = await supabase
    .from("visible_transactions")
    .select("id, booking_date, amount, counterparty_name, raw_description")
    .eq("is_transfer", false)
    .gte("booking_date", since)
    .or(filters)
    .order("booking_date", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

// Links a transaction to a pot: outgoing money becomes a deposit, incoming a
// withdrawal. The transaction stops counting as spend/income. With
// remember, the counterparty name becomes the pot's recognition text so the
// next ones are picked up automatically.
export async function assignTransactionToPot(transactionId: string, potId: string, remember: boolean) {
  const supabase = await createClient();
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select("amount, booking_date, counterparty_name")
    .eq("id", transactionId)
    .single();
  if (txError) throw txError;

  const { error: entryError } = await supabase.from("pot_entries").insert({
    pot_id: potId,
    amount: -Number(tx.amount),
    entry_date: tx.booking_date,
    transaction_id: transactionId,
  });
  if (entryError) throw entryError;

  const { error: updateError } = await supabase
    .from("transactions")
    .update({ is_transfer: true, reviewed: true })
    .eq("id", transactionId);
  if (updateError) throw updateError;

  if (remember && tx.counterparty_name) {
    const { data: pot } = await supabase.from("pots").select("match_text").eq("id", potId).single();
    if (!pot?.match_text) {
      await supabase.from("pots").update({ match_text: tx.counterparty_name.trim() }).eq("id", potId);
    }
  }
}

// Finds savings account numbers in past transactions, creates a pot for each
// new one and links their transfers as deposits/withdrawals. Safe to repeat.
export async function autoDetectPots() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { created: 0 };

  const { data: txs } = await supabase
    .from("transactions")
    .select("id")
    .eq("is_transfer", false)
    .or("counterparty_name.ilike.%spaarrekening%,raw_description.ilike.%spaarrekening%")
    .limit(500);
  const ids = (txs ?? []).map((t) => t.id as string);
  const created = await ensurePotsForSavingsIds(supabase, ids, user.id);
  if (created > 0) await matchPotTransfers(supabase, ids, user.id);
  return { created };
}
