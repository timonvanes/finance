"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-[52px] w-full rounded-xl bg-gray-900 text-base font-medium text-white active:bg-gray-700 print:hidden"
    >
      Afdrukken of opslaan als PDF
    </button>
  );
}
