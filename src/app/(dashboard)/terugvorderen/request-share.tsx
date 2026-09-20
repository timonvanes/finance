"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { checkBunqPayments, createBunqPaymentLink } from "@/actions/bunq";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export function RequestShare({
  amount,
  referenceCode,
  description,
  proofHref,
  kind,
  id,
  bunqEnabled,
  bunqLink,
}: {
  personName?: string;
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
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [desc, setDesc] = useState(description);
  const [bunqUrl, setBunqUrl] = useState<string | null>(
    bunqLink && Math.abs(bunqLink.amount - amount) < 0.005 ? bunqLink.url : null
  );

  function message(link?: string | null) {
    const text = desc.trim() || description;
    if (link) return [text, link].join("\n");
    const lines = [`${text} (${euro(amount)})`];
    if (referenceCode) lines.push(`Zet "${referenceCode}" erbij in de omschrijving.`);
    return lines.join("\n");
  }

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

  async function share() {
    const text = message(bunqUrl);
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
          {busy ? "Bezig…" : bunqEnabled && !bunqUrl ? "Maak betaalverzoek" : "Vraag terug"}
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
    </div>
  );
}
