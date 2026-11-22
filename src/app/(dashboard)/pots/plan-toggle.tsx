"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPotInHousePlan } from "@/actions/pots";

// Switch: does this pot count for the financial plan (the house deposit)?
export function PlanToggle({ potId, initial, compact }: { potId: string; initial: boolean; compact?: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Telt mee voor het plan"
      disabled={pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          await setPotInHousePlan(potId, next);
          router.refresh();
        });
      }}
      className={`flex shrink-0 items-center rounded-full p-0.5 transition ${compact ? "h-7 w-12" : "h-8 w-14"} ${on ? "bg-teal-600" : "bg-gray-300"} disabled:opacity-60`}
    >
      <span className={`block h-6 w-6 rounded-full bg-white transition ${on ? (compact ? "translate-x-5" : "translate-x-6") : ""}`} />
    </button>
  );
}
