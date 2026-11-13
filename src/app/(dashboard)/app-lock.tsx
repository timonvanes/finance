"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { logout } from "@/actions/auth";
import { createBrowserSupabase } from "@/lib/supabase/client";

// After this long in the background the app locks again, like a banking app.
const LOCK_AFTER_MS = 60_000;

// Opening the app shows a lock screen first. One tap on Face ID (a passkey) opens it. The
// person stays logged in, so no password is typed. The screen only appears on devices
// where it was switched on.
export function AppLock({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [locked, setLocked] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hiddenAt = useRef<number | null>(null);

  // Back from the background after a while: lock again.
  useEffect(() => {
    if (!enabled) return;
    const onChange = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else if (hiddenAt.current !== null && Date.now() - hiddenAt.current > LOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [enabled]);

  async function unlock(auto: boolean) {
    setBusy(true);
    setError(null);
    const { error: err } = await createBrowserSupabase().auth.signInWithPasskey();
    setBusy(false);
    if (!err) {
      setLocked(false);
      return;
    }
    // A phone may refuse to ask for Face ID without a tap: then the button does it.
    if (!auto) {
      const m = err.message.toLowerCase();
      setError(/cancel|abort|not allowed|timed out/.test(m) ? "Face ID is geannuleerd. Tik op de knop om het opnieuw te proberen." : "Ontgrendelen lukte niet. Probeer het opnieuw of log in met je wachtwoord.");
    }
  }

  // Ask for Face ID right away when the lock screen appears.
  useEffect(() => {
    if (!locked) return;
    const t = window.setTimeout(() => void unlock(true), 250);
    return () => window.clearTimeout(t);
  }, [locked]);

  return (
    <>
      <div inert={locked} aria-hidden={locked}>
        {children}
      </div>
      {locked && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-teal-700 via-teal-800 to-teal-950 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))] text-white">
          {/* soft light in the corners */}
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-teal-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-emerald-300/15 blur-3xl" />

          <div className="relative z-10 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
              </svg>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Finance</h1>
            <p className="text-sm text-teal-100/80">{busy ? "Even kijken…" : "Vergrendeld"}</p>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6">
            <button
              type="button"
              disabled={busy}
              onClick={() => void unlock(false)}
              aria-label="Ontgrendelen met Face ID"
              className="group relative flex h-36 w-36 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30 backdrop-blur transition active:scale-95"
            >
              {/* a ring that breathes while waiting */}
              <span className={`absolute inset-0 rounded-full ring-2 ring-white/40 ${busy ? "animate-ping" : "animate-pulse"}`} />
              <span className="absolute inset-3 rounded-full bg-white/10" />
              <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="relative" aria-hidden="true">
                <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
                <path d="M9 10v1.5M15 10v1.5M12 10v3h-.6M9 16c1.5 1.5 4.5 1.5 6 0" />
              </svg>
            </button>
            <p className="text-lg font-medium">{busy ? "Wachten op Face ID…" : "Ontgrendel met Face ID"}</p>
            {error && <p className="max-w-xs rounded-2xl bg-white/10 px-4 py-3 text-center text-sm text-teal-50 ring-1 ring-white/20">{error}</p>}
          </div>

          <form action={logout} className="relative z-10">
            <button type="submit" className="min-h-[44px] px-4 text-sm text-teal-100/80 underline decoration-teal-100/40 underline-offset-4">
              Uitloggen en met wachtwoord inloggen
            </button>
          </form>
        </div>
      )}
    </>
  );
}
