"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

interface Passkey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

const date = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

function writeLockCookie(on: boolean) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = on ? `applock=1; Max-Age=31536000; Path=/; SameSite=Lax${secure}` : `applock=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}

// Face ID (a passkey on this phone) as a way to log in instead of typing the password.
export function PasskeySection({ lockOn }: { lockOn: boolean }) {
  const [list, setList] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [lock, setLock] = useState(lockOn);

  // The lock is a choice per device, kept in a cookie the server can read.
  function setLockCookie(on: boolean) {
    writeLockCookie(on);
    setLock(on);
  }

  const toList = (data: { id: string; friendly_name?: string; created_at: string; last_used_at?: string }[] | null): Passkey[] =>
    (data ?? []).map((p) => ({ id: p.id, name: p.friendly_name ?? "Face ID", createdAt: p.created_at, lastUsedAt: p.last_used_at }));

  async function load() {
    const { data, error: err } = await createBrowserSupabase().auth.passkey.list();
    setList(err ? [] : toList(data));
  }

  // The first load: state is set in the callback, when the answer arrives.
  useEffect(() => {
    let stale = false;
    createBrowserSupabase()
      .auth.passkey.list()
      .then(({ data, error: err }) => {
        if (!stale) setList(err ? [] : toList(data));
      });
    return () => {
      stale = true;
    };
  }, []);

  async function add() {
    setBusy(true);
    setError(null);
    setDone(null);
    const supabase = createBrowserSupabase();
    const { error: err } = await supabase.auth.registerPasskey();
    setBusy(false);
    if (err) {
      const m = `${err.message} ${(err as { code?: string }).code ?? ""}`.toLowerCase();
      setError(
        /cancel|abort|not allowed|timed out/.test(m)
          ? "Face ID is geannuleerd of verlopen. Probeer het opnieuw."
          : m.includes("not_enabled") || m.includes("not enabled") || m.includes("disabled")
            ? "Passkeys staan nog niet aan in Supabase. Zet ze aan bij Authentication, Sign In / Providers, Passkey."
            : `Face ID toevoegen mislukte (${err.message}). Controleer in Supabase of het adres van de site bij de passkey-instellingen staat.`
      );
      return;
    }
    setDone("Face ID is toegevoegd. Op het inlogscherm staat nu de knop Inloggen met Face ID.");
    void load();
  }

  async function remove(p: Passkey) {
    if (!window.confirm(`"${p.name}" verwijderen? Je kunt er dan niet meer mee inloggen.`)) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const supabase = createBrowserSupabase();
    const { error: err } = await supabase.auth.passkey.delete({ passkeyId: p.id });
    setBusy(false);
    if (err) {
      setError("Verwijderen mislukt. Probeer het opnieuw.");
      return;
    }
    await load();
    // Without a Face ID left there is nothing to unlock with: the lock goes off.
    if (lock && (list?.length ?? 0) <= 1) setLockCookie(false);
  }

  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-gray-900">Inloggen met Face ID</h2>
          <p className="text-sm text-gray-500">Op dit apparaat inloggen met Face ID of je vingerafdruk, zonder wachtwoord te typen.</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${list && list.length > 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
          {list && list.length > 0 ? "Aan" : "Uit"}
        </span>
      </div>

      {done && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{done}</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {list && list.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-xl bg-gray-50 px-4">
          {list.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0 text-gray-800">
                {p.name}
                <span className="block text-xs text-gray-500">
                  toegevoegd {date(p.createdAt)}
                  {p.lastUsedAt ? ` · laatst gebruikt ${date(p.lastUsedAt)}` : ""}
                </span>
              </span>
              <button type="button" disabled={busy} onClick={() => void remove(p)} className="min-h-[44px] shrink-0 text-red-600 underline disabled:opacity-40">
                Verwijderen
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void add()}
        className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
      >
        {busy ? "Bezig…" : list && list.length > 0 ? "Nog een apparaat toevoegen" : "Face ID instellen"}
      </button>
      {list && list.length > 0 && (
        <label className="flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3">
          <input type="checkbox" checked={lock} onChange={(e) => setLockCookie(e.target.checked)} className="mt-1 h-6 w-6 shrink-0 accent-teal-700" />
          <span className="text-sm text-gray-800">
            Vraag Face ID als ik de app open, op dit apparaat
            <span className="block text-xs text-gray-500">
              Zoals een bankapp: je blijft ingelogd, maar de app is dicht tot je ontgrendelt. Ook na een minuut op de achtergrond.
            </span>
          </span>
        </label>
      )}
      <p className="text-xs text-gray-500">
        Elk apparaat stel je zelf in. Het wachtwoord blijft werken. Face ID werkt alleen op het adres van deze app.
      </p>
    </section>
  );
}
