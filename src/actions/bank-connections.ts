"use server";

import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    auth_started_at: new Date().toISOString(),
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

// Re-runs the Enable Banking consent flow for an EXISTING connection (e.g.
// one whose consent_status is "expired") instead of deleting it and starting
// over. Deleting cascades to bank_accounts -> transactions -> everything
// built on top (categorization, reclaims, pot matches) — reusing the same
// connection row keeps all of that intact. The callback route matches the
// accounts that come back by IBAN against the existing bank_accounts rows
// for this connection, so it updates rather than duplicates them.
export async function reauthorizeBankLink(formData: FormData) {
  const bankConnectionId = formData.get("bankConnectionId") as string;

  const supabase = await createClient();
  const { data: connection, error: fetchError } = await supabase
    .from("bank_connections")
    .select("institution_name, institution_country")
    .eq("id", bankConnectionId)
    .single();
  if (fetchError) throw fetchError;

  const authRef = randomUUID();
  const validUntil = new Date(
    Date.now() + CONSENT_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: updateError } = await supabase
    .from("bank_connections")
    .update({
      auth_ref: authRef,
      session_id: null,
      consent_status: "pending",
      consent_expires_at: validUntil,
      auth_started_at: new Date().toISOString(),
    })
    .eq("id", bankConnectionId);
  if (updateError) throw updateError;

  const siteUrl = await getSiteUrl();
  const { url } = await startAuthorization({
    aspspName: connection.institution_name,
    aspspCountry: connection.institution_country,
    authRef,
    redirectUrl: `${siteUrl}/api/enablebanking/callback`,
    validUntil,
  });

  redirect(url);
}

// Returns a result object rather than throwing — an uncaught error here
// (e.g. an expired Enable Banking session) surfaced to the user as a
// generic "page couldn't load" crash instead of a readable message.
export async function syncNow(bankConnectionId: string) {
  const supabase = await createClient();
  try {
    const count = await syncBankConnection(supabase, bankConnectionId);
    return { count, error: null as string | null };
  } catch (err) {
    console.error("syncNow failed for connection", bankConnectionId, err);
    return { count: 0, error: err instanceof Error ? err.message : "Sync mislukt" };
  }
}

// null clears the override, falling back to the default 90-day lookback.
export async function updateSyncFromDate(bankConnectionId: string, date: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bank_connections")
    .update({ sync_from_date: date })
    .eq("id", bankConnectionId);
  if (error) throw error;
}

const AUTO_SYNC_STALE_MS = 60 * 60 * 1000; // 1 hour

// Called (via next/server's `after`) when the dashboard loads, so banks stay
// fresh without needing a manual "Sync now" click every time — throttled so
// opening the app repeatedly doesn't burn through the daily API quota.
//
// Uses the admin client rather than the cookie-based one: after() runs once
// the response has already been sent, and Next.js doesn't allow reading
// cookies() at that point — this crashed the callback on every single page
// load. Bypassing RLS here is intentional: this scans stale connections for
// ALL users in one background pass, not just the current session's user.
// Since there's no auth.uid() session context on this client, syncBankConnection
// must stamp user_id explicitly on every insert it makes (transactions, pot_entries).
export async function autoSyncStaleConnections() {
  const supabase = createAdminClient();
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
