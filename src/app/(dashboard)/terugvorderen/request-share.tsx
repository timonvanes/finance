"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { checkBunqPayments, createBunqPaymentLink } from "@/actions/bunq";
import { updatePaymentRequestNote } from "@/actions/payment-requests";
import { updateReclaimNote } from "@/actions/reclaims";
import { extractTikkieUrl, markTikkieReminded, saveTikkieUrl } from "@/actions/tikkie";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export function RequestShare({
  amount,
  referenceCode,
  description,
  note,
  proofHref,
  kind,
  id,
  bunqEnabled,
  bunqLink,
  tikkieUrl,
  remindedAt,
}: {
  personName?: string;
  amount: number;
  referenceCode: string | null;
  description: string;
  note?: string | null;
  proofHref: string;
  kind: "reclaim" | "request";
  id: string;
  bunqEnabled: boolean;
  bunqLink: { url: string; amount: number; status: string } | null;
  tikkieUrl: string | null;
  remindedAt: string | null;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // What you typed is kept (as the note) so it is still there next time;
  // the transaction description is only the starting point.
  const [desc, setDesc] = useState(note?.trim() || description);
  const [savedNote, setSavedNote] = useState(note?.trim() ?? "");
  const [tikkie, setTikkie] = useState<string | null>(tikkieUrl);
  const [reminded, setReminded] = useState<string | null>(remindedAt);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
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

  async function saveNote() {
    const v = desc.trim();
    const toSave = v === description.trim() ? "" : v;
    if (toSave === savedNote) return;
    try {
      if (kind === "reclaim") await updateReclaimNote(id, toSave);
      else await updatePaymentRequestNote(id, toSave);
      setSavedNote(toSave);
    } catch {
      // not critical: the text stays in the field
    }
  }

  // Tikkie's payment_request deeplink (found in the app itself) opens the
  // create screen with the amount (in cents) and description filled in. The
  // description is what you typed, with the reference code in brackets.
  function openTikkie() {
    void saveNote();
    const base = (desc.trim() || description).trim();
    const text = referenceCode ? `${base} (${referenceCode})` : base;
    const params = new URLSearchParams();
    const cents = Math.round(amount * 100);
    if (cents > 0) params.set("totalAmountInCents", String(cents));
    params.set("description", text);
    window.location.href = `tikkie://payment_request?${params.toString().replace(/\+/g, "%20")}`;
  }

  async function keepTikkie(text: string) {
    const r = await saveTikkieUrl(kind, id, text);
    if (r.error) {
      setNotice(r.error);
      return false;
    }
    setTikkie(r.url ?? null);
    setReminded(null);
    setPasteOpen(false);
    setPasted("");
    setNotice(null);
    return true;
  }

  // Reads the link just copied in the Tikkie app; when the phone does not allow
  // that, a field to paste it into opens instead.
  async function pasteTikkie() {
    setNotice(null);
    try {
      const text = await navigator.clipboard.readText();
      if (await extractTikkieUrl(text)) {
        await keepTikkie(text);
        return;
      }
      setNotice("Op het klembord staat geen Tikkie-link. Kopieer eerst de link in Tikkie.");
    } catch {
      setPasteOpen(true);
    }
  }

  // A friendly nudge with the Tikkie link, through the share sheet (WhatsApp etc.).
  async function remind() {
    if (!tikkie) return;
    const text = `Hoi! Een kleine herinnering: ${(desc.trim() || description).trim()} (${euro(amount)}) staat nog open. Je kunt het hier betalen:
${tikkie}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setNotice("Herinnering gekopieerd. Plak hem in WhatsApp of een mail.");
      }
    } catch {
      return; // share sheet dismissed: not sent
    }
    const r = await markTikkieReminded(kind, id);
    if (r.at) setReminded(r.at);
  }

  async function makeLink() {
    setBusy(true);
    setNotice(null);
    try {
      const r = await createBunqPaymentLink(kind, id, desc.trim() || description);
      if ("error" in r) {
        setNotice(r.error);
        return;
      }
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
        onBlur={saveNote}
        disabled={Boolean(bunqUrl)}
        placeholder="Omschrijving voor het bericht"
        className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base disabled:bg-gray-50 disabled:text-gray-500"
      />
      <div className="flex gap-2">
        {bunqEnabled ? (
          <button
            type="button"
            disabled={busy}
            onClick={bunqUrl ? share : makeLink}
            className="min-h-[52px] flex-1 rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
          >
            {busy ? "Bezig…" : bunqUrl ? "Vraag terug" : "Maak betaalverzoek"}
          </button>
        ) : (
          <button
            type="button"
            onClick={openTikkie}
            className="min-h-[52px] flex-1 rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800"
          >
            Maak Tikkie aan
          </button>
        )}
        <Link
          href={proofHref}
          className="flex min-h-[52px] flex-1 items-center justify-center rounded-xl border border-gray-300 text-base font-medium text-gray-900 active:bg-gray-50"
        >
          Overzicht / bewijs
        </Link>
      </div>
      {bunqEnabled && (
        <button
          type="button"
          onClick={openTikkie}
          className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white text-base font-medium text-gray-900 active:bg-gray-50"
        >
          Maak Tikkie aan
        </button>
      )}
      {tikkie ? (
        <div className="space-y-2 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <div className="flex items-center justify-between gap-3">
            <a href={tikkie} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium text-teal-700 underline">
              Tikkie-link opgeslagen
            </a>
            <button
              type="button"
              onClick={() => {
                if (confirm("De opgeslagen Tikkie-link wissen?")) void keepTikkie("");
              }}
              className="min-h-[44px] shrink-0 text-gray-500 underline"
            >
              Wissen
            </button>
          </div>
          {reminded && <p className="text-gray-500">Laatste herinnering: {new Date(reminded).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}</p>}
          <button
            type="button"
            onClick={remind}
            className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white text-base font-medium text-gray-900 active:bg-gray-50"
          >
            Stuur herinnering
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={pasteTikkie}
            className="min-h-[44px] w-full rounded-xl text-sm font-medium text-teal-700 active:bg-gray-50"
          >
            Tikkie-link plakken (voor een herinnering)
          </button>
          {pasteOpen && (
            <div className="flex gap-2">
              <input
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="https://tikkie.me/pay/…"
                className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-base"
              />
              <button
                type="button"
                onClick={() => void keepTikkie(pasted)}
                className="min-h-[48px] rounded-xl bg-gray-900 px-4 text-base font-medium text-white active:bg-gray-700"
              >
                Opslaan
              </button>
            </div>
          )}
        </div>
      )}
      {bunqUrl && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
          <span>
            {bunqLink?.status === "paid"
              ? "Betaald via bunq. Het bedrag wordt doorgestort naar je ING."
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
