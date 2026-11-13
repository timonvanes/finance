"use client";

import { useActionState, useState } from "react";
import { startOwnTransfer, type TransferResult } from "@/actions/transfers";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export interface TransferAccount {
  id: string;
  label: string; // "ING · Betaalrekening · NL12…3456"
}
export interface TransferTarget {
  iban: string;
  label: string;
}

// Gives the monthly deposit to the pots in one go: the app prepares the transfer between the
// person's own accounts, and the person approves it in their own bank app. Once, or as a
// standing order each month. A trial: the bank may refuse it, and then it says why.
export function TransferCard({
  accounts,
  targets,
  suggested,
  result,
}: {
  accounts: TransferAccount[];
  targets: TransferTarget[];
  suggested: number;
  result: { status: "ok" | "mislukt" | "onbekend"; amount?: string; mode?: string; reason?: string } | null;
}) {
  const [state, action, pending] = useActionState(startOwnTransfer, {} as TransferResult);
  const [mode, setMode] = useState<"once" | "monthly">("once");

  if (accounts.length === 0 || targets.length === 0) return null;

  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Potjes storten via je bank</h2>
        <p className="text-sm text-gray-500">
          Maak het bedrag over van je betaalrekening naar je spaarrekening, zonder zelf in de bank-app te typen. Jij keurt het zelf goed in je bank-app.
        </p>
      </div>

      {result?.status === "ok" && (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
          Goedgekeurd in je bank: {euro(Number(result.amount))}
          {result.mode === "monthly" ? " elke maand" : ""}. Controleer even in je bank-app of het er staat.
        </p>
      )}
      {result?.status === "mislukt" && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">De betaling is niet goedgekeurd{result.reason ? `: ${result.reason}` : "."}</p>
      )}
      {result?.status === "onbekend" && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Ik kon de uitkomst niet controleren. Kijk in je bank-app of de betaling er staat.</p>}
      {state.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}

      <form action={action} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Van</span>
          <select name="fromAccountId" required className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Naar (je eigen rekening)</span>
          <select name="toIban" required className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base">
            {targets.map((t) => (
              <option key={t.iban} value={t.iban}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Bedrag</span>
          <input
            name="amount"
            inputMode="decimal"
            required
            defaultValue={suggested > 0 ? suggested.toFixed(2).replace(".", ",") : ""}
            placeholder="0,00"
            className="min-h-[48px] w-full rounded-xl border border-gray-300 px-3 text-base"
          />
        </label>

        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="sr-only">Eenmalig of elke maand</legend>
          {(
            [
              ["once", "Eenmalig"],
              ["monthly", "Elke maand"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl text-base font-medium ring-1 ${
                mode === value ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-700 ring-gray-200"
              }`}
            >
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </fieldset>

        {mode === "monthly" && (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Eerste keer op</span>
            <input name="firstDate" type="date" required className="min-h-[48px] w-full rounded-xl border border-gray-300 px-3 text-base" />
            <span className="block text-xs text-gray-500">
              Dit maakt een nieuwe vaste overschrijving. Een bestaande bij je bank blijft staan: verwijder die zelf, anders betaal je dubbel.
            </span>
          </label>
        )}

        <button type="submit" disabled={pending} className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50">
          {pending ? "Naar je bank…" : "Ga naar je bank om goed te keuren"}
        </button>
      </form>
    </section>
  );
}
