"use client";

import { useState, useTransition } from "react";
import { setDashboardModuleVisible } from "@/actions/settings";
import { DASHBOARD_MODULES } from "@/lib/dashboard/modules";

export function ModuleToggles({ hidden }: { hidden: string[] }) {
  const [off, setOff] = useState(new Set(hidden));
  const [, startTransition] = useTransition();

  function toggle(key: string, visible: boolean) {
    setOff((prev) => {
      const next = new Set(prev);
      if (visible) next.delete(key);
      else next.add(key);
      return next;
    });
    startTransition(async () => {
      await setDashboardModuleVisible(key, visible);
    });
  }

  return (
    <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
      {DASHBOARD_MODULES.map((m) => (
        <li key={m.key} className="border-b border-gray-100 last:border-b-0">
          <label className="flex min-h-[60px] items-center justify-between gap-4 px-5 py-3">
            <span className="text-base text-gray-900">{m.label}</span>
            <input
              type="checkbox"
              checked={!off.has(m.key)}
              onChange={(e) => toggle(m.key, e.target.checked)}
              className="h-6 w-6 shrink-0 accent-teal-700"
            />
          </label>
        </li>
      ))}
    </ul>
  );
}
