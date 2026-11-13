"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmMfaEnrollment, removeMfaFactor, startMfaEnrollment, syncMfaFlag, type FactorInfo } from "@/actions/mfa";
import { createBrowserSupabase } from "@/lib/supabase/client";

const field = "box-border min-h-[56px] w-full rounded-xl border border-gray-300 bg-white px-3 text-center text-2xl tracking-[0.4em]";
const button = "min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50";

export function MfaSection({ initial }: { initial: FactorInfo[] }) {
  const router = useRouter();
  const [factors, setFactors] = useState(initial);
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    setDone(null);
    const r = await startMfaEnrollment();
    setBusy(false);
    if ("error" in r) setError(r.error);
    else {
      setSetup(r);
      setCode("");
    }
  }

  async function confirm() {
    if (!setup) return;
    setBusy(true);
    setError(null);
    const r = await confirmMfaEnrollment(setup.factorId, code);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setFactors((f) => [...f, { id: setup.factorId, name: "Authenticator", createdAt: new Date().toISOString(), type: "totp" }]);
    setSetup(null);
    setCode("");
    setDone("Tweestapsverificatie staat aan. Bij het volgende inloggen vraagt de app om een code.");
    router.refresh();
  }

  // Face ID (or a fingerprint or security key): the phone itself asks for it, so this
  // runs in the browser. Afterwards the server notes that a second step exists.
  async function addPasskey() {
    setBusy(true);
    setError(null);
    setDone(null);
    const supabase = createBrowserSupabase();
    const stamp = new Date().toISOString().slice(0, 10);
    const { error: err } = await supabase.auth.mfa.webauthn.register({ friendlyName: `Face ID ${stamp}` });
    if (err) {
      setBusy(false);
      const m = `${err.message} ${(err as { code?: string }).code ?? ""}`.toLowerCase();
      setError(
        m.includes("not_enabled") || m.includes("not enabled")
          ? "Face ID als tweede stap staat nog niet aan in Supabase. Zet WebAuthn aan bij Authentication, Sign In / Providers, Multi-Factor."
          : /cancel|abort|not allowed|timed out/.test(m)
            ? "Face ID is geannuleerd of verlopen. Probeer het opnieuw."
            : "Face ID toevoegen mislukte. Probeer het opnieuw, of gebruik de authenticator-app."
      );
      return;
    }
    await syncMfaFlag();
    setBusy(false);
    setDone(
      factors.some((f) => f.type === "totp")
        ? "Face ID is toegevoegd. Bij het inloggen kies je Face ID of je code."
        : "Face ID is toegevoegd. Zet voor de zekerheid ook de authenticator-app aan als reserve."
    );
    router.refresh();
    setFactors((list) => [...list, { id: `new-${stamp}`, name: `Face ID ${stamp}`, createdAt: new Date().toISOString(), type: "webauthn" }]);
  }

  async function remove(f: FactorInfo) {
    if (!window.confirm(factors.length === 1 ? "Tweestapsverificatie helemaal uitzetten?" : "Deze authenticator verwijderen?")) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const r = await removeMfaFactor(f.id);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setFactors((list) => list.filter((x) => x.id !== f.id));
    router.refresh();
  }

  const on = factors.length > 0;

  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-gray-900">Tweestapsverificatie</h2>
          <p className="text-sm text-gray-500">Naast je wachtwoord een code uit een app, zoals Google Authenticator.</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
          {on ? "Aan" : "Uit"}
        </span>
      </div>

      {done && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{done}</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {setup ? (
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
            <li>Open Google Authenticator (of een andere authenticator-app) en kies om een code toe te voegen.</li>
            <li>Scan deze QR-code. Lukt dat niet, typ dan de sleutel hieronder over.</li>
            <li>Vul de code van zes cijfers in die de app nu laat zien.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR-code voor je authenticator-app" className="mx-auto h-48 w-48 rounded-lg bg-white p-2 ring-1 ring-gray-200" />
          <p className="break-all rounded-lg bg-gray-50 px-3 py-2 text-center font-mono text-sm text-gray-800">{setup.secret}</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="000000"
            className={field}
          />
          <button type="button" disabled={busy || code.replace(/\s/g, "").length !== 6} onClick={() => void confirm()} className={button}>
            {busy ? "Bezig…" : "Bevestigen en aanzetten"}
          </button>
          <button type="button" onClick={() => setSetup(null)} className="min-h-[44px] w-full text-sm text-gray-500 underline">
            Annuleren
          </button>
        </div>
      ) : (
        <>
          {on && (
            <ul className="divide-y divide-gray-100 rounded-xl bg-gray-50 px-4">
              {factors.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0 text-gray-800">
                    {f.type === "webauthn" ? "Face ID" : "Authenticator-app"} · {f.name}
                    <span className="block text-xs text-gray-500">toegevoegd {new Date(f.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</span>
                  </span>
                  <button type="button" disabled={busy} onClick={() => void remove(f)} className="min-h-[44px] shrink-0 text-red-600 underline disabled:opacity-40">
                    Verwijderen
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" disabled={busy} onClick={() => void start()} className={button}>
            {busy ? "Bezig…" : factors.some((f) => f.type === "totp") ? "Nog een authenticator toevoegen" : "Authenticator-app instellen"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void addPasskey()}
            className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white text-base font-medium text-gray-900 active:bg-gray-50 disabled:opacity-50"
          >
            {busy ? "Bezig…" : "Face ID toevoegen"}
          </button>
          <p className="text-xs text-gray-500">
            {on
              ? "Heb je zowel Face ID als een authenticator-app, dan mag je bij het inloggen kiezen. Houd altijd een reserve: raak je je telefoon kwijt zonder reserve, dan kan alleen de beheerder van de app de tweede stap voor je uitzetten. Face ID werkt alleen op het adres van deze app."
              : "Dit is een keuze: zet je het aan, dan vraagt de app bij elke nieuwe inlog om een code uit je app."}
          </p>
        </>
      )}
    </section>
  );
}
