"use server";

import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listAspsps, startAuthorization } from "@/lib/enablebanking/auth";
import { syncBankConnection } from "@/lib/enablebanking/sync";

const CONSENT_DAYS = 90;

async function getSiteUrl() {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

export async function getAvailableBanks() {
  return listAspsps("NL");
}

export async function startBankLink(formData: FormData) {
  const aspspName = formData.get("aspspName") as string;
  const aspspCountry = (formData.get("aspspCountry") as string) || "NL";

  const supabase = await createClient();
  const authRef = randomUUID();
  const validUntil = new Date(
    Date.now() + CONSENT_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: insertError } = await supabase.from("bank_connections").insert({
    institution_name: aspspName,
    institution_country: aspspCountry,
    auth_ref: authRef,
    consent_status: "pending",
    consent_expires_at: validUntil,
  });
  if (insertError) throw insertError;

  const siteUrl = await getSiteUrl();
  const { url } = await startAuthorization({
    aspspName,
    aspspCountry,
    authRef,
    redirectUrl: `${siteUrl}/api/enablebanking/callback`,
    validUntil,
  });

  redirect(url);
}

export async function syncNow(bankConnectionId: string) {
  const supabase = await createClient();
  const count = await syncBankConnection(supabase, bankConnectionId);
  return count;
}
