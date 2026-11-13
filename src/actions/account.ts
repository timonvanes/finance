"use server";

import { createClient } from "@/lib/supabase/server";

export interface AccountResult {
  ok?: string;
  error?: string;
}

const MIN_PASSWORD = 10;

// Checks the password the person types, without trusting that the session is theirs:
// someone who picked up an unlocked phone should not be able to change it.
async function verifyCurrentPassword(email: string, password: string) {
  if (!password) return false;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

export async function changePassword(_prev: AccountResult, formData: FormData): Promise<AccountResult> {
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const again = String(formData.get("again") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Je bent niet ingelogd." };

  if (next.length < MIN_PASSWORD) return { error: `Kies een wachtwoord van minstens ${MIN_PASSWORD} tekens.` };
  if (next !== again) return { error: "De twee nieuwe wachtwoorden zijn niet gelijk." };
  if (next === current) return { error: "Het nieuwe wachtwoord is hetzelfde als het huidige." };
  if (!(await verifyCurrentPassword(user.email, current))) return { error: "Je huidige wachtwoord klopt niet." };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: "Wijzigen mislukt. Probeer het later opnieuw of kies een sterker wachtwoord." };
  return { ok: "Je wachtwoord is gewijzigd." };
}

export async function changeEmail(_prev: AccountResult, formData: FormData): Promise<AccountResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const current = String(formData.get("current") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Je bent niet ingelogd." };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Dit is geen geldig e-mailadres." };
  if (email === user.email.toLowerCase()) return { error: "Dit is al je e-mailadres." };
  if (!(await verifyCurrentPassword(user.email, current))) return { error: "Je huidige wachtwoord klopt niet." };

  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { error: "Wijzigen mislukt. Misschien gebruikt iemand dit adres al." };
  return {
    ok: "Er is een bevestiging verstuurd. Open de mail in je huidige en in je nieuwe mailbox en bevestig. Pas daarna werkt het nieuwe adres.",
  };
}
