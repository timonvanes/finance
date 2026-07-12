import type { SupabaseClient } from "@supabase/supabase-js";
import { enableBankingFetch } from "./client";
import { applyCategoryRules } from "@/lib/categorization/engine";
import { autoMatchIncomingTransactions } from "@/lib/reclaims/matching";

interface AccountIdentification {
  identification?: string;
  scheme_name?: string;
}

interface EnableBankingTransaction {
  transaction_id?: string;
  entry_reference?: string;
  booking_date: string;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator: "CRDT" | "DBIT";
  creditor?: { name?: string };
  debtor?: { name?: string };
  creditor_account?: AccountIdentification;
  debtor_account?: AccountIdentification;
  remittance_information?: string[];
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

function counterpartyIban(tx: EnableBankingTransaction): string | null {
  const account =
    tx.credit_debit_indicator === "DBIT" ? tx.creditor_account : tx.debtor_account;
  if (account?.scheme_name === "IBAN" && account.identification) {
    return account.identification;
  }
  return null;
}

const HISTORY_DAYS = 90;

async function fetchAllTransactions(
  accountUid: string
): Promise<EnableBankingTransaction[]> {
  const all: EnableBankingTransaction[] = [];
  let continuationKey: string | undefined;

  const dateFrom = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

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

// If a transaction's counterparty IBAN matches one of the user's own linked
// accounts (e.g. money moved from ING to Rabobank/Revolut), it's a transfer
// between own accounts, not real spend or income — mark it as such and skip
// the manual review queue for it.
async function markOwnTransfers(supabase: SupabaseClient, transactionIds: string[]) {
  if (transactionIds.length === 0) return;

  const { data: ownAccounts } = await supabase
    .from("bank_accounts")
    .select("iban")
    .not("iban", "is", null);
  const ownIbans = new Set((ownAccounts ?? []).map((a) => a.iban));
  if (ownIbans.size === 0) return;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, counterparty_iban")
    .in("id", transactionIds)
    .not("counterparty_iban", "is", null);

  for (const tx of transactions ?? []) {
    if (tx.counterparty_iban && ownIbans.has(tx.counterparty_iban)) {
      await supabase
        .from("transactions")
        .update({ is_transfer: true, reviewed: true })
        .eq("id", tx.id);
    }
  }
}

export async function syncBankConnection(
  supabase: SupabaseClient,
  bankConnectionId: string
) {
  const { data: accounts, error: accountsError } = await supabase
    .from("bank_accounts")
    .select("id, account_uid")
    .eq("bank_connection_id", bankConnectionId);

  if (accountsError) throw accountsError;

  let syncedCount = 0;

  for (const account of accounts ?? []) {
    const transactions = await fetchAllTransactions(account.account_uid);

    const rows = transactions
      .map((tx) => {
        const externalId = tx.transaction_id || tx.entry_reference;
        if (!externalId) return null;
        return {
          bank_account_id: account.id,
          external_transaction_id: externalId,
          booking_date: tx.booking_date,
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
