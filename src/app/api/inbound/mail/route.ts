import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { processInboundMail } from "@/lib/inbound/process-mail";

// Receives forwarded mails from the inbound-mail provider (Postmark JSON
// format). Protected by a secret in the URL; the mails belong to one user.
export const maxDuration = 60;

function tokenOk(given: string | null) {
  const secret = process.env.INBOUND_MAIL_SECRET;
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function htmlToText(html: string) {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function POST(request: NextRequest) {
  if (!tokenOk(request.nextUrl.searchParams.get("token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Accepts Postmark's JSON and CloudMailin's "JSON (normalized)" format.
  const html: string = payload.HtmlBody ?? payload.html ?? "";
  const text: string = (payload.TextBody ?? payload.plain ?? "").trim() || (html ? htmlToText(html) : "");
  const subject: string = payload.Subject ?? payload.headers?.subject ?? "";
  const from: string = payload.FromFull?.Email ?? payload.From ?? payload.envelope?.from ?? payload.headers?.from ?? "";
  if (!text) return NextResponse.json({ ok: true, skipped: "empty" });

  const admin = createAdminClient();
  let userId = process.env.INBOUND_MAIL_USER_ID ?? null;
  if (!userId) {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    userId = data.users[0]?.id ?? null;
  }
  if (!userId) return NextResponse.json({ error: "No user" }, { status: 500 });

  const messageId: string =
    payload.MessageID ?? payload.headers?.message_id ?? `${payload.Date ?? payload.headers?.date ?? ""}-${subject}`;
  try {
    const result = await processInboundMail(admin, userId, {
      messageId,
      subject,
      from,
      text,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("inbound mail failed", e);
    // 500 makes the provider retry, which is what we want for transient errors.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
