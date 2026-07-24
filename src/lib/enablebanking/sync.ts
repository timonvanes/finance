import type { SupabaseClient } from "@supabase/supabase-js";
import { enableBankingFetch } from "./client";
import { applyCategoryRules } from "@/lib/categorization/engine";
import { autoMatchIncomingTransactions } from "@/lib/reclaims/matching";
import { matchPotTransfers } from "@/lib/pots/matching";

interface AccountIdentification {
  identification?: string;
  scheme_name?: string;
}

interface EnableBankingTransaction {
  transaction_id?: string;
  entry_reference?: string;
  // A not-yet-settled card payment (status "PDNG") has neither of these —
  // only transaction_date — which caused a NOT NULL crash on booking_date.
  booking_date: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator: "CRDT" | "DBIT";
  creditor?: { name?: string };
  debtor?: { name?: string };
  creditor_account?: AccountIdentification;
  debtor_account?: AccountIdentification;
  remittance_information?: string[];
}

// Falls back through value_date/transaction_date for pending transactions
// that don't have a final booking_date yet — still worth showing (you
// typically want to see a pending card payment the same day), it'll just
// get its real booking_date once the transaction settles.
function resolveBookingDate(tx: EnableBankingTransaction): string | null {
  return tx.booking_date || tx.value_date || tx.transaction_date || null;
}

interface TransactionsResponse {
  transactions: EnableBankingTransaction[];
  continuation_key?: string;
}

function toSignedAmount(tx: EnableBankingTransaction): number {
  const magnitude = Number(tx.transaction_amount.amount);
  return tx.credit_debit_indicator === "DBIT" ? -magnitude : magnitude;
}

function counterpartyName(tx: EnableBankingTransaction): string | null {
  // For an outflow (DBIT) the counterparty is the creditor we paid;
  // for an inflow (CRDT) it's the debtor who paid us.
  const name =
    tx.credit_debit_indicator === "DBIT" ? tx.creditor?.name : tx.debtor?.name;
  return name ?? null;
}

// Matches a Dutch IBAN embedded in free-text remittance info, e.g.
// "Naam: TSJ Van Es IBAN: NL21RABO0314485414 Datum/Tijd: ...".
const IBAN_PATTERN = /\bNL\d{2}[A-Z]{4}\d{10}\b/;

function extractIbanFromText(text: string | undefined): string | null {
  if (!text) return null;
  return text.match(IBAN_PATTERN)?.[0] ?? null;
}

function counterpartyIban(tx: EnableBankingTransaction): string | null {
  const account =
    tx.credit_debit_indicator === "DBIT" ? tx.creditor_account : tx.debtor_account;
  if (account?.scheme_name === "IBAN" && account.identification) {
    return account.identification;
  }
  // Some banks (e.g. ING) don't populate the structured account field, but
  // still put the counterparty IBAN in the remittance text.
  return extractIbanFromText((tx.remittance_information ?? []).join(" "));
}

const HISTORY_DAYS = 90;

async function fetchAllTransactions(
  accountUid: string,
  syncFromDate: string | null
): Promise<EnableBankingTransaction[]> {
  const all: EnableBankingTransaction[] = [];
  let continuationKey: string | undefined;

  const dateFrom =
    syncFromDate ??
    new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  do {
    const params = new URLSearchParams({ date_from: dateFrom });
    if (continuationKey) params.set("continuation_key", continuationKey);

    const page = await enableBankingFetch<TransactionsResponse>(
      `/accounts/${accountUid}/transactions?${params.toString()}`
    );
    all.push(...page.transactions);
    continuationKey = page.continuation_key;
  } while (continuationKey);

  return all;
}

// Revolut top-ups typically go through as a card payment rather than a SEPA
// credit transfer, so no IBAN is ever present — but the counterparty name is
// always "Revolut..." and that alone is a reliable enough signal.
const OWN_ACCOUNT_NAME_PATTERNS = [/^revolut/i];

function looksLikeOwnAccountByName(name: string | null): boolean {
  if (!name) return false;
  return OWN_ACCOUNT_NAME_PATTERNS.some((p) => p.test(name.trim()));
}

const TRANSFER_MATCH_WINDOW_DAYS = 3;

