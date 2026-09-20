"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { depositPlanned } from "@/actions/pots";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

// One line of the monthly checklist: how much of the planned deposit for this
// period has landed, with a one-tap "ingelegd" when it wasn't recognised
// automatically.
export function PlanRow({
  potId,
  name,
  planned,
  deposited,
}: {
  potId: string;
  name: string;
  planned: number;
  deposited: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const done = deposited >= planned - 0.005;
  const missing = Math.max(0, planned - deposited);
  const pct = Math.min(100, (deposited / planned) * 100);

  return (
    <li className="space-y-2 px-5 py-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${
            done ? "bg-teal-600 text-white" : "border border-gray-300 text-transparent"
          }`}
          aria-hidden="true"
        >
          ✓
        </span>
        <Link href={`/pots/${potId}`} className="min-w-0 flex-1 truncate text-lg text-gray-900">
          {name}
        </Link>
        <span className="shrink-0 text-base text-gray-600">
          {euro(deposited)} / {euro(planned)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100">
        <div className={`h-2 rounded-full ${done ? "bg-teal-600" : "bg-teal-400"}`} style={{ width: `${pct}%` }} />
      </div>
      {!done && (
        <p className="text-sm text-gray-500">Wordt vanzelf afgevinkt zodra de overboeking binnenkomt.</p>
      )}
      {!done && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await depositPlanned(potId, missing);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Mislukt");
              }
            });
          }}
          className="min-h-[44px] rounded-xl px-1 text-sm text-gray-500 underline disabled:opacity-50"
        >
          {isPending ? "Bezig…" : `Handmatig noteren: ${euro(missing)} ingelegd`}
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </li>
  );
}
