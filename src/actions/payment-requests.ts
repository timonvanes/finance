"use server";

import { createClient } from "@/lib/supabase/server";
import { autoMatchNewPaymentRequest, learnPersonAlias } from "@/lib/reclaims/matching";
import { generateReferenceCode } from "@/lib/reclaims/reference-code";

export async function getPaymentRequests() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_requests")
    .select(
      `id, person_id, reference_code, tikkie_link, status, paid_at, created_at, settled_transaction_id,
      people(name),
      reclaims(id, computed_amount, transactions!reclaims_transaction_id_fkey(booking_date, counterparty_name, amount)),
      settled_transaction:transactions!payment_requests_settled_transaction_id_fkey(booking_date, counterparty_name, amount)`
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Bundles several open, not-yet-combined reclaims for the SAME person into
// one betaalverzoek with a single reference code and combined total.
export async function combineReclaims(reclaimIds: string[]) {
  if (reclaimIds.length < 2) return;

  const supabase = await createClient();
  const { data: reclaims, error: fetchError } = await supabase
    .from("reclaims")
    .select("id, person_id, status, settlement_method, payment_request_id")
    .in("id", reclaimIds);
  if (fetchError) throw fetchError;
  if (!reclaims || reclaims.length !== reclaimIds.length) {
    throw new Error("Een of meer terugvorderingen zijn niet gevonden.");
  }

  const personIds = new Set(reclaims.map((r) => r.person_id));
  if (personIds.size > 1) {
    throw new Error("Kan alleen terugvorderingen van dezelfde persoon combineren.");
  }
  if (reclaims.some((r) => r.status !== "requested" || r.payment_request_id)) {
    throw new Error("Een of meer terugvorderingen zijn al betaald of al gecombineerd.");
  }
  if (reclaims.some((r) => r.settlement_method !== "bank")) {
    throw new Error("Combineren kan alleen voor terugvorderingen via bankoverschrijving.");
  }

  const [personId] = personIds;
  const { data: paymentRequest, error: insertError } = await supabase
    .from("payment_requests")
    .insert({ person_id: personId, reference_code: generateReferenceCode() })
    .select("id")
    .single();
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from("reclaims")
    .update({ payment_request_id: paymentRequest.id })
    .in("id", reclaimIds);
  if (updateError) throw updateError;

  // The combined payment may already have arrived before this bundle
  // was created.
  await autoMatchNewPaymentRequest(supabase, paymentRequest.id);
}

// Splits a payment request back into individually-tracked reclaims — only
// while still open; a paid one should be unlinked first if it needs undoing.
export async function uncombinePaymentRequest(paymentRequestId: string) {
  const supabase = await createClient();

  const { data: pr, error: fetchError } = await supabase
    .from("payment_requests")
    .select("status")
    .eq("id", paymentRequestId)
    .single();
  if (fetchError) throw fetchError;
  if (pr.status === "paid") {
    throw new Error("Dit betaalverzoek is al betaald — maak eerst de koppeling ongedaan.");
  }

  const { error: updateError } = await supabase
    .from("reclaims")
    .update({ payment_request_id: null })
    .eq("payment_request_id", paymentRequestId);
  if (updateError) throw updateError;

  const { error: deleteError } = await supabase
    .from("payment_requests")
    .delete()
    .eq("id", paymentRequestId);
  if (deleteError) throw deleteError;
}

export async function updatePaymentRequestLink(paymentRequestId: string, tikkieLink: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_requests")
    .update({ tikkie_link: tikkieLink || null })
    .eq("id", paymentRequestId);
  if (error) throw error;
}

export async function markPaymentRequestPaid(paymentRequestId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error: prError } = await supabase
    .from("payment_requests")
    .update({ status: "paid", paid_at: now })
    .eq("id", paymentRequestId);
  if (prError) throw prError;

  const { error: reclaimsError } = await supabase
    .from("reclaims")
    .update({ status: "paid", paid_at: now })
    .eq("payment_request_id", paymentRequestId);
  if (reclaimsError) throw reclaimsError;
}

export async function linkPaymentRequestToTransaction(
  paymentRequestId: string,
  transactionId: string
) {
  const supabase = await createClient();

  const [{ data: tx, error: txError }, { data: pr, error: prError }] = await Promise.all([
    supabase
      .from("transactions")
      .select("booking_date, counterparty_name")
      .eq("id", transactionId)
      .single(),
    supabase.from("payment_requests").select("person_id").eq("id", paymentRequestId).single(),
  ]);
  if (txError) throw txError;
  if (prError) throw prError;

  const { error: updatePrError } = await supabase
    .from("payment_requests")
    .update({ settled_transaction_id: transactionId, status: "paid", paid_at: tx.booking_date })
    .eq("id", paymentRequestId);
  if (updatePrError) throw updatePrError;

  const { error: updateReclaimsError } = await supabase
    .from("reclaims")
    .update({ settled_transaction_id: transactionId, status: "paid", paid_at: tx.booking_date })
    .eq("payment_request_id", paymentRequestId);
  if (updateReclaimsError) throw updateReclaimsError;

  await learnPersonAlias(supabase, pr.person_id, tx.counterparty_name);
}

export async function unlinkPaymentRequest(paymentRequestId: string) {
  const supabase = await createClient();
  const { error: prError } = await supabase
    .from("payment_requests")
    .update({ settled_transaction_id: null, status: "requested", paid_at: null })
    .eq("id", paymentRequestId);
  if (prError) throw prError;

  const { error: reclaimsError } = await supabase
    .from("reclaims")
    .update({ settled_transaction_id: null, status: "requested", paid_at: null })
    .eq("payment_request_id", paymentRequestId);
  if (reclaimsError) throw reclaimsError;
}
