"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin, pinMatches } from "@/lib/app-pin";
import { PIN, weakPinReason } from "@/lib/pin-rules";
import { LOCK_OFF_COOKIE } from "@/lib/lock-cookie";

// The 6-digit code that unlocks the app. It is compulsory; Face ID is an extra on top.
// The code lives on the server as a hash, and every guess is counted here, so it cannot
// be tried over and over: five wrong in a row wait five minutes, ten log the person out.

export interface PinResult {
  ok?: boolean;
  error?: string;
  signedOut?: boolean;
}

const WAIT_AFTER = 5;
const SIGN_OUT_AFTER = 10;
const WAIT_MINUTES = 5;

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

async function checkPin(userId: string, pin: string): Promise<PinResult> {
  if (!PIN.test(pin)) return { error: "Een pincode bestaat uit 6 cijfers." };
  const admin = createAdminClient();
  const { data: row } = await admin.from("app_pins").select("pin_hash, failed_attempts, locked_until").eq("user_id", userId).maybeSingle();
  if (!row) return { error: "Er is nog geen pincode ingesteld." };

  const until = row.locked_until ? new Date(row.locked_until as string).getTime() : 0;
  if (until > Date.now()) {
    const minutes = Math.ceil((until - Date.now()) / 60_000);
    return { error: `Te veel foute pogingen. Probeer het over ${minutes} ${minutes === 1 ? "minuut" : "minuten"} opnieuw.` };
  }

  if (pinMatches(pin, row.pin_hash as string)) {
    if ((row.failed_attempts as number) > 0 || row.locked_until) {
      await admin.from("app_pins").update({ failed_attempts: 0, locked_until: null }).eq("user_id", userId);
    }
    return { ok: true };
  }

  const failed = (row.failed_attempts as number) + 1;
  if (failed >= SIGN_OUT_AFTER) {
    await admin.from("app_pins").update({ failed_attempts: 0, locked_until: null }).eq("user_id", userId);
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { error: "Te veel foute pogingen. Je bent uitgelogd.", signedOut: true };
  }
  const waitNow = failed % WAIT_AFTER === 0;
  await admin
    .from("app_pins")
    .update({ failed_attempts: failed, locked_until: waitNow ? new Date(Date.now() + WAIT_MINUTES * 60_000).toISOString() : null })
    .eq("user_id", userId);
  if (waitNow) return { error: `Te veel foute pogingen. Wacht ${WAIT_MINUTES} minuten.` };
  const left = WAIT_AFTER - (failed % WAIT_AFTER);
  return { error: left <= 2 ? `Onjuiste pincode. Nog ${left} ${left === 1 ? "poging" : "pogingen"} voor een wachttijd.` : "Onjuiste pincode." };
}

// Checks the code that unlocks the lock screen.
export async function verifyPin(pin: string): Promise<PinResult> {
  const userId = await currentUserId();
  if (!userId) return { error: "Niet ingelogd." };
  return checkPin(userId, pin);
}

// The first code of a person.
export async function setupPin(pin: string): Promise<PinResult> {
  const userId = await currentUserId();
  if (!userId) return { error: "Niet ingelogd." };
  const weak = weakPinReason(pin);
  if (weak) return { error: weak };
  const admin = createAdminClient();
  const { data: existing } = await admin.from("app_pins").select("user_id").eq("user_id", userId).maybeSingle();
  if (existing) return { error: "Er is al een pincode. Wijzig die bij Account." };
  const { error } = await admin.from("app_pins").insert({ user_id: userId, pin_hash: hashPin(pin) });
  if (error) return { error: "Opslaan van de pincode mislukte. Probeer het opnieuw." };
  return { ok: true };
}

// A new code. The old one must be right, so a phone left unlocked cannot swap it.
export async function changePin(current: string, next: string): Promise<PinResult> {
  const userId = await currentUserId();
  if (!userId) return { error: "Niet ingelogd." };
  const weak = weakPinReason(next);
  if (weak) return { error: weak };
  const checked = await checkPin(userId, current);
  if (!checked.ok) return checked;
  const admin = createAdminClient();
  const { error } = await admin.from("app_pins").update({ pin_hash: hashPin(next), updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) return { error: "Opslaan van de pincode mislukte. Probeer het opnieuw." };
  return { ok: true };
}

// The lock can be switched off on this device. The cookie is set here, on the server, and
// only after the code was right, so a phone left unlocked cannot switch it off. (The name
// lives in src/lib/lock-cookie.ts, because a server actions file can only export functions.)
export async function disableLock(pin: string): Promise<PinResult> {
  const checked = await verifyPin(pin);
  if (!checked.ok) return checked;
  (await cookies()).set(LOCK_OFF_COOKIE, "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return { ok: true };
}

// Switching it on again needs nothing: it only makes the app safer. Without a code yet, the
// app asks for one first.
export async function enableLock(): Promise<PinResult> {
  (await cookies()).delete(LOCK_OFF_COOKIE);
  return { ok: true };
}

// "Forgot the code": logs out. The next full login (password and second step) asks for a
// new code. Whoever lacks the password and the second step gets nowhere.
export async function forgotPin() {
  const userId = await currentUserId();
  if (userId) {
    await createAdminClient().from("app_pins").update({ reset_pending: true }).eq("user_id", userId);
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
