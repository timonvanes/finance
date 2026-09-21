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

  const contentType = request.headers.get("content-type") ?? "";
  let payload: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (contentType.includes("multipart/form-data") || contentType.includes("x-www-form-urlencoded")) {
    // CloudMailin "Multipart - Normalized": fields like headers[subject], plain, html.
    const form = await request.formData().catch(() => null);
    if (form) {
      const field = (name: string) => {
        const v = form.get(name);
        return typeof v === "string" ? v : "";
      };
      payload = {
        plain: field("plain"),
        html: field("html"),
        envelope: { from: field("envelope[from]") },
        headers: {
          subject: field("headers[subject]"),
          from: field("headers[from]"),
          message_id: field("headers[message_id]"),
          date: field("headers[date]"),
        },
      };
    }
  } else {
    payload = await request.json().catch(() => null);
  }
  if (!payload) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Accepts Postmark's JSON and CloudMailin's "JSON (normalized)" format.
  const html: string = payload.HtmlBody ?? payload.html ?? "";
  const text: string = (payload.TextBody ?? payload.plain ?? "").trim() || (html ? htmlToText(html) : "");
  const subject: string = payload.Subject ?? payload.headers?.subject ?? "";
  const from: string = payload.FromFull?.Email ?? payload.From ?? payload.envelope?.from ?? payload.headers?.from ?? "";
  if (!text) return NextResponse.json({ ok: true, skipped: "empty" });

  // The mail belongs to the user whose address forwarded it. Never guess: with
  // several accounts, a wrong guess would put the data in someone else's app.
  const admin = createAdminClient();
  const sender = from.trim().toLowerCase();
  let userId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const owner = (list?.users ?? []).find((u) => u.email?.toLowerCase() === sender);
  if (owner) userId = owner.id;
  else if (process.env.INBOUND_MAIL_USER_ID) userId = process.env.INBOUND_MAIL_USER_ID;
  if (!userId) {
    return NextResponse.json({ ok: true, skipped: "unknown sender" });
  }

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
