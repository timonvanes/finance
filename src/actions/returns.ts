"use server";

import { createClient } from "@/lib/supabase/server";
import { extractOrderFromEmailText } from "@/lib/anthropic/extract-order";
import { extractReturnFromEmailText, type ExtractedReturn } from "@/lib/anthropic/extract-return";

export async function extractOrderPreview(emailText: string) {
  return extractOrderFromEmailText(emailText);
}

export async function createOrder(input: {
  merchantName: string;
  orderDate: string | null;
  totalAmount: number | null;
  sourceText: string;
  paymentMethod?: "direct" | "klarna";
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
      `id, merchant_name, order_date, total_amount, refunded_shipping, return_fee, payment_method, credited_amount, refund_status, refund_transaction_id, created_at,
      order_items(id, description, price, quantity, returned),
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

const norm = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const words = (t: string) => new Set(norm(t).split(" ").filter((w) => w.length >= 3));

function similarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  wa.forEach((w) => wb.has(w) && shared++);
  return shared / Math.min(wa.size, wb.size);
}

function merchantScore(orderMerchant: string, mailMerchant: string): number {
  const a = norm(orderMerchant);
  const b = norm(mailMerchant);
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 3;
  const shared = [...words(a)].some((w) => words(b).has(w));
  return shared ? 2 : 0;
}

// Marks the matching order items as returned, stores refunded shipping and a
// held-back fee, and — if a refund of exactly the expected amount has
// already arrived from that shop — links it right away.
async function applyReturnToOrderInternal(orderId: string, ex: ExtractedReturn) {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, merchant_name, order_items(id, description, price, quantity, returned)")
    .eq("id", orderId)
    .single();
  if (error) throw error;

  const items = (order.order_items ?? []) as { id: string; description: string; price: number; quantity: number; returned: boolean }[];
  const used = new Set<string>();
  const matchedIds: string[] = [];
  for (const returned of ex.returned_items) {
    let best: { id: string; score: number } | null = null;
    for (const item of items) {
      if (used.has(item.id)) continue;
      const score = similarity(item.description, returned.description);
      if (score >= 0.35 && (!best || score > best.score)) best = { id: item.id, score };
    }
    if (best) {
      used.add(best.id);
      matchedIds.push(best.id);
    }
  }

  if (matchedIds.length > 0) {
    const { error: itemsError } = await supabase.from("order_items").update({ returned: true }).in("id", matchedIds);
    if (itemsError) throw itemsError;
  }

  const shipping = Math.max(0, ex.shipping_refunded ?? 0);
  const fee = Math.max(0, ex.return_fee ?? 0);
  const klarnaCredit = ex.via_klarna && ex.klarna_credit_confirmed && ex.refund_total ? ex.refund_total : null;
  const { error: orderError } = await supabase
    .from("orders")
    .update({
      refunded_shipping: shipping,
      return_fee: fee,
      refund_status: klarnaCredit ? "refunded" : "pending",
      ...(ex.via_klarna ? { payment_method: "klarna" } : {}),
      ...(klarnaCredit ? { credited_amount: klarnaCredit } : {}),
    })
    .eq("id", orderId);
  if (orderError) throw orderError;

  const returnedTotal = items
    .filter((i) => i.returned || matchedIds.includes(i.id))
    .reduce((sum, i) => sum + i.price * i.quantity, 0);
  const expected = Math.max(0, returnedTotal + shipping - fee);

  // Has the money already arrived?
  let linked = false;
  const { data: incoming } = await supabase
    .from("visible_transactions")
    .select("id, amount, counterparty_name, raw_description")
    .gt("amount", 0)
    .eq("is_transfer", false)
    .order("booking_date", { ascending: false })
    .limit(150);
  const { data: taken } = await supabase.from("orders").select("refund_transaction_id").not("refund_transaction_id", "is", null);
  const takenIds = new Set((taken ?? []).map((o) => o.refund_transaction_id));
  const target = ex.refund_total ?? expected;
  const hit = (incoming ?? []).find(
    (tx) =>
      !takenIds.has(tx.id) &&
      Math.abs(Number(tx.amount) - target) < 0.01 &&
      merchantScore(`${tx.counterparty_name ?? ""} ${tx.raw_description ?? ""}`, order.merchant_name) > 0
  );
  if (hit) {
    await supabase.from("orders").update({ refund_transaction_id: hit.id, refund_status: "refunded" }).eq("id", orderId);
    linked = true;
  }

  return {
    orderId,
    merchant: order.merchant_name as string,
    itemsMatched: matchedIds.length,
    itemsInMail: ex.returned_items.length,
    shipping,
    fee,
    expected,
    mailTotal: ex.refund_total,
    linked,
    klarnaCredited: klarnaCredit,
  };
}

// Paste a return confirmation / credit note: finds the order it belongs to
// and fills in the returned items, shipping and fee. When several orders
// could fit, the candidates come back so you can pick one.
export async function processReturnEmail(emailText: string) {
  const extraction = await extractReturnFromEmailText(emailText);

  const supabase = await createClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, merchant_name, order_date, refund_status, order_items(description)")
    .neq("refund_status", "refunded");
  if (error) throw error;

  const scored = (orders ?? [])
    .map((o) => {
      const m = merchantScore(o.merchant_name, extraction.merchant_name);
      const itemHits = extraction.returned_items.filter((r) =>
        ((o.order_items ?? []) as { description: string }[]).some((i) => similarity(i.description, r.description) >= 0.35)
      ).length;
      return { id: o.id as string, merchant_name: o.merchant_name as string, order_date: o.order_date as string | null, score: m > 0 ? m * 10 + itemHits * 3 : 0 };
    })
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { status: "none" as const, extraction, candidates: [] };
  }
  const confident = scored.length === 1 || scored[0].score - scored[1].score >= 3;
  if (confident) {
    const result = await applyReturnToOrderInternal(scored[0].id, extraction);
    return { status: "applied" as const, extraction, candidates: [], result };
  }
  return { status: "choose" as const, extraction, candidates: scored.slice(0, 5) };
}

export async function applyReturnToOrder(orderId: string, extraction: ExtractedReturn) {
  return applyReturnToOrderInternal(orderId, extraction);
}

export async function setOrderPaymentMethod(orderId: string, method: "direct" | "klarna") {
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
