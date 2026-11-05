import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

// Checks a shared secret on an incoming request. A header is preferred because
// addresses end up in logs; the query parameter stays for senders that cannot set
// headers (an inbound-mail provider, bunq). Comparison takes the same time
// whatever is sent.
export function secretOk(request: NextRequest, ...envNames: string[]) {
  const given = request.headers.get("x-webhook-secret") ?? request.nextUrl.searchParams.get("token");
  if (!given) return false;
  const a = Buffer.from(given);
  return envNames.some((name) => {
    const secret = process.env[name];
    if (!secret) return false;
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

// The secret the bunq callback address carries: its own when one is set, so it is
// not the same one that protects incoming mail.
export const bunqCallbackSecret = () => process.env.BUNQ_CALLBACK_SECRET ?? process.env.INBOUND_MAIL_SECRET ?? null;
