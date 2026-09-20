"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualLoan } from "@/actions/loans";

const input = "min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-4 text-base";
const label = "mb-1 block text-sm text-gray-500";

export function NewLoanForm({ people }: { people: { id: string; name: string }[] }) {
  const [lender, setLender] = useState("");
  const [otherName, setOtherName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <details className="rounded-2xl bg-white ring-1 ring-gray-200">
      <summary className="flex min-h-[56px] cursor-pointer items-center px-5 text-base font-medium text-gray-900">
        + Zelf een lening toevoegen
      </summary>
      <div className="space-y-4 p-5 pt-2">
        <div>
          <label className={label}>Van wie</label>
          <select value={lender} onChange={(e) => setLender(e.target.value)} className={input}>
            <option value="">Kies…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="other">Iemand anders (zelf invullen)…</option>
          </select>
        </div>
        {lender === "other" && (
          <input
            type="text"
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            placeholder="Naam van de lener…"
            className={input}
          />
        )}
        <div>
          <label className={label}>Geleend bedrag</label>
          <label className="flex h-[52px] items-center gap-2 rounded-xl border border-gray-300 px-4">
            <span className="text-gray-400">€</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-lg outline-none"
            />
          </label>
        </div>
        <div>
          <label className={label}>Datum</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notitie (optioneel)"
          className={input}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await createManualLoan({
                  personId: lender && lender !== "other" ? lender : undefined,
                  lenderName: lender === "other" ? otherName : undefined,
                  amount: Number(amount),
                  date,
                  note,
                });
                setLender("");
                setOtherName("");
                setAmount("");
                setNote("");
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Opslaan mislukt");
              }
            });
          }}
          className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
        >
          {isPending ? "Bezig…" : "Lening toevoegen"}
        </button>
      </div>
    </details>
  );
}
