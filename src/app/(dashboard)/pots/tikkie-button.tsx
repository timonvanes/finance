"use client";

import { tikkieUrl } from "@/lib/tikkie";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

// A small Tikkie button for one pot: opens Tikkie with the amount that is still to be put in
// and a description with the name of the pot. In Tikkie the account is chosen as usual.
export function TikkieButton({
  amount,
  potName,
  variant = "round",
}: {
  amount: number;
  potName: string;
  variant?: "round" | "card";
}) {
  function open() {
    window.location.assign(tikkieUrl(amount, `Sparen ${potName}`));
  }
  const label = `Tikkie voor ${potName}: ${euro(amount)}`;
  const icon = (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.2c-.6-.8-1.5-1.2-2.6-1.2-1.6 0-2.7.9-2.7 2.2 0 1.2.8 1.8 2.5 2.2 1.7.4 2.6 1 2.6 2.3 0 1.2-1.1 2.1-2.7 2.1-1.2 0-2.2-.5-2.8-1.3M8.4 11.7h4.6M8.4 13.4h4.2" />
    </svg>
  );

  if (variant === "card") {
    // In the corner of the pot's frame: small, in the teal of the app, no amount (it is in the label).
    return (
      <button
        type="button"
        onClick={open}
        aria-label={label}
        title={label}
        className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-200 active:bg-teal-100"
      >
        {icon}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      aria-label={label}
      className="flex h-8 items-center gap-1 rounded-full bg-teal-50 px-2.5 text-xs font-medium text-teal-800 ring-1 ring-teal-200 active:bg-teal-100"
    >
      {icon}
      Tikkie {euro(amount)}
    </button>
  );
}
