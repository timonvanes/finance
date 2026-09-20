import type { SupabaseClient } from "@supabase/supabase-js";
import { extractMail, type ExtractedMail } from "@/lib/anthropic/extract-mail";
import type { ExtractedReturn } from "@/lib/anthropic/extract-return";
import { applyReturnToOrderCore, isConfident, scoreOrdersForReturn } from "@/lib/returns/core";

export interface InboundMail {
  messageId: string;
  subject: string;
  from: string;
  text: string;
}

const DEFAULT_WINDOW_DAYS = 14;

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const isIso = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function asReturn(m: ExtractedMail): ExtractedReturn {
  return {
    merchant_name: m.merchant_name,
    order_reference: null,
    returned_items: m.items.map((i) => ({ description: i.description, quantity: i.quantity, amount: i.price * i.quantity })),
    shipping_refunded: m.shipping_refunded,
    return_fee: m.return_fee,
    refund_total: m.refund_total,
    via_klarna: m.via_klarna,
    klarna_credit_confirmed: m.klarna_credit_confirmed,
  } as ExtractedReturn;
}

async function record(
  supabase: SupabaseClient,
  userId: string,
  mail: InboundMail,
  kind: string | null,
  outcome: string
) {
  await supabase.from("inbound_mails").insert({
    user_id: userId,
    message_id: mail.messageId,
    subject: mail.subject.slice(0, 200),
    sender: mail.from.slice(0, 200),
    kind,
    outcome,
    body_excerpt: mail.text.slice(0, 1500),
  });
}

// Runs with the service-role client, so every query is scoped to userId.
export async function processInboundMail(supabase: SupabaseClient, userId: string, mail: InboundMail) {
  const { data: seen } = await supabase
    .from("inbound_mails")
    .select("id")
    .eq("user_id", userId)
    .eq("message_id", mail.messageId)
    .maybeSingle();
  if (seen) return { outcome: "duplicate" };

  const ex = await extractMail(mail);

  if (ex.kind === "order_confirmation") {
    const orderDate = isIso(ex.order_date) ? ex.order_date : new Date().toISOString().slice(0, 10);
    const { data: same } = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("order_date", orderDate)
      .eq("total_amount", ex.total_amount ?? -1)
      .ilike("merchant_name", ex.merchant_name);
    if ((same ?? []).length > 0) {
      await record(supabase, userId, mail, ex.kind, "Bestelling stond er al");
      return { outcome: "exists" };
    }

    const deadline = isIso(ex.return_deadline)
      ? ex.return_deadline
      : ex.return_window_days
        ? addDays(orderDate, ex.return_window_days)
        : null;
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        merchant_name: ex.merchant_name,
        order_date: orderDate,
        total_amount: ex.total_amount,
        source_text: mail.text.slice(0, 20000),
        payment_method: ex.via_klarna ? "klarna" : "direct",
        return_deadline: deadline,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (ex.items.length > 0) {
      const { error: itemsError } = await supabase.from("order_items").insert(
        ex.items.map((i) => ({
          user_id: userId,
          order_id: order.id,
          description: i.description,
          price: i.price,
          quantity: i.quantity,
        }))
      );
      if (itemsError) throw itemsError;
    }
    await record(supabase, userId, mail, ex.kind, `Bestelling toegevoegd: ${ex.merchant_name}`);
    return { outcome: "order_created" };
  }

  if (ex.kind === "delivered") {
    const scored = await scoreOrdersForReturn(supabase, asReturn(ex), userId);
    if (scored.length === 0) {
      await record(supabase, userId, mail, ex.kind, "Bezorgd, maar geen bijbehorende bestelling gevonden");
      return { outcome: "unmatched" };
    }
    const delivered = isIso(ex.delivered_date) ? ex.delivered_date : new Date().toISOString().slice(0, 10);
    const deadline = isIso(ex.return_deadline)
      ? ex.return_deadline
      : addDays(delivered, ex.return_window_days ?? DEFAULT_WINDOW_DAYS);
    await supabase.from("orders").update({ return_deadline: deadline }).eq("id", scored[0].id).eq("user_id", userId);
    await record(supabase, userId, mail, ex.kind, `Retourtermijn bijgewerkt (tot ${deadline})`);
    return { outcome: "deadline_set" };
  }

  if (ex.kind === "return_confirmation") {
    const extraction = asReturn(ex);
    const scored = await scoreOrdersForReturn(supabase, extraction, userId);
    if (isConfident(scored)) {
      const result = await applyReturnToOrderCore(supabase, scored[0].id, extraction, userId);
      await record(
        supabase,
        userId,
        mail,
        ex.kind,
        `Retour verwerkt bij ${result.merchant} (${result.itemsMatched}/${result.itemsInMail} artikelen)`
      );
      return { outcome: "return_applied" };
    }
    await record(
      supabase,
      userId,
      mail,
      ex.kind,
      scored.length === 0
        ? "Retourmail: geen bijbehorende bestelling gevonden. Plak de mail zelf bij Retouren."
        : "Retourmail: meerdere bestellingen passen. Plak de mail zelf bij Retouren."
    );
    return { outcome: "needs_review" };
  }

  await record(supabase, userId, mail, ex.kind, "Genegeerd (geen bestelling of retour)");
  return { outcome: "ignored" };
}
