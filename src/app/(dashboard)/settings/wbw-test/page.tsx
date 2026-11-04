"use client";

import Link from "next/link";
import { useState } from "react";

// Temporary test page. Which addresses open WieBetaaltWat on the right list (or
// even on "add expense")? The app's manifest lists these domains and paths, but
// only a phone can tell which ones really land somewhere.
const idFrom = (text: string) => {
  const t = text.trim();
  const m = t.match(/lists\/([^/?#\s]+)/);
  return m ? m[1] : t.replace(/[^A-Za-z0-9_-]/g, "");
};

export default function WbwTestPage() {
  const [input, setInput] = useState("");
  const id = idFrom(input);

  const candidates: { url: string; needsId: boolean }[] = [
    { url: "splitser://", needsId: false },
    { url: "https://app.wiebetaaltwat.nl/lists", needsId: false },
    { url: "splitser://lists", needsId: false },
    { url: `https://app.wiebetaaltwat.nl/lists/${id}`, needsId: true },
    { url: `splitser://lists/${id}`, needsId: true },
    { url: `https://app.wiebetaaltwat.nl/lists/${id}/insights`, needsId: true },
    { url: `splitser://lists/${id}/insights`, needsId: true },
    // The website's own pages (found in its code): the list's transactions and "add expense".
    { url: `https://app.wiebetaaltwat.nl/lists/${id}/transactions`, needsId: true },
    { url: `https://app.wiebetaaltwat.nl/lists/${id}/transactions/create`, needsId: true },
    { url: `https://app.wiebetaaltwat.nl/lists/${id}/transactions/create?amount=12.50&description=Testcode%20ABCD`, needsId: true },
    { url: `splitser://lists/${id}/transactions/create`, needsId: true },
    { url: `https://app.wiebetaaltwat.nl/lists/${id}/balance`, needsId: true },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">WBW-test</h1>
      </div>
      <p className="px-1 text-base text-gray-600">
        Plak hieronder de link of het nummer van je WieBetaaltWat-lijst (te vinden in de adresbalk van
        app.wiebetaaltwat.nl als je daar in je lijst zit). Tik daarna de links langs en noteer welk nummer op de juiste
        plek opent: de app, de overzichtspagina, jouw lijst, of &quot;uitgave toevoegen&quot; met €12,50 ingevuld.
      </p>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Lijstlink of lijstnummer"
        className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-4 text-base"
      />
      <ol className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
        {candidates.map((c, i) => {
          const disabled = c.needsId && !id;
          return (
            <li key={c.url}>
              <a
                href={disabled ? undefined : c.url}
                aria-disabled={disabled}
                className={`flex min-h-[56px] items-center gap-3 px-5 py-3 text-sm ${
                  disabled ? "text-gray-300" : "text-gray-900 active:bg-gray-50"
                }`}
              >
                <span className="w-6 shrink-0 text-base font-semibold text-gray-500">{i + 1}</span>
                <span className="min-w-0 break-all">{c.url}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
