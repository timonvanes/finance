"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const STORAGE_KEY = "payment-request-settings";

interface Settings {
  iban: string;
  holder: string;
  link: string;
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { iban: "", holder: "", link: "", ...JSON.parse(raw) };
  } catch {}
  return { iban: "", holder: "", link: "" };
}

// bunq.me and paypal.me links accept an amount in the URL; anything else is sent as-is.
function buildLink(base: string, amount: number, note: string): string | null {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const url = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  const value = amount.toFixed(2);
  if (/bunq\.me/i.test(url)) return `${url}/${value}/${encodeURIComponent(note)}`;
  if (/paypal\.me/i.test(url)) return `${url}/${value}EUR`;
  return url;
}

export function RequestShare({
  personName,
  amount,
  referenceCode,
  description,
  proofHref,
}: {
  personName: string;
  amount: number;
  referenceCode: string | null;
  description: string;
  proofHref: string;
}) {
  const [settings, setSettings] = useState<Settings>({ iban: "", holder: "", link: "" });
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setSettings(load());
  }, []);

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  function message() {
    const link = buildLink(settings.link, amount, referenceCode ? `${description} ${referenceCode}` : description);
    const lines = [`Hoi ${personName}, ik heb ${euro(amount)} voor je voorgeschoten (${description}).`];
    if (link) {
      lines.push(`Je kunt het hier betalen: ${link}`);
    } else if (settings.iban.trim()) {
      lines.push(
        `Wil je het overmaken naar ${settings.iban.trim()}${settings.holder.trim() ? ` t.n.v. ${settings.holder.trim()}` : ""}?`
      );
    } else {
      lines.push("Wil je het naar me overmaken?");
    }
    if (referenceCode) lines.push(`Zet "${referenceCode}" erbij in de omschrijving.`);
    return lines.join("\n");
  }

  async function share() {
    const text = message();
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setNotice("Bericht gekopieerd. Plak het in WhatsApp of een mail.");
    } catch {
      // share sheet dismissed
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={share}
          className="min-h-[52px] flex-1 rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800"
        >
          Vraag terug
        </button>
        <Link
          href={proofHref}
          className="flex min-h-[52px] flex-1 items-center justify-center rounded-xl border border-gray-300 text-base font-medium text-gray-900 active:bg-gray-50"
        >
          Overzicht / bewijs
        </Link>
      </div>
      {notice && <p className="text-sm text-teal-700">{notice}</p>}
      <button
        type="button"
        onClick={() => setShowSettings((v) => !v)}
        className="min-h-[44px] text-sm text-gray-500 underline"
      >
        {showSettings ? "Verberg mijn betaalgegevens" : "Mijn betaalgegevens instellen"}
      </button>
      {showSettings && (
        <div className="space-y-2 rounded-xl bg-gray-50 p-4">
          <p className="text-sm text-gray-500">
            Tikkie laat zich niet automatisch invullen door andere apps. Met een eigen betaallink (bijv.
            bunq.me/jouwnaam of paypal.me/jouwnaam) staat het bedrag er wel al in. Anders wordt je IBAN in het
            bericht gezet. Dit blijft op dit apparaat.
          </p>
          <input
            value={settings.link}
            onChange={(e) => update({ link: e.target.value })}
            placeholder="Betaallink, bijv. bunq.me/jouwnaam"
            className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
          />
          <input
            value={settings.iban}
            onChange={(e) => update({ iban: e.target.value })}
            placeholder="Jouw IBAN"
            className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
          />
          <input
            value={settings.holder}
            onChange={(e) => update({ holder: e.target.value })}
            placeholder="Naam op de rekening"
            className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
          />
        </div>
      )}
    </div>
  );
}
