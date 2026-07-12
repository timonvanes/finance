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
  const initialTx =
    (initialTransactionId && transactions.find((t) => t.id === initialTransactionId)) ||
    transactions[0];
  const [txAmount, setTxAmount] = useState(initialTx ? Math.abs(initialTx.amount) : 0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Amounts are weighted by quantity (WieBetaaltWat-style: 2x someone's
  // share counts double), but stay a plain editable € amount afterwards for
  // one-off custom splits.
  function recalcWeightedSplit(
    nextChecked: Record<string, boolean>,
    nextQuantities: Record<string, string>,
    amount: number
  ) {
    const ids = Object.keys(nextChecked).filter((id) => nextChecked[id]);
    if (ids.length === 0) return;
    const totalShares = ids.reduce((sum, id) => sum + (Number(nextQuantities[id]) || 1), 0);
    if (totalShares <= 0) return;
    setAmounts((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        const share = Number(nextQuantities[id]) || 1;
        next[id] = ((amount * share) / totalShares).toFixed(2);
      });
      return next;
    });
  }

  const checkedCount = Object.values(checked).filter(Boolean).length;

  const groups = new Map<string, Person[]>();
  for (const person of people) {
    const key = person.groupName ?? UNGROUPED_LABEL;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(person);
  }

  function toggleGroup(groupPeople: Person[], select: boolean) {
    const nextChecked = { ...checked };
    groupPeople.forEach((p) => {
      nextChecked[p.id] = select;
    });
    setChecked(nextChecked);
    recalcWeightedSplit(nextChecked, quantities, txAmount);
  }

  function resetForm() {
    formRef.current?.reset();
    setChecked({});
    setQuantities({});
    setAmounts({});
    setTxAmount(initialTx ? Math.abs(initialTx.amount) : 0);
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

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-gray-200 bg-white p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Transactie (afschrijving)
        </label>
        <select
          name="transactionId"
          required
          defaultValue={initialTx?.id}
          onChange={(e) => {
            const opt = transactions.find((t) => t.id === e.target.value);
            const amount = opt ? Math.abs(opt.amount) : 0;
            setTxAmount(amount);
            recalcWeightedSplit(checked, quantities, amount);
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {transactions.map((tx) => (
            <option key={tx.id} value={tx.id}>
              {new Date(tx.booking_date).toLocaleDateString("nl-NL")} ·{" "}
              {tx.counterparty_name ?? "Onbekend"} · €{Math.abs(tx.amount).toFixed(2)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Wie deelt er mee (vink ook jezelf aan als je zelf ook een deel had)?{" "}
          {checkedCount > 1 &&
            "(bedrag wordt verdeeld o.b.v. aantal, pas zelf aan indien nodig)"}
        </label>
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
                        onChange={(e) => {
                          const nextChecked = { ...checked, [person.id]: e.target.checked };
                          const nextQuantities = {
                            ...quantities,
                            [person.id]: quantities[person.id] ?? "1",
                          };
                          setChecked(nextChecked);
                          setQuantities(nextQuantities);
                          recalcWeightedSplit(nextChecked, nextQuantities, txAmount);
                        }}
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
                        inputMode="numeric"
                        min="1"
                        step="1"
                        title="Aantal (bv. 2x een broodje)"
                        disabled={!checked[person.id]}
                        value={quantities[person.id] ?? "1"}
                        onChange={(e) => {
                          const nextQuantities = { ...quantities, [person.id]: e.target.value };
                          setQuantities(nextQuantities);
                          recalcWeightedSplit(checked, nextQuantities, txAmount);
                        }}
                        className="w-14 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                      />
                      <span className="text-xs text-gray-400">x</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        name={`amount_${person.id}`}
                        disabled={!checked[person.id]}
                        value={amounts[person.id] ?? ""}
                        onChange={(e) =>
                          setAmounts((prev) => ({ ...prev, [person.id]: e.target.value }))
                        }
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
        disabled={people.length === 0 || isPending}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : "Toevoegen"}
      </button>
    </form>
  );
}
