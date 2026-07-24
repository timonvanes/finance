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
  person_id: string;
  person_name: string;
  computed_amount: number;
  reference_code: string | null;
}

// Finds the best match for one transaction among open reclaims, or null.
// Priority: reference code in the description (near-certain) > a learned
// person alias + amount match (self-learned from past manual links) >
// amount + name/description correlation (only if unambiguous).
function findMatch(
  tx: CandidateTransaction,
  openReclaims: CandidateReclaim[],
  aliases: { person_id: string; counterparty_name: string }[]
): CandidateReclaim | null {
  const description = (tx.raw_description ?? "").toUpperCase();

  // A code can intentionally be shared across a group (one betaalverzoek,
  // one code, several people) — narrow down with amount, then name, before
  // giving up as ambiguous.
  const byCode = openReclaims.filter(
    (r) => r.reference_code && description.includes(r.reference_code)
  );
  if (byCode.length === 1) return byCode[0];
  if (byCode.length > 1) {
    const byCodeAndAmount = byCode.filter(
      (r) => Math.abs(r.computed_amount - tx.amount) < AMOUNT_TOLERANCE
    );
    if (byCodeAndAmount.length === 1) return byCodeAndAmount[0];
    if (byCodeAndAmount.length > 1) {
      const byCodeAmountAndName = byCodeAndAmount.filter((r) =>
        namesCorrelate(r.person_name, tx.counterparty_name, tx.raw_description)
      );
      if (byCodeAmountAndName.length === 1) return byCodeAmountAndName[0];
    }
    return null; // ambiguous — leave for the manual dropdown
  }

  if (aliases.length > 0 && tx.counterparty_name) {
    const counterparty = tx.counterparty_name.toLowerCase().trim();
    const matchingAliases = openReclaims.filter((r) =>
      aliases.some(
        (a) =>
          a.person_id === r.person_id &&
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

async function getOpenReclaims(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("reclaims")
    .select("id, person_id, computed_amount, reference_code, people(name)")
    .eq("status", "requested")
    .eq("settlement_method", "bank")
    // Reclaims bundled into a payment request are matched at the group
    // level (see findPaymentRequestMatch), not individually.
    .is("payment_request_id", null);

  return (data ?? []).map((r) => {
    const person = Array.isArray(r.people) ? r.people[0] : r.people;
    return {
      id: r.id,
      person_id: r.person_id,
      person_name: person?.name ?? "",
      computed_amount: r.computed_amount,
      reference_code: r.reference_code,
    } as CandidateReclaim;
  });
}

interface CandidatePaymentRequest {
  id: string;
  person_id: string;
  person_name: string;
  reclaimIds: string[];
  totalAmount: number;
  reference_code: string;
}

async function settlePaymentRequest(
  supabase: SupabaseClient,
  pr: CandidatePaymentRequest,
  transactionId: string,
  bookingDate: string
) {
  await supabase
    .from("payment_requests")
    .update({ settled_transaction_id: transactionId, status: "paid", paid_at: bookingDate })
    .eq("id", pr.id);
  await supabase
    .from("reclaims")
    .update({ settled_transaction_id: transactionId, status: "paid", paid_at: bookingDate })
    .in("id", pr.reclaimIds);
}

async function getOpenPaymentRequests(supabase: SupabaseClient): Promise<CandidatePaymentRequest[]> {
  const { data } = await supabase
    .from("payment_requests")
    .select("id, person_id, reference_code, people(name), reclaims(id, computed_amount)")
    .eq("status", "requested");

  return (data ?? []).map((pr) => {
    const person = Array.isArray(pr.people) ? pr.people[0] : pr.people;
    const reclaimRows = (Array.isArray(pr.reclaims) ? pr.reclaims : []) as {
      id: string;
      computed_amount: number;
    }[];
    return {
      id: pr.id,
      person_id: pr.person_id,
      person_name: person?.name ?? "",
      reclaimIds: reclaimRows.map((r) => r.id),
      totalAmount: reclaimRows.reduce((sum, r) => sum + r.computed_amount, 0),
      reference_code: pr.reference_code,
    };
  });
}

// Same priority as findMatch: a unique reference-code hit is trusted
// outright; otherwise fall back to amount + name correlation against the
// combined total.
function findPaymentRequestMatch(
  tx: CandidateTransaction,
  openPaymentRequests: CandidatePaymentRequest[]
): CandidatePaymentRequest | null {
  const description = (tx.raw_description ?? "").toUpperCase();

  const byCode = openPaymentRequests.filter((pr) => description.includes(pr.reference_code));
  if (byCode.length === 1) return byCode[0];
  if (byCode.length > 1) return null; // ambiguous — leave for the manual dropdown

  const byAmountAndName = openPaymentRequests.filter(
    (pr) =>
      Math.abs(pr.totalAmount - tx.amount) < AMOUNT_TOLERANCE &&
      namesCorrelate(pr.person_name, tx.counterparty_name, tx.raw_description)
  );
  if (byAmountAndName.length === 1) return byAmountAndName[0];

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
    .gt("amount", 0)
    .eq("is_transfer", false);
  if (!transactions || transactions.length === 0) return;

  const [openReclaims, openPaymentRequests, { data: aliases }] = await Promise.all([
    getOpenReclaims(supabase),
    getOpenPaymentRequests(supabase),
    supabase.from("person_aliases").select("person_id, counterparty_name"),
  ]);

  for (const tx of transactions) {
    // Try the combined betaalverzoek first — its reference code is at
    // least as specific as an individual reclaim's.
    const prMatch =
      openPaymentRequests.length > 0 ? findPaymentRequestMatch(tx, openPaymentRequests) : null;
    if (prMatch) {
      await settlePaymentRequest(supabase, prMatch, tx.id, tx.booking_date);
      continue;
    }
    if (openReclaims.length === 0) continue;
    const match = findMatch(tx, openReclaims, aliases ?? []);
    if (match) await settleReclaim(supabase, match.id, tx.id, tx.booking_date);
  }
}

// Called right after reclaims are combined into a payment request: the
// payback may already have arrived before the request was created.
export async function autoMatchNewPaymentRequest(supabase: SupabaseClient, paymentRequestId: string) {
  const openPaymentRequests = await getOpenPaymentRequests(supabase);
  const pr = openPaymentRequests.find((p) => p.id === paymentRequestId);
  if (!pr) return;

  const { data: alreadyLinked } = await supabase
    .from("reclaims")
    .select("settled_transaction_id")
    .not("settled_transaction_id", "is", null);
  const usedIds = (alreadyLinked ?? []).map((r) => r.settled_transaction_id);

  let query = supabase
    .from("transactions")
    .select("id, booking_date, amount, counterparty_name, raw_description")
    .gt("amount", 0)
    .eq("is_transfer", false);
  if (usedIds.length > 0) {
    query = query.not("id", "in", `(${usedIds.join(",")})`);
  }

  const { data: candidates } = await query;
  if (!candidates || candidates.length === 0) return;

  for (const tx of candidates) {
    const match = findPaymentRequestMatch(tx, [pr]);
    if (match) {
      await settlePaymentRequest(supabase, pr, tx.id, tx.booking_date);
      return;
    }
  }
}

// Called right after a reclaim is created: check it against incoming
// transactions that already exist (the payback may have arrived before the
// reclaim was logged in the app).
export async function autoMatchNewReclaim(supabase: SupabaseClient, reclaimId: string) {
  const { data: reclaimRow } = await supabase
    .from("reclaims")
    .select("id, person_id, computed_amount, reference_code, people(name)")
    .eq("id", reclaimId)
    .single();
  if (!reclaimRow) return;

  const person = Array.isArray(reclaimRow.people) ? reclaimRow.people[0] : reclaimRow.people;
  const reclaim: CandidateReclaim = {
    id: reclaimRow.id,
    person_id: reclaimRow.person_id,
    person_name: person?.name ?? "",
    computed_amount: reclaimRow.computed_amount,
    reference_code: reclaimRow.reference_code,
  };

  const { data: alreadyLinked } = await supabase
    .from("reclaims")
    .select("settled_transaction_id")
    .not("settled_transaction_id", "is", null);
  const usedIds = (alreadyLinked ?? []).map((r) => r.settled_transaction_id);

  let query = supabase
    .from("transactions")
    .select("id, booking_date, amount, counterparty_name, raw_description")
    .gt("amount", 0)
    .eq("is_transfer", false);
  if (usedIds.length > 0) {
    query = query.not("id", "in", `(${usedIds.join(",")})`);
  }

  const [{ data: candidates }, { data: aliases }] = await Promise.all([
    query,
    supabase.from("person_aliases").select("person_id, counterparty_name"),
  ]);
  if (!candidates || candidates.length === 0) return;

  for (const tx of candidates) {
    const match = findMatch(tx, [reclaim], aliases ?? []);
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
  personId: string,
  counterpartyName: string | null
) {
  if (!counterpartyName) return;
  await supabase.from("person_aliases").upsert(
    { person_id: personId, counterparty_name: counterpartyName },
    { onConflict: "user_id,person_id,counterparty_name", ignoreDuplicates: true }
  );
}
