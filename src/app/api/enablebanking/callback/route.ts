import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSessionWithRetry,
  getAccountDetails,
  type EnableBankingAccountDetails,
} from "@/lib/enablebanking/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const authRef = request.nextUrl.searchParams.get("state");
  // Enable Banking sends these instead of code/state when the user cancels
  // or declines consent at the bank — surfacing them beats our old generic
  // "missing_code_or_state", which hid the actual reason.
  const providerError = request.nextUrl.searchParams.get("error");
  const providerErrorDescription = request.nextUrl.searchParams.get("error_description");

  const redirectTo = new URL("/settings/bank-connections", request.url);

  if (providerError) {
    console.error(
      "enablebanking callback: provider returned an error",
      providerError,
      providerErrorDescription
    );
    redirectTo.searchParams.set(
      "error",
      `${providerError}${providerErrorDescription ? ": " + providerErrorDescription : ""}`.slice(0, 300)
    );
    return NextResponse.redirect(redirectTo);
  }

  if (!code || !authRef) {
    // Log every param that *did* arrive — next time this happens we won't
    // have to guess what Enable Banking actually sent.
    console.error(
      "enablebanking callback: missing code/state, full query was:",
      request.nextUrl.search
    );
    redirectTo.searchParams.set("error", "missing_code_or_state");
    return NextResponse.redirect(redirectTo);
  }

  try {
    // Admin (service-role) client rather than the cookie-based one: this
    // request is a top-level redirect back from the bank's own site, so the
    // browser's Supabase session cookie may be mid-refresh or momentarily
    // invalid at this exact moment — that previously made the whole linking
    // result silently vanish. The auth_ref check below (a random, unguessable
    // per-authorization token) is what actually secures this endpoint, not
    // the visiting browser's session.
    const supabase = createAdminClient();

    // Validate that this authRef is one we generated and is still pending —
    // prevents an attacker from linking an arbitrary Enable Banking session
    // to this account.
    const { data: connection, error: fetchError } = await supabase
      .from("bank_connections")
      .select("id, user_id")
      .eq("auth_ref", authRef)
      .eq("consent_status", "pending")
      .single();

    if (fetchError || !connection) {
      console.error("enablebanking callback: unknown auth_ref", fetchError);
      redirectTo.searchParams.set("error", "unknown_auth_ref");
      return NextResponse.redirect(redirectTo);
    }

    const session = await createSessionWithRetry(code);

    const { error: updateError } = await supabase
      .from("bank_connections")
      .update({
        session_id: session.session_id,
        consent_status: "linked",
        consent_expires_at: session.access.valid_until,
      })
      .eq("id", connection.id);

    if (updateError) {
      console.error("enablebanking callback: update failed", updateError);
      redirectTo.searchParams.set("error", "update_failed: " + updateError.message);
      return NextResponse.redirect(redirectTo);
    }

    if (session.accounts.length > 0) {
      // Each entry is usually just a UID string (name/currency/IBAN then
      // come from a separate per-account details call) — but has sometimes
      // arrived as a full account object already. Handle both: treating an
      // object as a bare UID built a malformed details URL that failed
      // silently and corrupted account_uid with the whole object.
      const accountDetails: EnableBankingAccountDetails[] = await Promise.all(
        session.accounts.map(async (entry): Promise<EnableBankingAccountDetails> => {
          if (typeof entry === "string") {
            return getAccountDetails(entry).catch((err) => {
              console.error(`enablebanking callback: details fetch failed for ${entry}`, err);
              return { uid: entry };
            });
          }
          return entry;
        })
      );

      // On a re-authorization (e.g. after consent expiry) this connection
      // may already have bank_accounts rows with transaction history,
      // categorization, reclaims etc. attached — Enable Banking mints a new
      // account_uid per session, so match returning accounts by IBAN and
      // update the existing row in place instead of inserting a duplicate,
      // which would silently orphan all of that history from the "new"
      // account going forward.
      const { data: existingAccounts, error: existingError } = await supabase
        .from("bank_accounts")
        .select("id, iban")
        .eq("bank_connection_id", connection.id);
      if (existingError) {
        console.error("enablebanking callback: existing accounts lookup failed", existingError);
        redirectTo.searchParams.set(
          "error",
          "existing_accounts_lookup_failed: " + existingError.message
        );
        return NextResponse.redirect(redirectTo);
      }
      const existingByIban = new Map(
        (existingAccounts ?? []).filter((a) => a.iban).map((a) => [a.iban, a])
      );

      for (const account of accountDetails) {
        const iban = account.account_id?.iban ?? null;
        const existing = iban ? existingByIban.get(iban) : undefined;

        const { error: accountError } = existing
          ? await supabase
              .from("bank_accounts")
              .update({
                account_uid: account.uid,
                currency: account.currency ?? null,
                display_name: account.name ?? null,
              })
              .eq("id", existing.id)
          : await supabase.from("bank_accounts").insert({
              user_id: connection.user_id,
              bank_connection_id: connection.id,
              account_uid: account.uid,
              currency: account.currency ?? null,
              display_name: account.name ?? null,
              iban,
            });
        if (accountError) {
          console.error("enablebanking callback: account upsert failed", accountError);
          redirectTo.searchParams.set(
            "error",
            "accounts_insert_failed: " + accountError.message
          );
          return NextResponse.redirect(redirectTo);
        }
      }
    } else {
      // The bank authorized the session but granted access to zero
      // accounts — likely an account-selection step was skipped at the
      // bank's own consent screen. Surface this instead of silently
      // showing "linked" with nothing to sync.
      redirectTo.searchParams.set("warning", "no_accounts");
    }

    redirectTo.searchParams.set("linked", "1");
    return NextResponse.redirect(redirectTo);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("enablebanking callback: unhandled error", err);
    redirectTo.searchParams.set("error", message.slice(0, 300));
    return NextResponse.redirect(redirectTo);
  }
}
