"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

// Logging in with Face ID (a passkey saved on the phone), instead of typing the password.
export function PasskeyLogin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { error: err } = await supabase.auth.signInWithPasskey();
    if (!err) {
      // A full page load, so the server sees the new login.
      window.location.href = "/";
      return;
    }
    setBusy(false);
    const m = err.message.toLowerCase();
    setError(
      /cancel|abort|not allowed|timed out/.test(m)
        ? "Face ID is geannuleerd of verlopen. Probeer het opnieuw."
        : "Inloggen met Face ID lukte niet. Heb je er al een ingesteld? Log dan eerst in met je wachtwoord en voeg het toe bij Instellingen, Account."
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void signIn()}
        className="min-h-[48px] w-full rounded-md bg-white px-3 py-2 text-base font-medium text-gray-900 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? "Wachten op Face ID…" : "Inloggen met Face ID"}
      </button>
    </div>
  );
}
