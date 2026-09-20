import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExtractedReturn } from "@/lib/anthropic/extract-return";

const norm = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const words = (t: string) => new Set(norm(t).split(" ").filter((w) => w.length >= 3));

export function similarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  wa.forEach((w) => wb.has(w) && shared++);
  return shared / Math.min(wa.size, wb.size);
}

export function merchantScore(orderMerchant: string, mailMerchant: string): number {
  const a = norm(orderMerchant);
  const b = norm(mailMerchant);
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 3;
  const shared = [...words(a)].some((w) => words(b).has(w));
  return shared ? 2 : 0;
}

export interface ScoredOrder {
  id: string;
  merchant_name: string;
  order_date: string | null;
  score: number;
}

// Orders (not yet refunded) that a return mail could belong to, best first.
// userId is set when running with the service-role client (no RLS).
export async function scoreOrdersForReturn(
  supabase: SupabaseClient,
  extraction: ExtractedReturn,
  userId?: string
): Promise<ScoredOrder[]> {
  let query = supabase
    .from("orders")
    .select("id, merchant_name, order_date, refund_status, order_items(description)")
    .neq("refund_status", "refunded");
  if (userId) query = query.eq("user_id", userId);
  const { data: orders, error } = await query;
  if (error) throw error;

  return (orders ?? [])
    .map((o) => {
      const m = merchantScore(o.merchant_name, extraction.merchant_name);
      const itemHits = extraction.returned_items.filter((r) =>
        ((o.order_items ?? []) as { description: string }[]).some((i) => similarity(i.description, r.description) >= 0.35)
      ).length;
      return {
        id: o.id as string,
        merchant_name: o.merchant_name as string,
        order_date: o.order_date as string | null,
        score: m > 0 ? m * 10 + itemHits * 3 : 0,
      };
    })
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function isConfident(scored: ScoredOrder[]) {
  return scored.length === 1 || (scored.length > 1 && scored[0].score - scored[1].score >= 3);
}

// Marks the matching order items as returned, stores refunded shipping and a
// held-back fee, and — if a refund of exactly the expected amount has
// already arrived from that shop — links it right away.
export async function applyReturnToOrderCore(
  supabase: SupabaseClient,
  orderId: string,
  ex: ExtractedReturn,
  userId?: string
) {
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
  let incomingQuery = supabase
    .from("visible_transactions")
    .select("id, amount, counterparty_name, raw_description")
    .gt("amount", 0)
    .eq("is_transfer", false)
    .order("booking_date", { ascending: false })
    .limit(150);
  let takenQuery = supabase.from("orders").select("refund_transaction_id").not("refund_transaction_id", "is", null);
  if (userId) {
    incomingQuery = incomingQuery.eq("user_id", userId);
    takenQuery = takenQuery.eq("user_id", userId);
  }
  const [{ data: incoming }, { data: taken }] = await Promise.all([incomingQuery, takenQuery]);
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
