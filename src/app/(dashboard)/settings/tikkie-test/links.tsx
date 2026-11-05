"use client";

import { useState } from "react";

export function TikkieLinks() {
  const [name, setName] = useState("");
  const n = encodeURIComponent(name.trim() || "TESTNAAM");
  const candidates = [
    "tikkie://overview",
    "tikkie://open",
    "tikkie://overview_account",
    `tikkie://overview?description=${n}`,
    `tikkie://overview?query=${n}`,
    `tikkie://overview?search=${n}`,
    "https://tikkie.me/overview",
    "https://tikkie.me/open",
    "https://tikkie.me/overview_account/",
  ];
  return (
    <>
      <p className="px-1 text-base text-gray-600">
        Maak eerst een test-Tikkie aan, vul hieronder de naam (omschrijving) ervan in en tik dan op de links. Kijk bij
        elke link wat er in Tikkie opent (overzicht, jouw Tikkie, of niets) en noteer het nummer.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Naam van de test-Tikkie"
        className="min-h-[52px] w-full rounded-2xl border border-gray-200 bg-white px-4 text-base"
      />
      <ol className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
        {candidates.map((url, i) => (
          <li key={url}>
            <a href={url} className="flex min-h-[56px] items-center gap-3 px-5 py-3 text-sm text-gray-900 active:bg-gray-50">
              <span className="w-6 shrink-0 text-base font-semibold text-gray-500">{i + 1}</span>
              <span className="min-w-0 break-all">{url}</span>
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}
