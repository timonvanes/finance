"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrder, extractOrderPreview } from "@/actions/returns";

interface DraftItem {
  description: string;
  price: string;
  quantity: string;
}

const EMPTY_ITEM: DraftItem = { description: "", price: "", quantity: "1" };

export function ImportForm() {
  const [emailText, setEmailText] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [step, setStep] = useState<"paste" | "review">("paste");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setEmailText("");
    setMerchantName("");
    setOrderDate("");
    setTotalAmount("");
    setItems([]);
    setStep("paste");
    setError(null);
  }

  function handleExtract() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await extractOrderPreview(emailText);
        setMerchantName(result.merchant_name);
        setOrderDate(result.order_date ?? "");
        setTotalAmount(result.total_amount != null ? String(result.total_amount) : "");
        setItems(
          result.items.length > 0
            ? result.items.map((i) => ({
                description: i.description,
                price: String(i.price),
                quantity: String(i.quantity),
              }))
            : [EMPTY_ITEM]
        );
        setStep("review");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Extractie mislukt");
      }
    });
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function handleSave() {
    startTransition(async () => {
      await createOrder({
        merchantName: merchantName || "Onbekende webshop",
        orderDate: orderDate || null,
        totalAmount: totalAmount ? Number(totalAmount) : null,
        sourceText: emailText,
        items: items
          .filter((i) => i.description.trim() && i.price)
          .map((i) => ({
            description: i.description.trim(),
            price: Number(i.price),
            quantity: Number(i.quantity) || 1,
          })),
      });
      reset();
      router.refresh();
    });
  }

  if (step === "paste") {
    return (
      <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
        <label className="block text-xs font-medium text-gray-700">
          Plak hier de tekst van je orderbevestigingsmail
        </label>
        <textarea
          value={emailText}
          onChange={(e) => setEmailText(e.target.value)}
          rows={8}
          placeholder="Bedankt voor je bestelling bij ..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="button"
          disabled={!emailText.trim() || isPending}
          onClick={handleExtract}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? "Bezig…" : "Gegevens ophalen"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">
        Controleer de herkende gegevens en pas aan waar nodig.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Webshop</label>
          <input
            type="text"
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Besteldatum</label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Totaalbedrag</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">Artikelen</label>
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={item.description}
              onChange={(e) => updateItem(index, { description: e.target.value })}
              placeholder="Omschrijving"
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={item.quantity}
              onChange={(e) => updateItem(index, { quantity: e.target.value })}
              className="w-14 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
            <span className="text-xs text-gray-400">x €</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={item.price}
              onChange={(e) => updateItem(index, { price: e.target.value })}
              className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
              className="text-xs text-red-400 underline hover:text-red-600"
            >
              Verwijderen
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, EMPTY_ITEM])}
          className="text-xs text-gray-600 underline hover:text-gray-900"
        >
          + Artikel toevoegen
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? "Bezig…" : "Opslaan"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}
