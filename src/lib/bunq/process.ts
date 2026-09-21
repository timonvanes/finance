import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push/send";
import { detectBunqPayments, sweepBunqPayments } from "./links";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

// Everything that follows a bunq payment: spot payments for open links, mark
// the reclaims paid, forward the money, and tell the user. Runs with the
// service-role client so it also works from a webhook or cron, without a
// logged-in session.
export async function processBunqForUser(userId: string) {
  const admin = createAdminClient();

  const { data: openBefore } = await admin
    .from("bunq_payment_links")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "open");
  const openIds = (openBefore ?? []).map((l) => l.id);

  const detection = await detectBunqPayments(userId);

  let newlyPaid: { person_name: string | null; amount: number }[] = [];
  if (openIds.length > 0 && detection.detected > 0) {
    const { data } = await admin
      .from("bunq_payment_links")
      .select("person_name, amount")
      .in("id", openIds)
      .neq("status", "open");
    newlyPaid = (data ?? []).map((l) => ({ person_name: l.person_name, amount: Number(l.amount) }));
  }

  const { data: paid } = await admin
    .from("bunq_payment_links")
    .select("reclaim_id, payment_request_id")
    .eq("user_id", userId)
    .in("status", ["paid", "sweeping", "swept"]);
  const now = new Date().toISOString();
  for (const link of paid ?? []) {
    if (link.reclaim_id) {
      await admin
        .from("reclaims")
        .update({ status: "paid", paid_at: now })
        .eq("id", link.reclaim_id)
        .eq("status", "requested");
    }
    if (link.payment_request_id) {
      await admin
        .from("payment_requests")
        .update({ status: "paid", paid_at: now })
        .eq("id", link.payment_request_id)
        .eq("status", "requested");
      await admin
        .from("reclaims")
        .update({ status: "paid", paid_at: now })
        .eq("payment_request_id", link.payment_request_id)
        .eq("status", "requested");
    }
  }

  const sweep = await sweepBunqPayments(userId);

  if (newlyPaid.length > 0) {
    const total = newlyPaid.reduce((s, p) => s + p.amount, 0);
    const who = newlyPaid.map((p) => p.person_name).filter(Boolean).join(", ");
    await sendPush(userId, "bunq_paid", {
      title: "Betaalverzoek betaald",
      body: `${euro(total)}${who ? ` van ${who}` : ""}${sweep.swept > 0 ? " · doorgestort naar je rekening" : ""}`,
      url: "/terugvorderen",
    });
  }

  return { detected: detection.detected, swept: sweep.swept, error: detection.error ?? sweep.error };
}
