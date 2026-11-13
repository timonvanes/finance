"use client";

import { useActionState, useState } from "react";
import { verifyLoginCode, type MfaResult } from "@/actions/mfa";
import { createBrowserSupabase } from "@/lib/supabase/client";

// The second step: Face ID (a passkey) and/or the code from an authenticator app,
// whichever the person set up.
export function VerifyForm({ hasTotp, passkeyIds }: { hasTotp: boolean; passkeyIds: string[] }) {
  const [state, action, pending] = useActionState(verifyLoginCode, {} as MfaResult);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function faceId() {
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabase();
    let lastError: string | null = null;
    for (const factorId of passkeyIds) {
      const { error: err } = await supabase.auth.mfa.webauthn.authenticate({ factorId });
      if (!err) {
        // A full page load, so the proxy sees the upgraded login.
        window.location.href = "/";
        return;
      }
      lastError = err.message;
    }
    setBusy(false);
    setError(
      lastError && /cancel|abort|not allowed|timed out/i.test(lastError)
        ? "Face ID is geannuleerd of verlopen. Probeer het opnieuw."
        : hasTotp
          ? "Face ID lukte niet. Gebruik de code uit je authenticator-app."
          : "Face ID lukte niet. Probeer het opnieuw."
    );
  }

  return (
    <div className="space-y-4">
      {(error || state.error) && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error ?? state.error}</p>}

      {passkeyIds.length > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void faceId()}
          className="min-h-[52px] w-full rounded-md bg-gray-900 px-3 text-base font-medium text-white disabled:opacity-50"
        >
          {busy ? "Wachten op Face ID…" : "Bevestigen met Face ID"}
        </button>
      )}

      {hasTotp && (
        <form action={action} className="space-y-3">
          {passkeyIds.length > 0 && <p className="text-center text-xs text-gray-500">of met de code uit je app</p>}
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus={passkeyIds.length === 0}
            placeholder="000000"
            className="min-h-[56px] w-full rounded-md border border-gray-300 px-3 text-center text-2xl tracking-[0.4em]"
          />
          <button
            type="submit"
            disabled={pending}
            className={`min-h-[48px] w-full rounded-md px-3 text-base font-medium disabled:opacity-50 ${
              passkeyIds.length > 0 ? "bg-white text-gray-900 ring-1 ring-gray-300" : "bg-gray-900 text-white"
            }`}
          >
            {pending ? "Controleren…" : "Doorgaan met code"}
          </button>
        </form>
      )}
    </div>
  );
}
