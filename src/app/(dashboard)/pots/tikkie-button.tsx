"use client";

import Image from "next/image";
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
  const size = variant === "card" ? 28 : 20;
  const label = `Tikkie voor ${potName}: ${euro(amount)}`;
  const icon = <Image src="/icons/tikkie.png" alt="" width={size} height={size} unoptimized className="rounded-[22%]" />;

  if (variant === "card") {
    // In the top corner of the pot's frame, next to the balance (not over the progress bar): just the Tikkie logo.
    return (
      <button
        type="button"
        onClick={open}
        aria-label={label}
        title={label}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl active:opacity-70"
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
      className="flex h-9 items-center gap-2 rounded-full bg-gray-50 px-3 text-sm font-medium text-gray-700 ring-1 ring-gray-200 active:bg-gray-100"
    >
      {icon}
      Tikkie {euro(amount)}
    </button>
  );
}
