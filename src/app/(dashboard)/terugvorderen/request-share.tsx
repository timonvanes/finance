"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { checkBunqPayments, createBunqPaymentLink, testBunqConnection } from "@/actions/bunq";

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
  kind,
  id,
  bunqEnabled,
  bunqLink,
}: {
  personName: string;
  amount: number;
  referenceCode: string | null;
  description: string;
  proofHref: string;
  kind: "reclaim" | "request";
  id: string;
  bunqEnabled: boolean;
  bunqLink: { url: string; amount: number; status: string } | null;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({ iban: "", holder: "", link: "" });
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [desc, setDesc] = useState(description);
  const [bunqUrl, setBunqUrl] = useState<string | null>(
    bunqLink && Math.abs(bunqLink.amount - amount) < 0.005 ? bunqLink.url : null
  );

  async function makeLink() {
    setBusy(true);
    setNotice(null);
    try {
      const r = await createBunqPaymentLink(kind, id, desc.trim() || description);
      setBunqUrl(r.url);
      router.refresh();
      // Straight into WhatsApp with the finished message; a share sheet would
      // be rejected here because the tap's permission expires during the request.
      window.location.href = `https://wa.me/?text=${encodeURIComponent(message(r.url))}`;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Betaallink maken mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function checkPayment() {
    setBusy(true);
    setNotice(null);
    try {
      const r = await checkBunqPayments();
      if (r.error) setNotice(r.error);
      else if (r.detected > 0) router.refresh();
      else setNotice("Nog geen betaling ontvangen bij bunq.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Controleren mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function testBunq() {
    setBusy(true);
    const r = await testBunqConnection();
    setNotice(r.message);
    setBusy(false);
  }

  useEffect(() => {
    setSettings(load());
  }, []);

  // Opening the page with an unpaid bunq link quietly checks for the payment.
  useEffect(() => {
    if (bunqLink?.status !== "open") return;
    checkBunqPayments()
      .then((r) => {
        if (r.detected > 0) router.refresh();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  function message(linkOverride?: string) {
    const text = desc.trim() || description;
    const link =
      linkOverride ?? bunqUrl ?? buildLink(settings.link, amount, referenceCode ? `${text} ${referenceCode}` : text);
    if (link) return `${text}
${link}`;
    const lines = [`${text} (${euro(amount)})`];
    if (settings.iban.trim()) {
      lines.push(
        `Maak het over naar ${settings.iban.trim()}${settings.holder.trim() ? ` t.n.v. ${settings.holder.trim()}` : ""}.`
      );
    }
    if (referenceCode) lines.push(`Zet "${referenceCode}" erbij in de omschrijving.`);
    return lines.join("
");
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
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        disabled={Boolean(bunqUrl)}
        placeholder="Omschrijving voor het bericht"
        className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base disabled:bg-gray-50 disabled:text-gray-500"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={bunqEnabled && !bunqUrl ? makeLink : share}
          className="min-h-[52px] flex-1 rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
        >
          {busy ? "Bezig…" : bunqEnabled && !bunqUrl ? "Maak link en stuur via WhatsApp" : "Vraag terug"}
        </button>
        <Link
          href={proofHref}
          className="flex min-h-[52px] flex-1 items-center justify-center rounded-xl border border-gray-300 text-base font-medium text-gray-900 active:bg-gray-50"
        >
          Overzicht / bewijs
        </Link>
      </div>
      {bunqUrl && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
          <span>
            {bunqLink?.status === "paid"
              ? "Betaald via bunq. Het bedrag staat op je bunq-rekening."
              : "Betaallink klaar. Wacht op betaling via bunq."}
          </span>
          {bunqLink?.status !== "paid" && (
            <button
              type="button"
              disabled={busy}
              onClick={checkPayment}
              className="min-h-[44px] shrink-0 font-medium underline disabled:opacity-50"
            >
              Controleer
            </button>
          )}
        </div>
      )}
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
          {bunqEnabled && (
            <button
              type="button"
              disabled={busy}
              onClick={testBunq}
              className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 disabled:opacity-50"
            >
              Test bunq-koppeling
            </button>
          )}
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
