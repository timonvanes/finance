import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createSessionWithRetry,
  getAccountDetails,
  type EnableBankingAccountDetails,
} from "@/lib/enablebanking/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const authRef = request.nextUrl.searchParams.get("state");

  const redirectTo = new URL("/settings/bank-connections", request.url);

  if (!code || !authRef) {
    redirectTo.searchParams.set("error", "missing_code_or_state");
    return NextResponse.redirect(redirectTo);
  }

  try {
    const supabase = await createClient();

    // Validate that this authRef is one we generated and is still pending —
    // prevents an attacker from linking an arbitrary Enable Banking session
    // to this account.
    const { data: connection, error: fetchError } = await supabase
      .from("bank_connections")
      .select("id")
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

      const { error: accountsError } = await supabase.from("bank_accounts").insert(
        accountDetails.map((account) => ({
          bank_connection_id: connection.id,
          account_uid: account.uid,
          currency: account.currency ?? null,
          display_name: account.name ?? null,
          iban: account.account_id?.iban ?? null,
        }))
      );
      if (accountsError) {
        console.error("enablebanking callback: accounts insert failed", accountsError);
        redirectTo.searchParams.set(
          "error",
          "accounts_insert_failed: " + accountsError.message
        );
        return NextResponse.redirect(redirectTo);
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
