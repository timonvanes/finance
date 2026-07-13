"use server";

import { createClient } from "@/lib/supabase/server";
import { extractOrderFromEmailText } from "@/lib/anthropic/extract-order";

export async function extractOrderPreview(emailText: string) {
  return extractOrderFromEmailText(emailText);
}

export async function createOrder(input: {
  merchantName: string;
  orderDate: string | null;
  totalAmount: number | null;
  sourceText: string;
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
      `id, merchant_name, order_date, total_amount, refund_status, refund_transaction_id, created_at,
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
