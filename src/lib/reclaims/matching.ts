import type { SupabaseClient } from "@supabase/supabase-js";

const AMOUNT_TOLERANCE = 0.01;

// Does the reclaimed person's name show up in the incoming transaction's
// counterparty name or description? This is what lets a Tikkie/betaalverzoek
// payback auto-match even though it arrives as a generic bank transfer.
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

// Called from the sync job for freshly-synced incoming transactions: check
// each one against all open reclaims for a confident (amount + name) match.
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
    .select("id, person_name, computed_amount")
    .eq("status", "requested");
  if (!openReclaims || openReclaims.length === 0) return;

  for (const tx of transactions) {
    const candidates = openReclaims.filter(
      (r) =>
        Math.abs(r.computed_amount - tx.amount) < AMOUNT_TOLERANCE &&
        namesCorrelate(r.person_name, tx.counterparty_name, tx.raw_description)
    );
    if (candidates.length === 1) {
      await settleReclaim(supabase, candidates[0].id, tx.id, tx.booking_date);
    }
  }
}

// Called right after a reclaim is created: check it against incoming
// transactions that already exist (the payback may have arrived before the
// reclaim was logged in the app).
export async function autoMatchNewReclaim(supabase: SupabaseClient, reclaimId: string) {
  const { data: reclaim } = await supabase
    .from("reclaims")
    .select("id, person_name, computed_amount")
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
  if (!candidates) return;

  const matches = candidates.filter(
    (tx) =>
      Math.abs(reclaim.computed_amount - tx.amount) < AMOUNT_TOLERANCE &&
      namesCorrelate(reclaim.person_name, tx.counterparty_name, tx.raw_description)
  );

  if (matches.length === 1) {
    await settleReclaim(supabase, reclaim.id, matches[0].id, matches[0].booking_date);
  }
}
