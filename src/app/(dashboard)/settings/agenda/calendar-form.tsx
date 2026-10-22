"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCalendarToken } from "@/actions/settings";

export function CalendarForm({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function create() {
    setError(null);
    startTransition(async () => {
      try {
        await createCalendarToken();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Aanmaken mislukt");
      }
    });
  }

  if (!url) {
    return (
      <div className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        <button
          type="button"
          disabled={isPending}
          onClick={create}
          className="min-h-[52px] w-full rounded-xl bg-teal-700 text-lg font-medium text-white active:bg-teal-800 disabled:opacity-50"
        >
          {isPending ? "Bezig…" : "Agendalink aanmaken"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const webcal = url.replace(/^https:/, "webcal:");

  return (
    <div className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <p className="break-all rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{url}</p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
        className="min-h-[52px] w-full rounded-xl bg-teal-700 text-lg font-medium text-white active:bg-teal-800"
      >
        {copied ? "Gekopieerd" : "Link kopiëren"}
      </button>
      <a
        href={webcal}
        className="flex min-h-[52px] w-full items-center justify-center rounded-xl border border-gray-300 text-lg font-medium text-gray-900 active:bg-gray-50"
      >
        Openen in agenda-app
      </a>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Nieuwe link maken? De oude link werkt dan niet meer, dus je moet je agenda opnieuw abonneren.")) return;
          create();
        }}
        className="min-h-[44px] text-sm text-gray-500 underline disabled:opacity-50"
      >
        Nieuwe link maken
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
