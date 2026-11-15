"use client";

import { useState } from "react";
import { TIKKIE_MAX_DESCRIPTION, tikkieDescription } from "@/lib/tikkie";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

// Moves the monthly deposit from one own account to another with a Tikkie: the Tikkie app
// opens with the amount and description already filled in (the same deeplink as for
// reclaims). The deeplink cannot choose the account the Tikkie pays out to: that is chosen in
// the Tikkie app (the account "Rabo" there). Nothing is sent from here; the person makes the
// Tikkie and pays it.
export function TikkieDeposit({ suggested }: { suggested: number }) {
  const [amount, setAmount] = useState(suggested > 0 ? suggested.toFixed(2).replace(".", ",") : "");
  const [description, setDescription] = useState("Sparen potjes");
  const [error, setError] = useState<string | null>(null);

  function open() {
    const value = Number(amount.replace(",", "."));
    const cents = Math.round(value * 100);
    if (!Number.isFinite(value) || cents < 1) {
      setError("Vul een bedrag in.");
      return;
    }
    setError(null);
    const params = new URLSearchParams();
    params.set("totalAmountInCents", String(cents));
    params.set("description", tikkieDescription(description.trim() || "Sparen potjes"));
    window.location.href = `tikkie://payment_request?${params.toString().replace(/\+/g, "%20")}`;
  }

  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Potjes storten met Tikkie</h2>
        <p className="text-sm text-gray-500">
          Je maakt een Tikkie voor het bedrag en betaalt die zelf vanaf je andere rekening. Zo staat het goede bedrag er altijd en hoef je geen vaste overschrijving te wijzigen.
        </p>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Bedrag{suggested > 0 ? ` (je potjes vragen ${euro(suggested)})` : ""}</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          className="min-h-[48px] w-full rounded-xl border border-gray-300 px-3 text-base"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Omschrijving</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={TIKKIE_MAX_DESCRIPTION} className="min-h-[48px] w-full rounded-xl border border-gray-300 px-3 text-base" />
      </label>
      <button type="button" onClick={open} className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800">
        Open Tikkie
      </button>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-gray-500">
        <li>Kies in Tikkie onderaan bij &quot;Rekening&quot; de rekening Rabo (één tik), maak het verzoek aan en kopieer de link.</li>
        <li>Open de link en kies bij het betalen je andere bank (bijvoorbeeld ING).</li>
        <li>Keur het goed in je bank-app. Het geld komt op de rekening Rabo.</li>
      </ol>
    </section>
  );
}
