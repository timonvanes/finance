"use server";

import { createClient } from "@/lib/supabase/server";
import { extractOrderFromEmailText } from "@/lib/anthropic/extract-order";
import { inferDiscount } from "@/lib/returns/amounts";
import { applyReturnToOrderCore, isConfident, scoreOrdersForReturn } from "@/lib/returns/core";
import { autoMatchOrderRefunds } from "@/lib/returns/auto-match";
import { computeDeadline } from "@/lib/returns/deadline";
import { extractReturnFromEmailText, type ExtractedReturn } from "@/lib/anthropic/extract-return";
import { extractReceipt } from "@/lib/anthropic/extract-receipt";
import { getReturnWindow } from "@/lib/returns/policy";

export async function extractOrderPreview(emailText: string) {
  return extractOrderFromEmailText(emailText);
}

const RECEIPT_BUCKET = "receipts";

// A photographed in-store receipt: same return-deadline logic as an online
// order, except the "delivery" date is simply the purchase date — you walk
// out of the shop with the item, there is no shipping.
export async function createOrderFromReceipt(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Geen foto ontvangen.");
  const manualDeadlineInput = (formData.get("manualDeadline") as string) || null;
  const manualWindowInput = Number(formData.get("manualWindowDays") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const mediaType = file.type || "image/jpeg";
  const ex = await extractReceipt(bytes.toString("base64"), mediaType);

  const purchaseDate = /^\d{4}-\d{2}-\d{2}$/.test(ex.purchase_date ?? "")
    ? (ex.purchase_date as string)
    : new Date().toISOString().slice(0, 10);

  // What the user typed in by hand always wins over what was read off the
  // photo — often faster and more reliable than OCR on a printed term.
  const manualDeadline =
    manualDeadlineInput && /^\d{4}-\d{2}-\d{2}$/.test(manualDeadlineInput) ? manualDeadlineInput : null;
  const manualWindowDays = manualWindowInput > 0 ? Math.round(manualWindowInput) : null;

  let deadline: string;
  let deadlineSource: "mail" | "lookup" | "estimate" | "manual";
  let resolvedWindowDays: number | null;

  if (manualDeadline) {
    deadline = manualDeadline;
    deadlineSource = "manual";
    resolvedWindowDays = manualWindowDays;
  } else {
    let windowDays = manualWindowDays ?? ex.return_window_days;
    let windowFromLookup = false;
    if (!windowDays) {
      windowDays = await getReturnWindow(supabase, user.id, ex.merchant_name);
      windowFromLookup = Boolean(windowDays);
    }
    const computed = computeDeadline({ orderDate: purchaseDate, deliveredDate: purchaseDate, windowDays });
    deadline =
      ex.return_deadline && /^\d{4}-\d{2}-\d{2}$/.test(ex.return_deadline) ? ex.return_deadline : computed.deadline;
    deadlineSource = manualWindowDays
      ? "manual"
      : ex.return_deadline || ex.return_window_days
        ? "mail"
        : windowFromLookup
          ? "lookup"
          : "estimate";
    resolvedWindowDays = computed.windowDays;
  }

  const safeName = file.name?.replace(/[^a-zA-Z0-9._-]/g, "_") || "bon.jpg";
  const path = `${user.id}/orders/${Date.now()}_${safeName}`;
  const { error: uploadError } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, bytes, { contentType: mediaType });
  if (uploadError) throw uploadError;

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      merchant_name: ex.merchant_name,
      order_date: purchaseDate,
      total_amount: ex.total_amount,
      channel: "physical",
      receipt_path: path,
      return_deadline: deadline,
      return_deadline_source: deadlineSource,
      return_window_days: resolvedWindowDays,
      delivered_date: purchaseDate,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (ex.items.length > 0) {
    const { error: itemsError } = await supabase.from("order_items").insert(
      ex.items.map((i) => ({ order_id: order.id, description: i.description, price: i.price, quantity: i.quantity }))
    );
    if (itemsError) throw itemsError;
  }

  return { merchant: ex.merchant_name, deadline };
}

export async function getOrderReceiptUrl(receiptPath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(receiptPath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function createOrder(input: {
  merchantName: string;
  orderDate: string | null;
  totalAmount: number | null;
  sourceText: string;
  paymentMethod?: "direct" | "klarna" | "invoice";
  discountTotal?: number;
  // A physical purchase (e.g. an emailed receipt for something bought
  // in-store): the return term runs from the purchase date itself, not from
  // a shipping/delivery date.
  channel?: "online" | "physical";
  returnDeadline?: string | null;
  returnWindowDays?: number | null;
  items: { description: string; price: number; quantity: number }[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");

  const channel = input.channel ?? "online";
  const purchaseDate = input.orderDate || new Date().toISOString().slice(0, 10);

  let windowDays = input.returnWindowDays ?? null;
  let windowFromLookup = false;
  if (!windowDays) {
    windowDays = await getReturnWindow(supabase, user.id, input.merchantName);
    windowFromLookup = Boolean(windowDays);
  }
  const computed = computeDeadline({
    orderDate: purchaseDate,
    deliveredDate: channel === "physical" ? purchaseDate : null,
    windowDays,
  });
  const deadline = input.returnDeadline || computed.deadline;
  const deadlineSource: "mail" | "lookup" | "estimate" = input.returnDeadline
    ? "mail"
    : input.returnWindowDays
      ? "mail"
      : windowFromLookup
        ? "lookup"
        : "estimate";

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      merchant_name: input.merchantName,
      order_date: input.orderDate,
      total_amount: input.totalAmount,
      source_text: input.sourceText || null,
      payment_method: input.paymentMethod ?? "direct",
      discount_total: input.discountTotal ?? inferDiscount(input.items.reduce((s, i) => s + i.price * i.quantity, 0), input.totalAmount),
      channel,
      delivered_date: channel === "physical" ? purchaseDate : null,
      return_deadline: deadline,
      return_deadline_source: deadlineSource,
      return_window_days: computed.windowDays,
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
  // Catches refunds that arrived after their return was processed — the
  // background sync also does this, but this keeps the page itself in sync.
  const { data: recentIncoming } = await supabase
    .from("visible_transactions")
    .select("id")
    .gt("amount", 0)
    .eq("is_transfer", false)
    .order("booking_date", { ascending: false })
    .limit(50);
  if (recentIncoming && recentIncoming.length > 0) {
    await autoMatchOrderRefunds(
      supabase,
      recentIncoming.map((t) => t.id)
    );
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, merchant_name, order_date, order_reference, channel, receipt_path, total_amount, refunded_shipping, return_fee, payment_method, credited_amount, return_deadline, return_deadline_source, delivered_date, expected_delivery_date, return_window_days, discount_total, refund_status, refund_transaction_id, created_at,
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

export async function setDeliveredDate(orderId: string, delivered: string | null) {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("order_date, expected_delivery_date, return_window_days")
    .eq("id", orderId)
    .single();
  if (error) throw error;
  const computed = computeDeadline({
    orderDate: order.order_date ?? new Date().toISOString().slice(0, 10),
    deliveredDate: delivered || null,
    expectedDate: order.expected_delivery_date,
    windowDays: order.return_window_days,
  });
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      delivered_date: delivered || null,
      return_deadline: computed.deadline,
      return_deadline_source: delivered ? "manual" : "estimate",
      return_window_days: computed.windowDays,
    })
    .eq("id", orderId);
  if (updateError) throw updateError;
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
