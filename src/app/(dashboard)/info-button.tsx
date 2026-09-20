"use client";

import { useState, type ReactNode } from "react";

// All explanatory text lives behind a small "i" and opens as a sheet, so the
// screens stay clean and the text never fights with the layout.
export function InfoButton({ children, label = "Uitleg" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white font-serif text-base italic text-gray-600 active:bg-gray-100"
      >
        i
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-base text-gray-700 sm:rounded-3xl"
          >
            {children}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-[48px] w-full rounded-xl bg-gray-900 text-base font-medium text-white active:bg-gray-700"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </>
  );
}