// The counterparty side of a transfer doesn't always carry IBAN or name
// data we can match on (e.g. an incoming credit with no remittance text at
// all). As a fallback, pair it up with an opposite-amount transaction on a
// *different* own account within a few days — only when there's exactly one
// candidate, to avoid mismatching on coincidentally equal amounts.
//
// Fetches the whole own-account candidate pool in one query and pairs it up
// in memory — a first-time 90-day sync can have hundreds of new
// transactions, and a per-transaction query here was the main cause of
// sync timing out / failing on larger syncs.
async function matchTransfersByAmount(supabase: SupabaseClient, transactionIds: string[]) {
  if (transactionIds.length === 0) return;

  const { data: ownAccounts } = await supabase.from("bank_accounts").select("id");
  const ownAccountIds = (ownAccounts ?? []).map((a) => a.id);
  if (ownAccountIds.length < 2) return;

  const { data: candidates } = await supabase
    .from("transactions")
    .select("id, bank_account_id, amount, booking_date")
    .in("id", transactionIds)
    .eq("is_transfer", false)
    .in("bank_account_id", ownAccountIds);
  if (!candidates || candidates.length === 0) return;

  const windowMs = TRANSFER_MATCH_WINDOW_DAYS * 86400000;
  const bookingTimes = candidates.map((c) => new Date(c.booking_date).getTime());
  const poolFrom = new Date(Math.min(...bookingTimes) - windowMs).toISOString().slice(0, 10);
  const poolTo = new Date(Math.max(...bookingTimes) + windowMs).toISOString().slice(0, 10);

  const { data: pool } = await supabase
    .from("transactions")
    .select("id, bank_account_id, amount, booking_date")
    .in("bank_account_id", ownAccountIds)
    .gte("booking_date", poolFrom)
    .lte("booking_date", poolTo);
  const poolList = pool ?? [];

  const toFlag = new Set<string>();
  for (const tx of candidates) {
    const from = new Date(tx.booking_date).getTime() - windowMs;
    const to = new Date(tx.booking_date).getTime() + windowMs;

    // Don't require the opposite side to still be unflagged — it may
    // already have been marked a transfer via IBAN/name matching, which
    // only confirms this is its pair, not a reason to skip it.
    const opposite = poolList.filter((o) => {
      if (o.id === tx.id || o.bank_account_id === tx.bank_account_id) return false;
      if (o.amount !== -tx.amount) return false;
      const t = new Date(o.booking_date).getTime();
      return t >= from && t <= to;
    });

    if (opposite.length === 1) {
      toFlag.add(tx.id);
      toFlag.add(opposite[0].id);
    }
  }

  if (toFlag.size > 0) {
    await supabase
      .from("transactions")
      .update({ is_transfer: true, reviewed: true })
      .in("id", [...toFlag]);
  }
}

// If a transaction's counterparty IBAN matches one of the user's own linked
// accounts (e.g. money moved from ING to Rabobank/Revolut), it's a transfer
// between own accounts, not real spend or income — mark it as such and skip
// the manual review queue for it.
export async function markOwnTransfers(supabase: SupabaseClient, transactionIds: string[]) {
  if (transactionIds.length === 0) return;

  const [{ data: ownAccounts }, { data: manualIbans }] = await Promise.all([
    supabase.from("bank_accounts").select("iban").not("iban", "is", null),
    supabase.from("manual_own_ibans").select("iban"),
  ]);
  const ownIbans = new Set([
    ...(ownAccounts ?? []).map((a) => a.iban),
    ...(manualIbans ?? []).map((a) => a.iban),
  ]);

  if (ownIbans.size > 0) {
    const { data: transactions } = await supabase
      .from("transactions")
      .select("id, counterparty_iban, counterparty_name")
      .in("id", transactionIds);

    const toFlag = (transactions ?? [])
      .filter(
        (tx) =>
          (tx.counterparty_iban && ownIbans.has(tx.counterparty_iban)) ||
          looksLikeOwnAccountByName(tx.counterparty_name)
      )
      .map((tx) => tx.id);

    if (toFlag.length > 0) {
      await supabase
        .from("transactions")
        .update({ is_transfer: true, reviewed: true })
        .in("id", toFlag);
    }
  }

  await matchTransfersByAmount(supabase, transactionIds);
}

export async function syncBankConnection(
  supabase: SupabaseClient,
  bankConnectionId: string
) {
  const [{ data: accounts, error: accountsError }, { data: connection }] = await Promise.all([
    supabase.from("bank_accounts").select("id, account_uid").eq("bank_connection_id", bankConnectionId),
    supabase
      .from("bank_connections")
      .select("sync_from_date")
      .eq("id", bankConnectionId)
      .single(),
  ]);

  if (accountsError) throw accountsError;

  let syncedCount = 0;

  for (const account of accounts ?? []) {
    const transactions = await fetchAllTransactions(
      account.account_uid,
      connection?.sync_from_date ?? null
    );

    const rows = transactions
      .map((tx) => {
        const externalId = tx.transaction_id || tx.entry_reference;
        if (!externalId) return null;
        const bookingDate = resolveBookingDate(tx);
        if (!bookingDate) return null; // no usable date at all — skip rather than crash
        return {
          bank_account_id: account.id,
          external_transaction_id: externalId,
          booking_date: bookingDate,
          amount: toSignedAmount(tx),
          currency: tx.transaction_amount.currency,
          counterparty_name: counterpartyName(tx),
          counterparty_iban: counterpartyIban(tx),
          raw_description: (tx.remittance_information ?? []).join(" ") || null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length > 0) {
      const { data: inserted, error: upsertError } = await supabase
        .from("transactions")
        .upsert(rows, {
          onConflict: "bank_account_id,external_transaction_id",
          ignoreDuplicates: true,
        })
        .select("id");
      if (upsertError) throw upsertError;
      syncedCount += rows.length;

      // ignoreDuplicates means only genuinely new rows come back here —
      // safe to run the rule matcher / reclaim auto-linker on exactly those.
      const insertedIds = (inserted ?? []).map((row) => row.id);
      await markOwnTransfers(supabase, insertedIds);
      await matchPotTransfers(supabase, insertedIds);
      await applyCategoryRules(supabase, insertedIds);
      await autoMatchIncomingTransactions(supabase, insertedIds);
    }
  }

  await supabase
    .from("bank_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", bankConnectionId);

  return syncedCount;
}
