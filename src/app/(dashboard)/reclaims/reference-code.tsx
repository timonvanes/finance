"use client";

import { useState } from "react";

export function ReferenceCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title="Zet deze code in de omschrijving van je Tikkie/betaalverzoek voor automatische herkenning"
      onClick={() => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md border border-dashed border-gray-300 px-2 py-0.5 font-mono text-xs text-gray-600 hover:bg-gray-50"
    >
      {copied ? "Gekopieerd!" : code}
    </button>
  );
}
