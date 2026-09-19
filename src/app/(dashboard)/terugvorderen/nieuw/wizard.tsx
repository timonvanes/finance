"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSplitReclaim } from "@/actions/reclaims";

interface Tx {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
}
interface Person {
  id: string;
  name: string;
  isSelf: boolean;
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
  const [checked, setChecked] = useState<Record<string, boolean>>({});
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

  const checkedIds = people.filter((p) => checked[p.id]).map((p) => p.id);
  // Anyone whose amount wasn't typed by hand shares what's left evenly.
  const typedIds = checkedIds.filter((id) => typed[id] !== undefined);
  const untypedIds = checkedIds.filter((id) => typed[id] === undefined);
  const typedSum = typedIds.reduce((s, id) => s + (Number(typed[id]) || 0), 0);
  const share = untypedIds.length > 0 ? Math.max(total - typedSum, 0) / untypedIds.length : 0;
  const amountFor = (id: string) =>
    typed[id] !== undefined ? Number(typed[id]) || 0 : share;
  const entered = checkedIds.reduce((s, id) => s + amountFor(id), 0);
  const othersChecked = people.some((p) => checked[p.id] && !p.isSelf);

  const filtered = filter
    ? transactions.filter((t) =>
        (t.counterparty_name ?? "").toLowerCase().includes(filter.toLowerCase())
      )
    : transactions;

  function togglePerson(id: string) {
    const next = !checked[id];
    setChecked((prev) => ({ ...prev, [id]: next }));
    if (!next) {
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
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
      }
    });
  }

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
          <h2 className="text-xl font-semibold text-gray-900">Wie deelt mee?</h2>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">Totaal van de afschrijving{txCount > 1 ? "en" : ""}</p>
            <p className="text-3xl font-semibold text-gray-900">{euro(total)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePerson(p.id)}
                className={`min-h-[48px] rounded-full px-5 text-base ring-1 ${
                  checked[p.id] ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-900 ring-gray-300"
                }`}
              >
                {p.isSelf ? "Jij" : p.name}
              </button>
            ))}
          </div>

          {checkedIds.length > 0 && (
            <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
              {people
                .filter((p) => checked[p.id])
                .map((p) => (
                  <li key={p.id} className="flex min-h-[64px] items-center gap-3 border-b border-gray-100 px-5 last:border-b-0">
                    <span className="flex-1 text-base text-gray-900">
                      {p.isSelf ? "Jij (eigen deel)" : p.name}
                    </span>
                    <span className="text-gray-400">€</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={typed[p.id] ?? share.toFixed(2)}
                      onChange={(e) => setTyped((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="min-h-[48px] w-28 rounded-xl border border-gray-300 px-3 text-right text-base"
                    />
                  </li>
                ))}
            </ul>
          )}

          {checkedIds.length > 0 && (
            <p className="text-center text-sm text-gray-500">
              Ingevuld {euro(entered)}
              {Math.abs(total - entered) > 0.01 && (
                <span className="text-amber-700">
                  {" "}
                  · {total > entered ? `nog ${euro(total - entered)} te verdelen` : `${euro(entered - total)} te veel`}
                </span>
              )}
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
