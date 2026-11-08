import { NextRequest, NextResponse } from "next/server";
import { processBunqForUser } from "@/lib/bunq/process";
import { secretOk } from "@/lib/security/secret";
import { ownerUserId } from "@/lib/owner";

// bunq calls this after every mutation on the account. The payload is never
// trusted: it is only a signal to go and ask bunq what actually happened.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!secretOk(request, "BUNQ_CALLBACK_SECRET", "INBOUND_MAIL_SECRET")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await ownerUserId();
  if (!userId) return NextResponse.json({ ok: true, skipped: "no user" });

  const result = await processBunqForUser(userId);
  return NextResponse.json({ ok: true, ...result });
}
