"use server";

import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listAspsps, startAuthorization } from "@/lib/enablebanking/auth";
import { syncBankConnection } from "@/lib/enablebanking/sync";

const CONSENT_DAYS = 90;

async function getSiteUrl() {
  // Prefer the fixed, registered site URL — Vercel's per-deployment hash
  // domains (e.g. finance-xxxxx-timonvanes-projects.vercel.app) are NOT the
  // redirect URI registered with Enable Banking, so deriving this from
  // request headers would break whenever the app is visited via one of
  // those instead of the stable production domain.
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
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

const AUTO_SYNC_STALE_MS = 60 * 60 * 1000; // 1 hour

// Called (via next/server's `after`) when the dashboard loads, so banks stay
// fresh without needing a manual "Sync now" click every time — throttled so
// opening the app repeatedly doesn't burn through the daily API quota.
export async function autoSyncStaleConnections() {
  const supabase = await createClient();
  const staleBefore = new Date(Date.now() - AUTO_SYNC_STALE_MS).toISOString();

  const { data: connections } = await supabase
    .from("bank_connections")
    .select("id, last_synced_at")
    .eq("consent_status", "linked")
    .or(`last_synced_at.is.null,last_synced_at.lt.${staleBefore}`);

  for (const connection of connections ?? []) {
    try {
      await syncBankConnection(supabase, connection.id);
    } catch (err) {
      console.error("auto-sync failed for connection", connection.id, err);
    }
  }
}

// Removes a bank connection — used both for cleaning up a link attempt that
// never completed (stuck on "pending") and for removing a linked bank
// entirely (cascades to its accounts and their transactions).
export async function deleteBankConnection(bankConnectionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bank_connections")
    .delete()
    .eq("id", bankConnectionId);
  if (error) throw error;
}
