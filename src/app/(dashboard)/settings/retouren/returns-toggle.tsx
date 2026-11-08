"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setReturnsEnabled } from "@/actions/settings";

export function ReturnsToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function change(next: boolean) {
    const before = on;
    setOn(next);
    setError(null);
    try {
      await setReturnsEnabled(next);
      router.refresh();
    } catch {
      setOn(before);
      setError("Opslaan mislukt. Probeer het opnieuw.");
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex min-h-[64px] items-center justify-between gap-4 rounded-2xl bg-white px-5 py-3 ring-1 ring-gray-200">
        <span className="text-base text-gray-900">Retouren gebruiken</span>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => void change(e.target.checked)}
          className="h-6 w-6 shrink-0 accent-teal-700"
        />
      </label>
      {error && <p className="px-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
