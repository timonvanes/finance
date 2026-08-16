"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSplitReclaim } from "@/actions/reclaims";

interface Person {
  id: string;
  name: string;
  groupName: string | null;
  isSelf: boolean;
}

interface TransactionOption {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
}

const UNGROUPED_LABEL = "Overig";

export function SplitReclaimForm({
  transactions,
  people,
  initialTransactionId,
}: {
  transactions: TransactionOption[];
  people: Person[];
  initialTransactionId?: string;
}) {
  const [selectedTx, setSelectedTx] = useState<Record<string, boolean>>(
    initialTransactionId ? { [initialTransactionId]: true } : {}
  );
  const [txFilter, setTxFilter] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [ownShare, setOwnShare] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // The total you put into WBW/Splitwise as one lump sum — combine every
  // transaction that was part of it here. WBW/Splitwise already did the
  // actual per-person division externally, so this app doesn't try to
  // re-derive it; it just needs to keep this total visible (also later, on
  // the reclaim(s) themselves) so you can check it against WBW.
  const totalAmount = transactions
    .filter((t) => selectedTx[t.id])
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  function toggleTx(txId: string, value: boolean) {
    setSelectedTx((prev) => ({ ...prev, [txId]: value }));
  }

  // isSelf is handled separately via "Mijn eigen deel" below, not as a
  // reclaim target.
  const reclaimPeople = people.filter((p) => !p.isSelf);
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const selectedTxCount = Object.values(selectedTx).filter(Boolean).length;

  // What's left after your own share, split evenly across whoever's
  // checked — no per-person typing needed, just tick everyone involved and
  // submit once. This is only an approximation when WBW's real split isn't
  // even; the total (kept on each reclaim) is what you reconcile against.
  const remaining = Math.max(totalAmount - (Number(ownShare) || 0), 0);
  const perPersonShare = checkedCount > 0 ? remaining / checkedCount : 0;

  const groups = new Map<string, Person[]>();
  for (const person of reclaimPeople) {
    const key = person.groupName ?? UNGROUPED_LABEL;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(person);
  }

  function toggleGroup(groupPeople: Person[], select: boolean) {
    setChecked((prev) => {
      const next = { ...prev };
      groupPeople.forEach((p) => {
        next[p.id] = select;
      });
      return next;
    });
  }

  function resetForm() {
    formRef.current?.reset();
    setSelectedTx({});
    setTxFilter("");
    setChecked({});
    setOwnShare("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // createSplitReclaim reads one amount_<personId> field per checked
    // person — there's no visible input for it anymore (see perPersonShare
    // above), so fill it in here right before submitting.
    Object.keys(checked)
      .filter((id) => checked[id])
      .forEach((id) => formData.set(`amount_${id}`, perPersonShare.toFixed(2)));
    startTransition(async () => {
      await createSplitReclaim(formData);
      resetForm();
      router.refresh();
    });
  }

  const filteredTransactions = txFilter
    ? transactions.filter((t) =>
        (t.counterparty_name ?? "").toLowerCase().includes(txFilter.toLowerCase())
      )
    : transactions;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-gray-200 bg-white p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Transacties (afschrijvingen) — vink er één of meerdere aan om te combineren
        </label>
        <input
          type="text"
          value={txFilter}
          onChange={(e) => setTxFilter(e.target.value)}
          placeholder="Zoek op naam…"
          className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
          {filteredTransactions.map((tx) => (
            <label key={tx.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="transactionId"
                value={tx.id}
                checked={!!selectedTx[tx.id]}
                onChange={(e) => toggleTx(tx.id, e.target.checked)}
              />
              <span className="min-w-0 flex-1 truncate">
                {new Date(tx.booking_date).toLocaleDateString("nl-NL")} ·{" "}
                {tx.counterparty_name ?? "Onbekend"}
              </span>
              <span className="shrink-0 font-medium text-gray-900">
                €{Math.abs(tx.amount).toFixed(2)}
              </span>
            </label>
          ))}
        </div>
        {selectedTxCount > 0 && (
          <p className="mt-1 text-xs text-gray-600">
            {selectedTxCount} transactie{selectedTxCount > 1 ? "s" : ""} geselecteerd · Totaal
            (zoals in WBW):{" "}
            <span className="font-medium text-gray-900">€{totalAmount.toFixed(2)}</span>
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Mijn eigen deel (blijft bij jou, wordt niet teruggevorderd)
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          name="ownShare"
          value={ownShare}
          onChange={(e) => setOwnShare(e.target.value)}
          placeholder="€0,00"
          className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Terugvorderen van{" "}
          {checkedCount > 0 &&
            `(€${remaining.toFixed(2)} gelijk verdeeld over ${checkedCount})`}
        </label>
        {reclaimPeople.length === 0 ? (
          <p className="text-xs text-gray-500">
            Nog niemand toegevoegd — voeg eerst iemand toe bij{" "}
            <a href="/settings/people" className="underline">
              Personen
            </a>
            .
          </p>
        ) : (
          <div className="space-y-3 rounded-md border border-gray-200 p-2">
            {[...groups.entries()].map(([groupName, groupPeople]) => (
              <div key={groupName}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">{groupName}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupPeople, true)}
                      className="text-xs text-gray-600 underline hover:text-gray-900"
                    >
                      Selecteer alles
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupPeople, false)}
                      className="text-xs text-gray-600 underline hover:text-gray-900"
                    >
                      Deselecteer alles
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {groupPeople.map((person) => (
                    <label key={person.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="personId"
                        value={person.id}
                        checked={!!checked[person.id]}
                        onChange={(e) =>
                          setChecked((prev) => ({ ...prev, [person.id]: e.target.checked }))
                        }
                      />
                      <span className="flex-1 truncate text-gray-900">{person.name}</span>
                      {checked[person.id] && (
                        <span className="shrink-0 text-gray-500">
                          €{perPersonShare.toFixed(2)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Hoe komt dit terug?
        </label>
        <select
          name="settlementMethod"
          defaultValue="bank"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="bank">Bankoverschrijving / Tikkie (automatisch te herkennen)</option>
          <option value="external_app">
            Andere app (WieBetaaltWat, Splitwise, etc.) — handmatig afvinken
          </option>
        </select>
      </div>

      {checkedCount > 1 && (
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input type="checkbox" name="sharedCode" />
          Zelfde referentiecode voor iedereen (handig bij één gedeeld betaalverzoek)
        </label>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Betaalverzoek-link of notitie (optioneel)
        </label>
        <input
          type="text"
          name="tikkieLink"
          placeholder="Tikkie-link, of een notitie zoals 'betaalverzoek via ING'"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={reclaimPeople.length === 0 || isPending || selectedTxCount === 0 || checkedCount === 0}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : "Toevoegen"}
      </button>
    </form>
  );
}
