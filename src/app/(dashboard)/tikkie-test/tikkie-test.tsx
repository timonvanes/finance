"use client";

import { useState } from "react";

type Extra = { key: string; value: string };

// Tries Tikkie links on the phone. Each button opens Tikkie's "create a request" screen with
// the amount and description filled in, plus one extra field. Look at which account Tikkie
// shows for the payout: if it changes to the account you meant, that field works.
export function TikkieTest() {
  const [account, setAccount] = useState("Rabo");
  const [iban, setIban] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [last, setLast] = useState<string | null>(null);

  const presets: { label: string; extra: Extra[] }[] = [
    { label: "Zonder extra veld (zoals nu)", extra: [] },
    { label: "clientId = naam", extra: [{ key: "clientId", value: account }] },
    { label: "account = naam", extra: [{ key: "account", value: account }] },
    { label: "accountName = naam", extra: [{ key: "accountName", value: account }] },
    { label: "bankAccount = naam", extra: [{ key: "bankAccount", value: account }] },
    ...(iban.trim()
      ? [
          { label: "iban = IBAN", extra: [{ key: "iban", value: iban.trim() }] },
          { label: "clientId = IBAN", extra: [{ key: "clientId", value: iban.trim() }] },
          { label: "accountId = IBAN", extra: [{ key: "accountId", value: iban.trim() }] },
        ]
      : []),
  ];

  function build(scheme: "app" | "web", extra: Extra[]) {
    const params = new URLSearchParams();
    params.set("totalAmountInCents", "100");
    params.set("description", "Test " + account);
    for (const e of extra) if (e.key.trim()) params.set(e.key.trim(), e.value);
    const query = params.toString().replace(/\+/g, "%20");
    return scheme === "app" ? `tikkie://payment_request?${query}` : `https://tikkie.me/payment_request?${query}`;
  }

  function open(scheme: "app" | "web", extra: Extra[]) {
    const url = build(scheme, extra);
    setLast(url);
    window.location.href = url;
  }

  const input = "min-h-[48px] w-full rounded-xl border border-gray-300 px-3 text-base";

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Elke knop opent Tikkie voor een testbedrag van €1,00. Je maakt niets aan: kijk alleen welke rekening Tikkie laat zien en ga terug.
        Tikkie kent al de velden bedrag, omschrijving, aantal betalers en <code>clientId</code>. De andere velden zijn gokjes.
      </p>

      <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Naam van de rekening in Tikkie</span>
          <input value={account} onChange={(e) => setAccount(e.target.value)} className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">IBAN van die rekening (optioneel)</span>
          <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="NL00 RABO 0000 0000 00" className={input} />
        </label>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-lg font-semibold text-gray-900">Proberen</h2>
        {presets.map((p) => (
          <div key={p.label} className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-900">{p.label}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => open("app", p.extra)} className="min-h-[48px] rounded-xl bg-teal-700 text-sm font-medium text-white active:bg-teal-800">
                Open (tikkie://)
              </button>
              <button type="button" onClick={() => open("web", p.extra)} className="min-h-[48px] rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900 active:bg-gray-50">
                Open (https)
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        <h2 className="text-base font-medium text-gray-900">Eigen veld proberen</h2>
        <div className="grid grid-cols-2 gap-2">
          <input value={customKey} onChange={(e) => setCustomKey(e.target.value)} placeholder="veldnaam" className={input} autoCapitalize="none" autoCorrect="off" />
          <input value={customValue} onChange={(e) => setCustomValue(e.target.value)} placeholder="waarde" className={input} autoCapitalize="none" autoCorrect="off" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => open("app", [{ key: customKey, value: customValue }])} className="min-h-[48px] rounded-xl bg-teal-700 text-sm font-medium text-white active:bg-teal-800">
            Open (tikkie://)
          </button>
          <button type="button" onClick={() => open("web", [{ key: customKey, value: customValue }])} className="min-h-[48px] rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900 active:bg-gray-50">
            Open (https)
          </button>
        </div>
      </section>

      {last && (
        <p className="break-all rounded-2xl bg-gray-50 p-4 text-xs text-gray-600 ring-1 ring-gray-200">
          Laatst geprobeerd: {last}
        </p>
      )}
    </div>
  );
}
