import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// The app code is kept as a salted scrypt hash. Server-only: the table has no policies,
// so only the service role can reach it.

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

export function pinMatches(pin: string, stored: string): boolean {
  const [saltPart, hashPart] = stored.split(".");
  if (!saltPart || !hashPart) return false;
  const expected = Buffer.from(hashPart, "base64url");
  const actual = scryptSync(pin, Buffer.from(saltPart, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

// Does this person have a code? A pending "forgot the code" is settled here: the person
// got past the full login again, so the old code is removed and a new one is asked for.
export async function pinIsSet(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("app_pins").select("reset_pending").eq("user_id", userId).maybeSingle();
  if (!data) return false;
  if (data.reset_pending) {
    await admin.from("app_pins").delete().eq("user_id", userId);
    return false;
  }
  return true;
}
