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
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  // Which checked people have had their amount typed by hand — those are
  // never touched again. Anyone still untouched auto-shares the remainder
  // evenly, so simply checking people (the common "split evenly" case)
  // needs no typing at all, and typing a WBW-given override for one person
  // reflows the rest instead of wiping it out.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Combining multiple transactions first (WieBetaaltWat-style: add up the
  // whole pot) instead of splitting one transaction at a time.
  const totalAmount = transactions
    .filter((t) => selectedTx[t.id])
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  function redistribute(
    nextChecked: Record<string, boolean>,
    nextTouched: Record<string, boolean>,
    currentAmounts: Record<string, string>,
    total: number
  ) {
    const checkedIds = Object.keys(nextChecked).filter((id) => nextChecked[id]);
    const untouchedIds = checkedIds.filter((id) => !nextTouched[id]);
    const touchedSum = checkedIds
      .filter((id) => nextTouched[id])
      .reduce((sum, id) => sum + (Number(currentAmounts[id]) || 0), 0);
    if (untouchedIds.length === 0) return;
    const share = Math.max(total - touchedSum, 0) / untouchedIds.length;
    setAmounts((prev) => {
      const next = { ...prev };
      untouchedIds.forEach((id) => {
        next[id] = share.toFixed(2);
      });
      return next;
    });
  }

  function toggleTx(txId: string, value: boolean) {
    const nextSelectedTx = { ...selectedTx, [txId]: value };
    setSelectedTx(nextSelectedTx);
    const nextTotal = transactions
      .filter((t) => nextSelectedTx[t.id])
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    redistribute(checked, touched, amounts, nextTotal);
  }

  function togglePerson(personId: string, value: boolean) {
    const nextChecked = { ...checked, [personId]: value };
    const nextTouched = { ...touched };
    if (!value) {
      delete nextTouched[personId];
      setAmounts((prev) => ({ ...prev, [personId]: "" }));
    }
    setChecked(nextChecked);
    setTouched(nextTouched);
    redistribute(nextChecked, nextTouched, amounts, totalAmount);
  }

  function editAmount(personId: string, value: string) {
    const nextTouched = { ...touched, [personId]: true };
    const nextAmounts = { ...amounts, [personId]: value };
    setTouched(nextTouched);
    setAmounts(nextAmounts);
    redistribute(checked, nextTouched, nextAmounts, totalAmount);
  }

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const selectedTxCount = Object.values(selectedTx).filter(Boolean).length;
  const enteredAmount = Object.keys(checked)
    .filter((id) => checked[id])
    .reduce((sum, id) => sum + (Number(amounts[id]) || 0), 0);

  const groups = new Map<string, Person[]>();
  for (const person of people) {
    const key = person.groupName ?? UNGROUPED_LABEL;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(person);
  }

  function toggleGroup(groupPeople: Person[], select: boolean) {
    const nextChecked = { ...checked };
    const nextTouched = { ...touched };
    groupPeople.forEach((p) => {
      nextChecked[p.id] = select;
      if (!select) {
        delete nextTouched[p.id];
      }
    });
    setChecked(nextChecked);
    setTouched(nextTouched);
    if (!select) {
      setAmounts((prev) => {
        const next = { ...prev };
        groupPeople.forEach((p) => {
          next[p.id] = "";
        });
        return next;
      });
    }
    redistribute(nextChecked, nextTouched, amounts, totalAmount);
  }

  function resetForm() {
    formRef.current?.reset();
    setSelectedTx({});
    setTxFilter("");
    setChecked({});
    setAmounts({});
    setTouched({});
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
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
      className="space-y-3 rounded-2xl bg-white ring-1 ring-gray-200 p-4"
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
            {selectedTxCount} transactie{selectedTxCount > 1 ? "s" : ""} geselecteerd · Totaal:{" "}
            <span className="font-medium text-gray-900">€{totalAmount.toFixed(2)}</span>
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Wie deelt er mee (vink ook jezelf aan als je zelf ook een deel had)?{" "}
          {checkedCount > 1 &&
            "(wordt gelijk verdeeld — typ een bedrag over om dat van WBW/Splitwise over te nemen)"}
        </label>
        {selectedTxCount > 0 && (
          <p className="mb-1 text-xs text-gray-500">
            Totaal: <span className="font-medium text-gray-900">€{totalAmount.toFixed(2)}</span>
            {checkedCount > 0 && (
              <>
                {" "}
                · Ingevuld: €{enteredAmount.toFixed(2)}
                {Math.abs(totalAmount - enteredAmount) > 0.01 && (
                  <span className="text-amber-700">
                    {" "}
                    ·{" "}
                    {totalAmount - enteredAmount > 0
                      ? `nog €${(totalAmount - enteredAmount).toFixed(2)} te verdelen`
                      : `€${(enteredAmount - totalAmount).toFixed(2)} te veel ingevuld`}
                  </span>
                )}
              </>
            )}
          </p>
        )}
        {people.length === 0 ? (
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
                    <div key={person.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="personId"
                        value={person.id}
                        checked={!!checked[person.id]}
                        onChange={(e) => togglePerson(person.id, e.target.checked)}
                      />
                      <span
                        className="w-28 shrink-0 truncate text-sm text-gray-900"
                        title={person.isSelf ? "Jouw eigen aandeel — wordt niet gevorderd" : undefined}
                      >
                        {person.name}
                        {person.isSelf && " (jij)"}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        name={`amount_${person.id}`}
                        disabled={!checked[person.id]}
                        value={amounts[person.id] ?? ""}
                        onChange={(e) => editAmount(person.id, e.target.value)}
                        placeholder="€"
                        className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>
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
        disabled={people.length === 0 || isPending || selectedTxCount === 0}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : "Toevoegen"}
      </button>
    </form>
  );
}
