"use server";

import { createClient } from "@/lib/supabase/server";
import { extractOrderFromEmailText } from "@/lib/anthropic/extract-order";
import { inferDiscount } from "@/lib/returns/amounts";
import { applyReturnToOrderCore, isConfident, scoreOrdersForReturn } from "@/lib/returns/core";
import { extractReturnFromEmailText, type ExtractedReturn } from "@/lib/anthropic/extract-return";

export async function extractOrderPreview(emailText: string) {
  return extractOrderFromEmailText(emailText);
}

export async function createOrder(input: {
  merchantName: string;
  orderDate: string | null;
  totalAmount: number | null;
  sourceText: string;
  paymentMethod?: "direct" | "klarna" | "invoice";
  discountTotal?: number;
  items: { description: string; price: number; quantity: number }[];
}) {
  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      merchant_name: input.merchantName,
      order_date: input.orderDate,
      total_amount: input.totalAmount,
      source_text: input.sourceText || null,
      payment_method: input.paymentMethod ?? "direct",
      discount_total: input.discountTotal ?? inferDiscount(input.items.reduce((s, i) => s + i.price * i.quantity, 0), input.totalAmount),
    })
    .select("id")
    .single();
  if (error) throw error;

  if (input.items.length > 0) {
    const { error: itemsError } = await supabase.from("order_items").insert(
      input.items.map((item) => ({
        order_id: order.id,
        description: item.description,
        price: item.price,
        quantity: item.quantity,
      }))
    );
    if (itemsError) throw itemsError;
  }
}

export async function getOrders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, merchant_name, order_date, total_amount, refunded_shipping, return_fee, payment_method, credited_amount, return_deadline, return_deadline_source, discount_total, refund_status, refund_transaction_id, created_at,
      order_items(id, description, price, quantity, returned),
      order_claims(id, reason, expected_amount, status, refund_transaction_id, created_at),
      refund_transaction:transactions!orders_refund_transaction_id_fkey(booking_date, counterparty_name, amount)`
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function toggleItemReturned(itemId: string, returned: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").update({ returned }).eq("id", itemId);
  if (error) throw error;

  const { data: item } = await supabase
    .from("order_items")
    .select("order_id")
    .eq("id", itemId)
    .single();
  if (!item) return;

  const { data: order } = await supabase
    .from("orders")
    .select("refund_status")
    .eq("id", item.order_id)
    .single();
  // A confirmed refund shouldn't be silently reverted by re-checking items.
  if (order && order.refund_status === "refunded") return;

  const { data: items } = await supabase
    .from("order_items")
    .select("returned")
    .eq("order_id", item.order_id);
  const anyReturned = (items ?? []).some((i) => i.returned);

  await supabase
    .from("orders")
    .update({ refund_status: anyReturned ? "pending" : "not_returned" })
    .eq("id", item.order_id);
}

export async function deleteOrder(orderId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) throw error;
}

// Incoming transactions not yet claimed as a refund for another order —
// mirrors the equivalent reclaims picker.
export async function getUnlinkedIncomingTransactionsForReturns() {
  const supabase = await createClient();

  const { data: alreadyLinked } = await supabase
    .from("orders")
    .select("refund_transaction_id")
    .not("refund_transaction_id", "is", null);
  const usedIds = (alreadyLinked ?? []).map((o) => o.refund_transaction_id);

  let query = supabase
    .from("visible_transactions")
    .select("id, booking_date, amount, counterparty_name")
    .gt("amount", 0)
    .eq("is_transfer", false)
    .order("booking_date", { ascending: false })
    .limit(100);
  if (usedIds.length > 0) {
    query = query.not("id", "in", `(${usedIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function linkRefundToOrder(orderId: string, transactionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ refund_transaction_id: transactionId, refund_status: "refunded" })
    .eq("id", orderId);
  if (error) throw error;
}

