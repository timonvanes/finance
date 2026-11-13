"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Two-step login with an authenticator app (Google Authenticator and the like), on top
// of Supabase's own multi-factor support (TOTP).
//
// A flag in the user's server-side data (app_metadata, signed into the login token)
// says "this person must pass the second step". The page check in the proxy reads only
// that signed flag, never anything the browser could have changed.

export interface FactorInfo {
  id: string;
  name: string;
  createdAt: string;
  type: "totp" | "webauthn";
}

export interface MfaResult {
  error?: string;
}

const CODE = /^\d{6}$/;
const cleanCode = (raw: string) => raw.replace(/\s+/g, "");

async function setRequired(userId: string, on: boolean) {
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(userId, { app_metadata: { mfa_required: on } });
}

// The second steps that are really set up (verified): authenticator apps and Face ID / passkeys.
export async function listMfaFactors(): Promise<FactorInfo[]> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return (data?.all ?? [])
    .filter((f) => f.status === "verified" && (f.factor_type === "totp" || f.factor_type === "webauthn"))
    .map((f) => ({
      id: f.id,
      name: f.friendly_name ?? (f.factor_type === "webauthn" ? "Face ID" : "Authenticator"),
      createdAt: f.created_at,
      type: f.factor_type as "totp" | "webauthn",
    }));
}

// Keeps the signed flag in step with what is really set up. Called after a second step
// was added in the browser (Face ID), where the server did not see it happen.
export async function syncMfaFlag(): Promise<MfaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };
  const verified = (user.factors ?? []).some((f) => f.status === "verified");
  await setRequired(user.id, verified);
  revalidatePath("/settings/account");
  return {};
}

// Step 1 of switching on: a secret and a QR code to scan. Nothing is active until the
// first code is confirmed.
export async function startMfaEnrollment(): Promise<{ error: string } | { factorId: string; qr: string; secret: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  // Unfinished attempts from before are removed first.
  const { data: all } = await supabase.auth.mfa.listFactors();
  for (const f of all?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Finance",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
  });
  if (error || !data) {
    const off = error?.message?.toLowerCase().includes("not enabled") || error?.code === "mfa_totp_enroll_not_enabled";
    return {
      error: off
        ? "Tweestapsverificatie staat nog niet aan in Supabase. Zet het aan bij Authentication, Sign In / Providers, Multi-Factor."
        : "Instellen mislukt. Probeer het opnieuw.",
    };
  }
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

// Step 2: the first code from the app proves it works. Only then it counts.
export async function confirmMfaEnrollment(factorId: string, code: string): Promise<MfaResult> {
  const c = cleanCode(code);
  if (!CODE.test(c)) return { error: "Vul de code van zes cijfers in." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: c });
  if (error) return { error: "Deze code klopt niet. Probeer de nieuwe code van de app." };
  await setRequired(user.id, true);
  revalidatePath("/settings/account");
  return {};
}

export async function removeMfaFactor(factorId: string): Promise<MfaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };
  // Supabase only allows this after the second step was passed in this session.
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: "Verwijderen mislukt. Log opnieuw in met je code en probeer het nog eens." };
  const left = await listMfaFactors();
  await setRequired(user.id, left.length > 0);
  revalidatePath("/settings/account");
  return {};
}

// The second step of logging in.
export async function verifyLoginCode(_prev: MfaResult, formData: FormData): Promise<MfaResult> {
  const code = cleanCode(String(formData.get("code") ?? ""));
  if (!CODE.test(code)) return { error: "Vul de code van zes cijfers in." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const factors = (await listMfaFactors()).filter((f) => f.type === "totp");
  let ok = false;
  // More than one app set up: the code can come from any of them.
  for (const f of factors) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code });
    if (!error) {
      ok = true;
      break;
    }
  }
  if (!ok) return { error: "Deze code klopt niet. Gebruik de code die nu in de app staat." };
  redirect("/");
}
