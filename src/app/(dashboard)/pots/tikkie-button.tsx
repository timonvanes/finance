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
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.2c-.6-.8-1.5-1.2-2.6-1.2-1.6 0-2.7.9-2.7 2.2 0 1.2.8 1.8 2.5 2.2 1.7.4 2.6 1 2.6 2.3 0 1.2-1.1 2.1-2.7 2.1-1.2 0-2.2-.5-2.8-1.3M8.4 11.7h4.6M8.4 13.4h4.2" />
    </svg>
  );

  if (variant === "card") {
    // Next to a pot: only a small grey icon, no box, no amount (that is in the label).
    return (
      <button
        type="button"
        onClick={open}
        aria-label={label}
        title={label}
        className="flex w-10 shrink-0 items-center justify-center rounded-xl text-gray-300 active:text-teal-700"
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
      className="flex min-h-[40px] items-center gap-1.5 rounded-lg px-1 text-sm text-gray-500 active:text-teal-700"
    >
      {icon}
      Tikkie {euro(amount)}
    </button>
  );
}
