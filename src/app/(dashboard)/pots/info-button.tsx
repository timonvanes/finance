"use client";

import { useState, type ReactNode } from "react";

// All the explanatory text lives behind a small "i" so the screens stay clean.
export function InfoButton({ children, label = "Uitleg" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white font-serif text-base italic text-gray-600 active:bg-gray-100"
      >
        i
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900 ring-1 ring-blue-100">
          {children}
        </div>
      )}
    </div>
  );
}
