"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrderFromReceipt } from "@/actions/returns";

// Photograph a physical (in-store) receipt: same extraction idea as a mail,
// but from an image, and the return term runs from the purchase date itself
// (no shipping/delivery step for something you already carried home).
export function ReceiptScanForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      try {
        const r = await createOrderFromReceipt(formData);
        setResult(`${r.merchant} toegevoegd — retour vóór ${new Date(r.deadline).toLocaleDateString("nl-NL")}.`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bonnetje lezen mislukt");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Maak een foto van een kassabon. De app leest winkel, artikelen, bedrag en de retourtermijn die erop staat.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={isPending}
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="hidden"
        id="receipt-file-input"
      />
      <label
        htmlFor="receipt-file-input"
        className={`flex min-h-[52px] w-full items-center justify-center rounded-xl text-base font-medium ${
          isPending ? "bg-gray-300 text-gray-500" : "bg-teal-700 text-white active:bg-teal-800"
        }`}
      >
        {isPending ? "Bonnetje lezen…" : "Bonnetje fotograferen"}
      </label>
      {result && <p className="text-sm text-teal-700">{result}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
