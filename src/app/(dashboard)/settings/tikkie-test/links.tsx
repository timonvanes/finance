"use client";

import { useState } from "react";

export function TikkieLinks() {
  const [name, setName] = useState("Test");
  const [link, setLink] = useState("https://tikkie.me/pay/sm5s789u78smenh0utf4");
  const n = encodeURIComponent(name.trim() || "TESTNAAM");
  const id = link.trim().match(/tikkie\.me\/pay\/([A-Za-z0-9]+)/)?.[1] ?? "ID";

  const groups: { title: string; urls: string[] }[] = [
    {
      title: "De Tikkie zelf (je eigen link)",
      urls: [
        link.trim(),
        `tikkie://pay/${id}`,
        `tikkie://token/${id}`,
        `tikkie://payment_request/${id}`,
        `tikkie://payment_request?token=${id}`,
        `tikkie://overview/${id}`,
        `tikkie://open/${id}`,
      ],
    },
    {
      title: "Het overzicht",
      urls: [
        "tikkie://overview",
        "tikkie://open",
        "tikkie://overview_account",
        `tikkie://overview?description=${n}`,
        `tikkie://overview?query=${n}`,
        `tikkie://overview?search=${n}`,
        "https://tikkie.me/overview",
        "https://tikkie.me/open",
        "https://tikkie.me/overview_account/",
      ],
    },
  ];
  let nr = 0;
  return (
    <>
      <p className="px-1 text-base text-gray-600">
        Tik op de links en kijk wat er in Tikkie opent: het overzicht, jouw Tikkie met &quot;Deel opnieuw&quot;, de
        betaalpagina, of niets. Noteer het nummer.
      </p>
      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="https://tikkie.me/pay/…"
        className="min-h-[52px] w-full rounded-2xl border border-gray-200 bg-white px-4 text-base"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Naam van de test-Tikkie"
        className="min-h-[52px] w-full rounded-2xl border border-gray-200 bg-white px-4 text-base"
      />
      {groups.map((g) => (
        <div key={g.title} className="space-y-2">
          <h2 className="px-1 text-sm font-medium text-gray-500">{g.title}</h2>
          <ol className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {g.urls.map((url) => {
              nr += 1;
              return (
                <li key={url}>
                  <a href={url} className="flex min-h-[56px] items-center gap-3 px-5 py-3 text-sm text-gray-900 active:bg-gray-50">
                    <span className="w-6 shrink-0 text-base font-semibold text-gray-500">{nr}</span>
                    <span className="min-w-0 break-all">{url}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </>
  );
}
