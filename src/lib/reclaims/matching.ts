import type { SupabaseClient } from "@supabase/supabase-js";

const AMOUNT_TOLERANCE = 0.01;

// Does the reclaimed person's name show up in the incoming transaction's
// counterparty name or description? Fallback signal for when there's no
// reference code and no learned alias yet.
function namesCorrelate(
  personName: string,
  counterpartyName: string | null,
  rawDescription: string | null
): boolean {
  const person = personName.toLowerCase().trim();
  if (!person) return false;

  const haystack = `${counterpartyName ?? ""} ${rawDescription ?? ""}`.toLowerCase();
  if (!haystack.trim()) return false;

  const nameParts = person.split(/\s+/).filter((part) => part.length >= 3);
  return nameParts.some((part) => haystack.includes(part));
}

async function settleReclaim(
  supabase: SupabaseClient,
  reclaimId: string,
  transactionId: string,
  bookingDate: string
) {
  await supabase
    .from("reclaims")
    .update({
      settled_transaction_id: transactionId,
      status: "paid",
      paid_at: bookingDate,
    })
    .eq("id", reclaimId);
}

interface CandidateTransaction {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
  raw_description: string | null;
}

interface CandidateReclaim {
  id: string;
  person_name: string;
  computed_amount: number;
  reference_code: string | null;
}

// Finds the best match for one transaction among open reclaims, or null.
// Priority: reference code in the description (near-certain) > a learned
// person alias + amount match (self-learned from past manual links) >
// amount + name/description correlation (only if unambiguous).
async function findMatch(
  supabase: SupabaseClient,
  tx: CandidateTransaction,
  openReclaims: CandidateReclaim[]
): Promise<CandidateReclaim | null> {
  const description = (tx.raw_description ?? "").toUpperCase();
  const byCode = openReclaims.find(
    (r) => r.reference_code && description.includes(r.reference_code)
  );
  if (byCode) return byCode;

  const { data: aliases } = await supabase
    .from("person_aliases")
    .select("person_name, counterparty_name");
  if (aliases && aliases.length > 0 && tx.counterparty_name) {
    const counterparty = tx.counterparty_name.toLowerCase().trim();
    const matchingAliases = openReclaims.filter((r) =>
      aliases.some(
        (a) =>
          a.person_name === r.person_name &&
          a.counterparty_name.toLowerCase().trim() === counterparty &&
          Math.abs(r.computed_amount - tx.amount) < AMOUNT_TOLERANCE
      )
    );
    if (matchingAliases.length === 1) return matchingAliases[0];
  }

  const byNameAndAmount = openReclaims.filter(
    (r) =>
      Math.abs(r.computed_amount - tx.amount) < AMOUNT_TOLERANCE &&
      namesCorrelate(r.person_name, tx.counterparty_name, tx.raw_description)
  );
  if (byNameAndAmount.length === 1) return byNameAndAmount[0];

  return null;
}

// Called from the sync job for freshly-synced incoming transactions.
export async function autoMatchIncomingTransactions(
  supabase: SupabaseClient,
  incomingTransactionIds: string[]
) {
  if (incomingTransactionIds.length === 0) return;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, booking_date, amount, counterparty_name, raw_description")
    .in("id", incomingTransactionIds)
    .gt("amount", 0);
  if (!transactions || transactions.length === 0) return;

  const { data: openReclaims } = await supabase
    .from("reclaims")
    .select("id, person_name, computed_amount, reference_code")
    .eq("status", "requested");
  if (!openReclaims || openReclaims.length === 0) return;

  for (const tx of transactions) {
    const match = await findMatch(supabase, tx, openReclaims);
    if (match) await settleReclaim(supabase, match.id, tx.id, tx.booking_date);
  }
}

// Called right after a reclaim is created: check it against incoming
// transactions that already exist (the payback may have arrived before the
// reclaim was logged in the app).
export async function autoMatchNewReclaim(supabase: SupabaseClient, reclaimId: string) {
  const { data: reclaim } = await supabase
    .from("reclaims")
    .select("id, person_name, computed_amount, reference_code")
    .eq("id", reclaimId)
    .single();
  if (!reclaim) return;

  const { data: alreadyLinked } = await supabase
    .from("reclaims")
    .select("settled_transaction_id")
    .not("settled_transaction_id", "is", null);
  const usedIds = (alreadyLinked ?? []).map((r) => r.settled_transaction_id);

  let query = supabase
    .from("transactions")
    .select("id, booking_date, amount, counterparty_name, raw_description")
    .gt("amount", 0);
  if (usedIds.length > 0) {
    query = query.not("id", "in", `(${usedIds.join(",")})`);
  }

  const { data: candidates } = await query;
  if (!candidates || candidates.length === 0) return;

  for (const tx of candidates) {
    const match = await findMatch(supabase, tx, [reclaim]);
    if (match) {
      await settleReclaim(supabase, reclaim.id, tx.id, tx.booking_date);
      return;
    }
  }
}

// Learn from a manual link: remember that this person's paybacks come from
// this bank counterparty, so future ones auto-match without needing an
// exact amount or the reference code.
export async function learnPersonAlias(
  supabase: SupabaseClient,
  personName: string,
  counterpartyName: string | null
) {
  if (!counterpartyName) return;
  await supabase.from("person_aliases").upsert(
    { person_name: personName, counterparty_name: counterpartyName },
    { onConflict: "user_id,person_name,counterparty_name", ignoreDuplicates: true }
  );
}
