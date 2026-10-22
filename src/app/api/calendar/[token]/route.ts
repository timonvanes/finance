import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Calendar subscription (iCalendar feed) with the return deadlines of open
// orders. The unguessable token in the URL is the only credential, so calendar
// apps can subscribe without a login.
const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compactDate = (iso: string) => iso.replaceAll("-", "");

function nextDay(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function fold(line: string) {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 70) parts.push((i === 0 ? "" : " ") + line.slice(i, i + 70));
  return parts.join("\r\n");
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return new NextResponse("Not found", { status: 404 });

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("user_settings")
    .select("user_id")
    .eq("calendar_token", token)
    .maybeSingle();
  if (!settings) return new NextResponse("Not found", { status: 404 });

  const { data: orders } = await admin
    .from("orders")
    .select("id, merchant_name, order_date, return_deadline, channel, order_items(returned)")
    .eq("user_id", settings.user_id)
    .eq("refund_status", "not_returned")
    .eq("return_closed", false)
    .gte("return_deadline", new Date().toISOString().slice(0, 10));

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Finance//Retourtermijnen//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Retourtermijnen",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];

  for (const o of orders ?? []) {
    const items = (o.order_items ?? []) as { returned: boolean }[];
    if (items.length > 0 && items.every((i) => i.returned)) continue;
    const where = o.channel === "physical" ? "winkel" : "online";
    const description = `Laatste dag om te retourneren (${where}${
      o.order_date ? `, besteld op ${o.order_date}` : ""
    }). Is dit niet meer nodig? Zet de bestelling in de app op afgehandeld.`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:return-${o.id}@finance`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(o.return_deadline)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(o.return_deadline))}`,
      fold(`SUMMARY:${escapeText(`Retour ${o.merchant_name}: uiterlijk vandaag`)}`),
      fold(`DESCRIPTION:${escapeText(description)}`),
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Retourtermijn bijna om",
      "TRIGGER:-P2DT15H",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Retourtermijn is morgen om",
      "TRIGGER:-PT15H",
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="retourtermijnen.ics"',
      "Cache-Control": "no-store",
    },
  });
}
