import type { SupabaseClient } from "@supabase/supabase-js";
import { merchantScore } from "./core";

// Refunds can arrive after the return was already processed (or after a
// manual order was added without a mail) — this catches those against
// still-pending orders whenever new incoming transactions sync in.
export async function autoMatchOrderRefunds(supabase: SupabaseClient, incomingTransactionIds: string[]) {
  if (incomingTransactionIds.length === 0) return;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, amount, counterparty_name, raw_description")
    .in("id", incomingTransactionIds)
    .gt("amount", 0)
    .eq("is_transfer", false);
  if (!transactions || transactions.length === 0) return;

  const { data: orders } = await supabase
    .from("orders")
    .select("id, merchant_name, refunded_shipping, return_fee, order_items(price, quantity, returned)")
    .eq("refund_status", "pending")
    .is("refund_transaction_id", null);
  if (!orders || orders.length === 0) return;

  const { data: taken } = await supabase
    .from("orders")
    .select("refund_transaction_id")
    .not("refund_transaction_id", "is", null);
  const takenIds = new Set((taken ?? []).map((o) => o.refund_transaction_id));

  for (const tx of transactions) {
    if (takenIds.has(tx.id)) continue;
    const candidates = orders.filter((o) => {
      const items = (o.order_items ?? []) as { price: number; quantity: number; returned: boolean }[];
      const returnedTotal = items.filter((i) => i.returned).reduce((sum, i) => sum + i.price * i.quantity, 0);
      const expected = Math.max(0, returnedTotal + (o.refunded_shipping || 0) - (o.return_fee || 0));
      return (
        Math.abs(Number(tx.amount) - expected) < 0.01 &&
        merchantScore(`${tx.counterparty_name ?? ""} ${tx.raw_description ?? ""}`, o.merchant_name) > 0
      );
    });
    if (candidates.length !== 1) continue; // ambiguous or no match — leave for the manual dropdown
    const { error } = await supabase
      .from("orders")
      .update({ refund_transaction_id: tx.id, refund_status: "refunded" })
      .eq("id", candidates[0].id)
      .eq("refund_status", "pending");
    if (!error) takenIds.add(tx.id);
  }
}