export async function unlinkRefund(orderId: string) {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("order_items")
    .select("returned")
    .eq("order_id", orderId);
  const anyReturned = (items ?? []).some((i) => i.returned);

  const { error } = await supabase
    .from("orders")
    .update({
      refund_transaction_id: null,
      refund_status: anyReturned ? "pending" : "not_returned",
    })
    .eq("id", orderId);
  if (error) throw error;
}

// Shipping that's refunded along with the items (positive) and a return fee
// held back from the refund (positive number, subtracted).
export async function updateOrderCosts(orderId: string, refundedShipping: number, returnFee: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({
      refunded_shipping: Math.max(0, refundedShipping || 0),
      return_fee: Math.max(0, returnFee || 0),
    })
    .eq("id", orderId);
  if (error) throw error;
}

// Paste a return confirmation / credit note: finds the order it belongs to
// and fills in the returned items, shipping and fee. When several orders
// could fit, the candidates come back so you can pick one.
export async function processReturnEmail(emailText: string) {
  const extraction = await extractReturnFromEmailText(emailText);

  const supabase = await createClient();
  const scored = await scoreOrdersForReturn(supabase, extraction);

  if (scored.length === 0) {
    return { status: "none" as const, extraction, candidates: [] };
  }
  if (isConfident(scored)) {
    const result = await applyReturnToOrderCore(supabase, scored[0].id, extraction);
    return { status: "applied" as const, extraction, candidates: [], result };
  }
  return { status: "choose" as const, extraction, candidates: scored.slice(0, 5) };
}

export async function applyReturnToOrder(orderId: string, extraction: ExtractedReturn) {
  return applyReturnToOrderCore(await createClient(), orderId, extraction);
}

export async function setReturnDeadline(orderId: string, deadline: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ return_deadline: deadline || null, return_deadline_source: deadline ? "manual" : null }).eq("id", orderId);
  if (error) throw error;
}

export async function getInboundMails() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbound_mails")
    .select("id, subject, sender, kind, outcome, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export async function deleteInboundMail(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inbound_mails").delete().eq("id", id);
  if (error) throw error;
}

export async function setOrderPaymentMethod(orderId: string, method: "direct" | "klarna" | "invoice") {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ payment_method: method }).eq("id", orderId);
  if (error) throw error;
}

// Klarna says it credited/refunded this amount for the return.
export async function recordKlarnaCredit(orderId: string, amount: number) {
  if (!(amount > 0)) throw new Error("Vul het bedrag in dat Klarna heeft verrekend.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ credited_amount: amount, refund_status: "refunded" })
    .eq("id", orderId);
  if (error) throw error;
}

export async function clearKlarnaCredit(orderId: string) {
  const supabase = await createClient();
  const { data: items } = await supabase.from("order_items").select("returned").eq("order_id", orderId);
  const anyReturned = (items ?? []).some((i) => i.returned);
  const { error } = await supabase
    .from("orders")
    .update({ credited_amount: null, refund_status: anyReturned ? "pending" : "not_returned" })
    .eq("id", orderId);
  if (error) throw error;
}

export async function addOrderClaim(orderId: string, reason: string, expectedAmount: number) {
  if (!(expectedAmount > 0)) throw new Error("Vul het bedrag in dat je verwacht terug te krijgen.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("order_claims")
    .insert({ order_id: orderId, reason: reason.trim() || null, expected_amount: expectedAmount });
  if (error) throw error;
}

export async function markClaimReceived(claimId: string, transactionId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("order_claims")
    .update({ status: "received", refund_transaction_id: transactionId })
    .eq("id", claimId);
  if (error) throw error;
}

export async function reopenClaim(claimId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("order_claims")
    .update({ status: "pending", refund_transaction_id: null })
    .eq("id", claimId);
  if (error) throw error;
}

export async function deleteOrderClaim(claimId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_claims").delete().eq("id", claimId);
  if (error) throw error;
}
