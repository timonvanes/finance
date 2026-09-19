"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markTransactionAsLoan, markTransactionAsRepayment } from "@/actions/loans";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export function LoanPicker({
  transactionId,
  mode,
  people,
  openLoans,
}: {
  transactionId: string;
  mode: "borrow" | "repay";
  people: { id: string; name: string }[];
  openLoans: { id: string; personName: string; balance: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [otherName, setOtherName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function confirm() {
    if (!choice || (choice === "other" && !otherName.trim())) {
      setError(mode === "borrow" ? "Kies of vul in van wie de lening is." : "Kies een lening.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "repay") {
          await markTransactionAsRepayment(transactionId, choice.replace("loan:", ""));
        } else if (choice === "other") {
          await markTransactionAsLoan(transactionId, { lenderName: otherName });
        } else if (choice.startsWith("loan:")) {
          await markTransactionAsLoan(transactionId, { loanId: choice.slice(5) });
        } else {
          await markTransactionAsLoan(transactionId, { personId: choice.slice(7) });
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[44px] rounded-xl border border-purple-200 bg-purple-50 px-4 text-sm font-medium text-purple-700 active:bg-purple-100"
      >
        {mode === "borrow" ? "Lening" : "Aflossing lening"}
      </button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-xl bg-purple-50 p-3">
      <select
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className="min-h-[48px] w-full rounded-xl border border-purple-200 bg-white px-3 text-base"
      >
        <option value="" disabled>
          {mode === "borrow" ? "Van wie is de lening?" : "Welke lening aflossen?"}
        </option>
        {openLoans.length > 0 && (
          <optgroup label={mode === "borrow" ? "Erbij op bestaande lening" : "Openstaande leningen"}>
            {openLoans.map((l) => (
              <option key={l.id} value={`loan:${l.id}`}>
                {l.personName} · {euro(l.balance)} open
              </option>
            ))}
          </optgroup>
        )}
        {mode === "borrow" && (
          <optgroup label="Nieuwe lening van">
            {people.map((p) => (
              <option key={p.id} value={`person:${p.id}`}>
                {p.name}
              </option>
            ))}
            <option value="other">Iemand anders (zelf invullen)…</option>
          </optgroup>
        )}
      </select>
      {mode === "borrow" && choice === "other" && (
        <input
          type="text"
          value={otherName}
          onChange={(e) => setOtherName(e.target.value)}
          placeholder="Naam van de lener…"
          className="min-h-[48px] w-full rounded-xl border border-purple-200 bg-white px-3 text-base"
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={confirm}
          className="min-h-[44px] flex-1 rounded-xl bg-purple-700 text-sm font-medium text-white active:bg-purple-800 disabled:opacity-50"
        >
          {isPending ? "Bezig…" : "Opslaan"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-[44px] rounded-xl px-4 text-sm text-gray-600"
        >
          Annuleer
        </button>
      </div>
    </div>
  );
}
