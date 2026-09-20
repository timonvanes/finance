"use client";

import { useState } from "react";

// Tap to copy: the code goes in the description of the Tikkie/payment
// request so the incoming payment is recognised automatically.
export function ReferenceCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title="Kopieer de code en zet 'm in de omschrijving van je Tikkie/betaalverzoek voor automatische herkenning"
      aria-label={`Kopieer code ${code}`}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 font-mono text-sm text-gray-700 active:bg-gray-100"
    >
      <span>{code}</span>
      {copied ? (
        <span className="font-sans text-xs text-teal-700">Gekopieerd</span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V6a2 2 0 0 1 2-2h9" />
        </svg>
      )}
    </button>
  );
}
