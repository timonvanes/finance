"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPotEntry, deletePot, deletePotEntry, updatePotMatchText } from "@/actions/pots";

interface Entry {
  id: string;
  amount: number;
  note: string | null;
  entry_date: string;
  transaction_id: string | null;
}

const KIND_LABEL: Record<string, string> = {
  savings: "Sparen",
  investment: "Beleggen",
  vacation: "Vakantie",
  other: "Overig",
};

const KIND_STYLE: Record<string, string> = {
  savings: "bg-green-50 text-green-700",
  investment: "bg-purple-50 text-purple-700",
  vacation: "bg-sky-50 text-sky-700",
  other: "bg-gray-100 text-gray-600",
};

export function PotRow({
  pot,
}: {
  pot: {
    id: string;
    name: string;
    kind: string;
    target_amount: number | null;
    match_text: string | null;
    pot_entries: Entry[];
  };
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [showEntries, setShowEntries] = useState(false);
  const [matchText, setMatchText] = useState(pot.match_text ?? "");
  const [matchResult, setMatchResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function saveMatchText() {
    setMatchResult(null);
    startTransition(async () => {
      const count = await updatePotMatchText(pot.id, matchText || null);
      setMatchResult(matchText ? `${count} transactie(s) gekoppeld` : null);
      router.refresh();
    });
  }

  const balance = pot.pot_entries.reduce((sum, e) => sum + e.amount, 0);
  const pct =
    pot.target_amount && pot.target_amount > 0
      ? Math.min(100, (balance / pot.target_amount) * 100)
      : null;

  function submit(direction: "deposit" | "withdraw") {
    const value = Number(amount);
    if (!value || value <= 0) return;
    startTransition(async () => {
      await addPotEntry(pot.id, value, direction, note.trim() || null);
      setAmount("");
      setNote("");
      router.refresh();
    });
  }

  const sortedEntries = [...pot.pot_entries].sort(
    (a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
  );

  return (
    <li className="flex flex-col gap-3 px-4 py-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-gray-900">
            {pot.name}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${KIND_STYLE[pot.kind] ?? KIND_STYLE.other}`}
            >
              {KIND_LABEL[pot.kind] ?? pot.kind}
            </span>
          </p>
          <p className="text-gray-500">
            €{balance.toFixed(2)}
            {pot.target_amount != null && ` van €${pot.target_amount.toFixed(2)}`}
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Dit potje verwijderen (inclusief historie)?")) return;
            startTransition(async () => {
              await deletePot(pot.id);
              router.refresh();
            });
          }}
          className="shrink-0 text-xs text-red-400 underline hover:text-red-600 disabled:opacity-50"
        >
          Verwijderen
        </button>
      </div>

      {pct != null && (
        <div className="h-2 rounded-full bg-gray-100">
          <div
            className={`h-2 rounded-full ${pct >= 100 ? "bg-green-600" : "bg-gray-900"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-md bg-gray-50 p-2">
        <label className="text-xs text-gray-500">
          Herkenningstekst (bv. naam potje bij je bank):
        </label>
        <input
          type="text"
          value={matchText}
          disabled={isPending}
          onChange={(e) => setMatchText(e.target.value)}
          placeholder="bv. Vakantie Italië"
          className="w-40 rounded-md border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={saveMatchText}
          className="text-xs font-medium text-gray-900 underline disabled:opacity-50"
        >
          Opslaan
        </button>
        {matchResult && <span className="text-xs text-green-700">{matchResult}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400">€</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          disabled={isPending}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Bedrag"
          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
        />
        <input
          type="text"
          value={note}
          disabled={isPending}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notitie (optioneel)"
          className="w-40 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
        />
        <button
          type="button"
          disabled={isPending || !amount}
          onClick={() => submit("deposit")}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          Inleggen
        </button>
        <button
          type="button"
          disabled={isPending || !amount}
          onClick={() => submit("withdraw")}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Opnemen
        </button>
      </div>

      {pot.pot_entries.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowEntries((v) => !v)}
            className="text-xs text-gray-500 underline hover:text-gray-700"
          >
            {showEntries ? "Verberg historie" : `Historie (${pot.pot_entries.length})`}
          </button>
          {showEntries && (
            <ul className="mt-2 space-y-1 rounded-md border border-gray-100 bg-gray-50 p-2">
              {sortedEntries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-500">
                    {new Date(e.entry_date).toLocaleDateString("nl-NL")}
                    {e.note && ` · ${e.note}`}
                    {e.transaction_id && (
                      <span className="ml-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-blue-700">
                        automatisch
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={e.amount < 0 ? "font-medium text-gray-900" : "font-medium text-green-700"}
                    >
                      {e.amount < 0 ? "-" : "+"}€{Math.abs(e.amount).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          await deletePotEntry(e.id);
                          router.refresh();
                        });
                      }}
                      className="text-gray-300 underline hover:text-red-500 disabled:opacity-50"
                    >
                      x
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
