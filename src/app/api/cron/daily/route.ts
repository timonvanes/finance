import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoSyncStaleConnections } from "@/actions/bank-connections";
import { ensureBunqCallback, isBunqConfigured } from "@/lib/bunq/client";
import { processBunqForUser } from "@/lib/bunq/process";
import { sendPush } from "@/lib/push/send";

export const maxDuration = 60;

const REMIND_AT_DAYS = new Set([3, 1, 0]);

// One daily run (Vercel Cron): keeps the database awake, reminds about return
// deadlines, does one background bank sync (which reports new transactions),
// and catches any bunq payment the instant callback may have missed.
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const report: Record<string, unknown> = {};

  const { error: pingError } = await admin.from("bank_connections").select("id").limit(1);
  report.ping = pingError ? pingError.message : "ok";

  try {
    const { data: orders } = await admin
      .from("orders")
      .select("id, user_id, merchant_name, return_deadline, order_items(returned)")
      .eq("refund_status", "not_returned")
      .not("return_deadline", "is", null);

    const today = new Date().toISOString().slice(0, 10);
    const perUser = new Map<string, string[]>();
    for (const o of orders ?? []) {
      const items = (o.order_items ?? []) as { returned: boolean }[];
      if (items.length > 0 && items.every((i) => i.returned)) continue;
      const days = Math.round((Date.parse(o.return_deadline) - Date.parse(today)) / 86_400_000);
      if (!REMIND_AT_DAYS.has(days)) continue;
      const label = days === 0 ? "vandaag" : days === 1 ? "morgen" : `over ${days} dagen`;
      perUser.set(o.user_id, [...(perUser.get(o.user_id) ?? []), `${o.merchant_name} (${label})`]);
    }
    for (const [userId, lines] of perUser) {
      await sendPush(userId, "deadline", {
        title: "Retourtermijn bijna om",
        body: `Laatste dag om terug te sturen: ${lines.join(", ")}`,
        url: "/returns",
      });
    }
    report.deadlineReminders = perUser.size;
  } catch (e) {
    report.deadlineReminders = e instanceof Error ? e.message : "failed";
  }

  try {
    const today1 = new Date();
    if (today1.getDate() === 1) {
      const { data: balanceUsers } = await admin.from("wbw_balances").select("user_id");
      const { data: allUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const withBalances = new Set((balanceUsers ?? []).map((b) => b.user_id));
      for (const u of allUsers?.users ?? []) {
        if (!withBalances.has(u.id)) continue; // only nudge users who use this feature
        await sendPush(u.id, "wbw_reminder", {
          title: "WieBetaaltWat invullen",
          body: "Vul het saldo van deze maand in bij Terugvorderen, dan klopt je overzicht weer.",
          url: "/terugvorderen",
        });
      }
      report.wbwReminders = withBalances.size;
    }
  } catch (e) {
    report.wbwReminders = e instanceof Error ? e.message : "failed";
  }

  try {
    const { data: parts } = await admin
      .from("debt_parts")
      .select("user_id, name, rate_fixed_until, is_gift, debts(name)")
      .not("rate_fixed_until", "is", null);
    const today0 = new Date().toISOString().slice(0, 10);
    let sent = 0;
    for (const p of parts ?? []) {
      if (p.is_gift) continue;
      const days = Math.round((Date.parse(p.rate_fixed_until) - Date.parse(today0)) / 86_400_000);
      if (days !== 30 && days !== 7) continue;
      const debt = Array.isArray(p.debts) ? p.debts[0] : p.debts;
      await sendPush(p.user_id, "debt_rate", {
        title: "Rente wordt opnieuw vastgezet",
        body: `${debt?.name ?? "Lening"} · ${p.name}: de rentevaste periode eindigt over ${days} dagen. Vul de nieuwe rente in zodra je die weet.`,
        url: "/settings/schulden",
      });
      sent++;
    }
    report.debtRateReminders = sent;
  } catch (e) {
    report.debtRateReminders = e instanceof Error ? e.message : "failed";
  }

  try {
    await autoSyncStaleConnections();
    report.bankSync = "ok";
  } catch (e) {
    report.bankSync = e instanceof Error ? e.message : "failed";
  }

  if (isBunqConfigured()) {
    try {
      let userId = process.env.INBOUND_MAIL_USER_ID ?? null;
      if (!userId) {
        const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
        userId = data.users[0]?.id ?? null;
      }
      if (userId) {
        await ensureBunqCallback(userId);
        report.bunq = await processBunqForUser(userId);
      }
    } catch (e) {
      report.bunq = e instanceof Error ? e.message : "failed";
    }
  }

  return NextResponse.json({ ok: true, ...report });
}
