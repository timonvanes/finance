import type { SupabaseClient } from "@supabase/supabase-js";
import { enableBankingFetch } from "./client";

interface EnableBankingTransaction {
  transaction_id?: string;
  entry_reference?: string;
  booking_date: string;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator: "CRDT" | "DBIT";
  creditor?: { name?: string };
  debtor?: { name?: string };
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
          raw_description: (tx.remittance_information ?? []).join(" ") || null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("transactions")
        .upsert(rows, {
          onConflict: "bank_account_id,external_transaction_id",
          ignoreDuplicates: true,
        });
      if (upsertError) throw upsertError;
      syncedCount += rows.length;
    }
  }

  await supabase
    .from("bank_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", bankConnectionId);

  return syncedCount;
}
