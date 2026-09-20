"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSplitReclaim } from "@/actions/reclaims";
import { TxDetails } from "../tx-details";

interface Tx {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
  raw_description: string | null;
  counterparty_iban: string | null;
}
interface Person {
  id: string;
  name: string;
  isSelf: boolean;
  groupName: string | null;
}

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export function Wizard({
  transactions,
  people,
  initialTransactionId,
}: {
  transactions: Tx[];
  people: Person[];
  initialTransactionId?: string;
}) {
  const [step, setStep] = useState(initialTransactionId ? 2 : 1);
  const [selectedTx, setSelectedTx] = useState<Record<string, boolean>>(
    initialTransactionId ? { [initialTransactionId]: true } : {}
  );
  const [filter, setFilter] = useState("");
  const [shares, setShares] = useState<Record<string, number>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<"bank" | "external_app">("bank");
  const [note, setNote] = useState("");
  const [sharedCode, setSharedCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const total = transactions
    .filter((t) => selectedTx[t.id])
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const txCount = Object.values(selectedTx).filter(Boolean).length;

  const checkedIds = people.filter((p) => (shares[p.id] ?? 0) > 0).map((p) => p.id);
  // Amounts typed by hand stay fixed; the rest is divided over the remaining
  // people by their number of shares (WBW-style "Aandelen").
  const fixedIds = checkedIds.filter((id) => typed[id] !== undefined);
  const flexIds = checkedIds.filter((id) => typed[id] === undefined);
  const fixedSum = fixedIds.reduce((s, id) => s + (Number(typed[id]) || 0), 0);
  const flexShares = flexIds.reduce((s, id) => s + (shares[id] ?? 0), 0);
  const rest = Math.max(total - fixedSum, 0);
  const amountFor = (id: string) => {
    if ((shares[id] ?? 0) <= 0) return 0;
    if (typed[id] !== undefined) return Number(typed[id]) || 0;
    return flexShares > 0 ? (rest * (shares[id] ?? 0)) / flexShares : 0;
  };
  const entered = checkedIds.reduce((s, id) => s + amountFor(id), 0);
  const othersChecked = people.some((p) => (shares[p.id] ?? 0) > 0 && !p.isSelf);
  const selectedTransactions = transactions.filter((t) => selectedTx[t.id]);

  const filtered = filter
    ? transactions.filter((t) =>
        (t.counterparty_name ?? "").toLowerCase().includes(filter.toLowerCase())
      )
    : transactions;

  function changeShares(id: string, delta: number) {
    const next = Math.max((shares[id] ?? 0) + delta, 0);
    setShares((prev) => ({ ...prev, [id]: next }));
    if (next === 0) {
      setTyped((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  }

  function submit() {
    setError(null);
    const fd = new FormData();
    transactions.filter((t) => selectedTx[t.id]).forEach((t) => fd.append("transactionId", t.id));
    checkedIds.forEach((id) => {
      fd.append("personId", id);
      fd.set(`amount_${id}`, amountFor(id).toFixed(2));
    });
    fd.set("settlementMethod", method);
    fd.set("tikkieLink", note);
    if (sharedCode && checkedIds.length > 1) fd.set("sharedCode", "on");
    startTransition(async () => {
      try {
        await createSplitReclaim(fd);
        router.push("/terugvorderen");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
      }
    });
  }

  // You first, then people per group (with a "hele groep" shortcut each).
  const sections = (() => {
    const result: { name: string | null; people: Person[] }[] = [];
    const self = people.filter((p) => p.isSelf);
    if (self.length > 0) result.push({ name: null, people: self });
    const byGroup = new Map<string, Person[]>();
    for (const p of people.filter((x) => !x.isSelf)) {
      const key = p.groupName ?? "Overig";
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(p);
    }
    [...byGroup.entries()]
      .sort(([a], [b]) => (a === "Overig" ? 1 : b === "Overig" ? -1 : a.localeCompare(b)))
      .forEach(([name, list]) => result.push({ name, people: list }));
    return result;
  })();

  function setGroupShares(list: Person[], count: number) {
    setShares((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.id, count])) }));
    if (count === 0) {
      setTyped((prev) => {
        const copy = { ...prev };
        list.forEach((p) => delete copy[p.id]);
        return copy;
      });
    }
  }

  const renderPerson = (p: Person) => {
      const count = shares[p.id] ?? 0;
      const active = count > 0;
      return (
        <li key={p.id} className="flex min-h-[60px] items-center gap-2">
          <span
            className={`min-w-0 flex-1 truncate text-base ${active ? "font-medium text-gray-900" : "text-gray-400"}`}
          >
            {p.isSelf ? "Jij" : p.name}
          </span>
          <div className="flex shrink-0 items-center overflow-hidden rounded-xl bg-gray-100">
            <button
              type="button"
              aria-label={`Minder aandelen voor ${p.name}`}
              disabled={!active}
              onClick={() => changeShares(p.id, -1)}
              className="flex h-12 w-11 items-center justify-center text-xl text-gray-700 disabled:opacity-30"
            >
              −
            </button>
            <span className={`w-10 text-center text-base ${active ? "text-gray-900" : "text-gray-400"}`}>
              {count}x
            </span>
            <button
              type="button"
              aria-label={`Meer aandelen voor ${p.name}`}
              onClick={() => changeShares(p.id, 1)}
              className="flex h-12 w-11 items-center justify-center text-xl text-blue-600"
            >
              +
            </button>
          </div>
          <div className="flex h-12 w-28 shrink-0 items-center gap-1 rounded-xl bg-gray-100 px-3">
            <span className="text-gray-400">€</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              disabled={!active}
              value={active ? (typed[p.id] ?? amountFor(p.id).toFixed(2)) : ""}
              placeholder="0,00"
              onChange={(e) => setTyped((prev) => ({ ...prev, [p.id]: e.target.value }))}
              className="w-full bg-transparent text-right text-base text-gray-900 outline-none disabled:text-gray-400"
            />
          </div>
        </li>
      );
  };

  const primary =
    "min-h-[56px] w-full rounded-2xl bg-gray-900 text-lg font-medium text-white active:bg-gray-700 disabled:opacity-40";
  const secondary =
    "min-h-[52px] w-full rounded-2xl text-base text-gray-600 active:bg-gray-100";

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Stap {step} van 3</p>

      {step === 1 && (
        <>
          <h2 className="text-xl font-semibold text-gray-900">Welke afschrijvingen?</h2>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Zoek op naam…"
            className="min-h-[52px] w-full rounded-2xl border border-gray-300 px-4 text-base"
          />
          <ul className="space-y-2">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedTx((p) => ({ ...p, [t.id]: !p[t.id] }))}
                  className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 ${
                    selectedTx[t.id] ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-900 ring-gray-200"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium">
                      {t.counterparty_name ?? "Onbekend"}
                    </span>
                    <span className={`block text-sm ${selectedTx[t.id] ? "text-gray-300" : "text-gray-500"}`}>
                      {new Date(t.booking_date).toLocaleDateString("nl-NL")}
                    </span>
                  </span>
                  <span className="text-base font-semibold">{euro(Math.abs(t.amount))}</span>
                </button>
                <TxDetails
                  label="Details"
                  tx={{
                    name: t.counterparty_name,
                    date: t.booking_date,
                    amount: t.amount,
                    description: t.raw_description,
                    iban: t.counterparty_iban,
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="sticky bottom-0 space-y-2 bg-gray-50 pb-3 pt-2">
            {txCount > 0 && (
              <p className="text-center text-base text-gray-700">
                {txCount} geselecteerd · totaal <span className="font-semibold">{euro(total)}</span>
              </p>
            )}
            <button type="button" disabled={txCount === 0} onClick={() => setStep(2)} className={primary}>
              Verder
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <ul className="space-y-2">
            {selectedTransactions.map((t) => (
              <li key={t.id} className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-gray-900">
                      {t.counterparty_name ?? "Onbekend"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(t.booking_date).toLocaleDateString("nl-NL")}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-semibold text-gray-900">{euro(Math.abs(t.amount))}</p>
                </div>
                <TxDetails
                  tx={{
                    name: t.counterparty_name,
                    date: t.booking_date,
                    amount: t.amount,
                    description: t.raw_description,
                    iban: t.counterparty_iban,
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between rounded-2xl bg-white px-5 py-4 ring-1 ring-gray-200">
            <span className="text-sm text-gray-500">Totaal</span>
            <span className="text-3xl font-semibold text-gray-900">{euro(total)}</span>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Verdeel ({checkedIds.length})</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShares(Object.fromEntries(people.map((p) => [p.id, 1])))}
                className="min-h-[44px] rounded-xl bg-gray-100 px-4 text-sm font-medium text-gray-700"
              >
                Iedereen
              </button>
              <button
                type="button"
                onClick={() => {
                  setShares({});
                  setTyped({});
                }}
                className="min-h-[44px] rounded-xl bg-gray-100 px-4 text-sm font-medium text-blue-600"
              >
                Wissen
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {sections.map((section) => (
              <section key={section.name ?? "self"} className="space-y-1">
                {section.name && (
                  <div className="flex items-center justify-between pt-1">
                    <h3 className="text-sm font-medium text-gray-500">{section.name}</h3>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setGroupShares(section.people, 1)}
                        className="min-h-[44px] rounded-xl bg-gray-100 px-3 text-sm font-medium text-gray-700 active:bg-gray-200"
                      >
                        Hele groep
                      </button>
                      <button
                        type="button"
                        onClick={() => setGroupShares(section.people, 0)}
                        className="min-h-[44px] px-3 text-sm text-blue-600"
                      >
                        Wissen
                      </button>
                    </div>
                  </div>
                )}
                <ul className="space-y-2">{section.people.map(renderPerson)}</ul>
              </section>
            ))}
          </div>

          {checkedIds.length > 0 && Math.abs(total - entered) > 0.01 && (
            <p className="text-center text-sm text-amber-700">
              {total > entered ? `Nog ${euro(total - entered)} te verdelen` : `${euro(entered - total)} te veel verdeeld`}
            </p>
          )}

          <div className="sticky bottom-0 space-y-1 bg-gray-50 pb-3 pt-2">
            <button type="button" disabled={!othersChecked} onClick={() => setStep(3)} className={primary}>
              Verder
            </button>
            <button type="button" onClick={() => setStep(1)} className={secondary}>
              Terug
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="text-xl font-semibold text-gray-900">Hoe komt dit terug?</h2>
          <div className="grid grid-cols-1 gap-3">
            {(
              [
                ["bank", "Bank of Tikkie", "Wordt automatisch herkend als de betaling binnenkomt"],
                ["external_app", "WieBetaaltWat / andere app", "Je vinkt het zelf af als het gezet is"],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                className={`min-h-[72px] rounded-2xl px-5 py-3 text-left ring-1 ${
                  method === value ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-900 ring-gray-200"
                }`}
              >
                <span className="block text-base font-medium">{label}</span>
                <span className={`block text-sm ${method === value ? "text-gray-300" : "text-gray-500"}`}>{hint}</span>
              </button>
            ))}
          </div>

          {method === "external_app" && (
            <p className="rounded-2xl bg-amber-50 p-4 text-base text-amber-900 ring-1 ring-amber-200">
              Voer {euro(total)} in bij WieBetaaltWat.
            </p>
          )}

          {method === "bank" && checkedIds.filter((id) => !people.find((p) => p.id === id)?.isSelf).length > 1 && (
            <label className="flex min-h-[52px] items-center gap-3 text-base text-gray-700">
              <input type="checkbox" checked={sharedCode} onChange={(e) => setSharedCode(e.target.checked)} className="h-6 w-6" />
              Zelfde code voor iedereen
            </label>
          )}

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tikkie-link of notitie (optioneel)"
            className="min-h-[52px] w-full rounded-2xl border border-gray-300 px-4 text-base"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="sticky bottom-0 space-y-1 bg-gray-50 pb-3 pt-2">
            <button type="button" disabled={isPending} onClick={submit} className={primary}>
              {isPending ? "Bezig…" : "Toevoegen"}
            </button>
            <button type="button" onClick={() => setStep(2)} className={secondary}>
              Terug
            </button>
          </div>
        </>
      )}
    </div>
  );
}
