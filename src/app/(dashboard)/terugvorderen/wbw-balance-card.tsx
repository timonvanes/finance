"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addWbwSettlement, deleteWbwEntry, saveWbwBalance, setWbwListIncluded, syncWbwBalance } from "@/actions/wbw";
import type { WbwCandidate, WbwEntryRow } from "@/actions/wbw";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const today = () => new Date().toLocaleDateString("sv-SE");
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
const toNumber = (s: string) => Number(s.replace(",", "."));

export interface WbwStatus {
  periodLabel: string;
  configured: boolean;
  manual: boolean;
  lists: { id: string; name: string; currency: string; amount: number; included: boolean }[];
  latestBalance: number | null;
  latestDate: string | null;
  othersFrontedThisPeriod: number;
  entries: WbwEntryRow[];
  candidates: WbwCandidate[];
}

const toggle = (active: boolean, dark = false) =>
  `min-h-[48px] flex-1 rounded-xl text-base font-medium ring-1 ${
    active
      ? dark
        ? "bg-gray-900 text-white ring-gray-900"
        : "bg-teal-700 text-white ring-teal-700"
      : "bg-white text-gray-800 ring-gray-300"
  }`;

// Fill in your WieBetaaltWat saldo (net over all groups) on any day, as often
// as you like, and square up ("recht trekken") when money goes back and forth.
// What housemates fronted for you is worked out from those.
export function WbwBalanceCard({ status }: { status: WbwStatus }) {
  const router = useRouter();
  // Plain state, not a transition: a transition stays "pending" until the whole
  // page has reloaded, which kept the buttons on "Bezig…" long after the work
  // itself was done. The page refreshes in the background instead.
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sign, setSign] = useState<1 | -1>(status.latestBalance != null && status.latestBalance < 0 ? -1 : 1);
  const [amount, setAmount] = useState("");
  const [balanceDate, setBalanceDate] = useState(today());

  const [dir, setDir] = useState<"in" | "out">("in");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDate, setSettleDate] = useState(today());
  const [txId, setTxId] = useState("");

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    setPending(true);
    fn()
      .then((r) => {
        if (r.error) {
          setError(r.error);
          return;
        }
        after?.();
        router.refresh();
      })
      .catch(() => setError("Er ging iets mis. Probeer het opnieuw."))
      .finally(() => setPending(false));
  }

  function saveBalance() {
    const n = toNumber(amount);
    if (!Number.isFinite(n) || n < 0) {
      setError("Vul een geldig bedrag in.");
      return;
    }
    run(
      () => saveWbwBalance(sign * n, balanceDate),
      () => setAmount("")
    );
  }

  function saveSettlement() {
    const n = toNumber(settleAmount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Vul een geldig bedrag in.");
      return;
    }
    run(
      () => addWbwSettlement(dir === "in" ? n : -n, settleDate, txId || null),
      () => {
        setSettleAmount("");
        setTxId("");
      }
    );
  }

  const [syncNote, setSyncNote] = useState<string | null>(null);
  function syncNow() {
    setError(null);
    setSyncNote(null);
    const startedAt = Date.now();
    setPending(true);
    syncWbwBalance()
      .then((r) => {
        if ("error" in r) {
          setError(r.error);
          return;
        }
        setSyncNote(
          `Saldo opgehaald: ${euro(r.balance)} over ${r.lists} lijsten.` +
            (r.other.length > 0 ? ` Niet meegeteld (andere munt): ${r.other.join(", ")}.` : "") +
            (r.removed > 0 ? ` ${r.removed} terugvordering(en) verwijderd omdat de uitgave in WieBetaaltWat is verwijderd.` : "") +
            (r.imports
              ? ` Uitgaven: ${r.imports.imported} nieuw, ${r.imports.updated} bijgewerkt, ${r.imports.removed} verwijderd.`
              : "") +
            ` (${r.timings}, tot het antwoord er was ${((Date.now() - startedAt) / 1000).toFixed(1)}s)`
        );
        router.refresh();
      })
      .catch(() => setError("Saldo ophalen mislukt. Probeer het opnieuw."))
      .finally(() => setPending(false));
  }

  // Filling in by hand is only needed without the link with WieBetaaltWat, or when
  // it is switched on (Instellingen > Bankkoppelingen) because the link stopped working.
  const showManual = !status.configured || status.manual;

  const candidates = status.candidates.filter((c) => (dir === "in" ? c.amount > 0 : c.amount < 0));

  return (
    <details className="rounded-2xl bg-white ring-1 ring-gray-200">
      <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-3 px-5 [&::-webkit-details-marker]:hidden">
        <span className="text-base font-medium text-gray-900">WieBetaaltWat</span>
        <span className="flex items-center gap-2">
          {status.latestBalance != null && (
            <span className="text-base text-gray-600">{euro(status.latestBalance)}</span>
          )}
          <span className="text-2xl text-gray-300">›</span>
        </span>
      </summary>

      <div className="space-y-5 border-t border-gray-100 p-5">
        <p className="text-sm text-gray-500">
          Door huisgenoten voorgeschoten in {status.periodLabel}:{" "}
          <span className="font-medium text-gray-900">{euro(status.othersFrontedThisPeriod)}</span>
          {status.latestDate && <> (op basis van je saldo van {shortDate(status.latestDate)})</>}
        </p>

        {status.configured && (
          <section className="space-y-2">
            <button
              type="button"
              disabled={isPending}
              onClick={syncNow}
              className="min-h-[48px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
            >
              {isPending ? "Bezig…" : "Saldo ophalen uit WieBetaaltWat"}
            </button>
            {syncNote && <p className="text-sm text-teal-700">{syncNote}</p>}
            <p className="text-sm text-gray-500">
              Haalt je saldo van al je lijsten op (alleen lezen) en slaat het op als het saldo van vandaag. Dit gebeurt
              ook elke dag automatisch.
            </p>
          </section>
        )}

        {status.configured && status.lists.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-base font-medium text-gray-900">Lijsten die meetellen</h3>
            <p className="text-sm text-gray-500">
              Haal een lijst uit je saldo, bijvoorbeeld een testlijst of een oude vakantie. Lijsten in een andere munt
              tellen niet mee.
            </p>
            <ul className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-200">
              {status.lists.map((l) => {
                const foreign = l.currency !== "EUR";
                return (
                  <li key={l.id}>
                    <label className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-base text-gray-900">{l.name}</span>
                        <span className="block text-sm text-gray-500">
                          {foreign
                            ? `${l.currency} ${l.amount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })} · andere munt`
                            : euro(l.amount)}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={l.included && !foreign}
                        disabled={isPending || foreign}
                        onChange={(e) => run(() => setWbwListIncluded(l.id, e.target.checked))}
                        className="h-6 w-6 shrink-0 accent-teal-700"
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {status.configured && (
          <p className="text-sm text-gray-500">
            Uitgaven inladen als transacties, de startdatum en welke lijsten meetellen stel je in bij Instellingen &gt;
            Bankkoppelingen.
          </p>
        )}

        {showManual ? (
          <>
        <section className="space-y-3 border-t border-gray-100 pt-5">
          <h3 className="text-base font-medium text-gray-900">
            {status.configured ? "Of zelf invullen" : "Saldo invullen"}
          </h3>
          <p className="text-sm text-gray-500">
            Op elke dag, zo vaak je wilt. Vul op de eerste dag van je maand in, dan sluit de vorige maand precies af.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSign(1)} className={toggle(sign === 1)}>
              Ik krijg nog
            </button>
            <button type="button" onClick={() => setSign(-1)} className={toggle(sign === -1, true)}>
              Ik moet nog
            </button>
          </div>
          <div className="flex gap-2">
            <label className="flex h-[52px] min-w-0 flex-1 items-center gap-1 rounded-xl border border-gray-300 bg-white px-3">
              <span className="text-gray-400">€</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="h-full w-full min-w-0 bg-transparent text-lg outline-none"
              />
            </label>
            <input
              type="date"
              value={balanceDate}
              max={today()}
              onChange={(e) => setBalanceDate(e.target.value)}
              className="h-[52px] w-[150px] shrink-0 rounded-xl border border-gray-300 bg-white px-3 text-base"
            />
          </div>
          <button
            type="button"
            disabled={isPending || !amount || !balanceDate}
            onClick={saveBalance}
            className="min-h-[48px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Bezig…" : "Saldo opslaan"}
          </button>
        </section>

        <section className="space-y-3 border-t border-gray-100 pt-5">
          <h3 className="text-base font-medium text-gray-900">Recht trekken</h3>
          <p className="text-sm text-gray-500">
            Heb je met iemand afgerekend (Tikkie of overboeking), dan verandert je saldo zonder dat het een kost is.
            Leg het hier vast, geheel of gedeeltelijk.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDir("in");
                setTxId("");
              }}
              className={toggle(dir === "in")}
            >
              Ik ontving
            </button>
            <button
              type="button"
              onClick={() => {
                setDir("out");
                setTxId("");
              }}
              className={toggle(dir === "out", true)}
            >
              Ik betaalde
            </button>
          </div>
          <select
            value={txId}
            onChange={(e) => {
              const id = e.target.value;
              setTxId(id);
              const c = status.candidates.find((x) => x.id === id);
              if (c) {
                setSettleAmount(String(Math.abs(c.amount)).replace(".", ","));
                setSettleDate(c.date);
              }
            }}
            className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900"
          >
            <option value="">Koppel bankbetaling (aanbevolen)…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {shortDate(c.date)} · {c.name} · {euro(c.amount)}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <label className="flex h-[52px] min-w-0 flex-1 items-center gap-1 rounded-xl border border-gray-300 bg-white px-3">
              <span className="text-gray-400">€</span>
              <input
                type="text"
                inputMode="decimal"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="0,00"
                className="h-full w-full min-w-0 bg-transparent text-lg outline-none"
              />
            </label>
            <input
              type="date"
              value={settleDate}
              max={today()}
              onChange={(e) => setSettleDate(e.target.value)}
              className="h-[52px] w-[150px] shrink-0 rounded-xl border border-gray-300 bg-white px-3 text-base"
            />
          </div>
          <button
            type="button"
            disabled={isPending || !settleAmount || !settleDate}
            onClick={saveSettlement}
            className="min-h-[48px] w-full rounded-xl border border-gray-300 text-base font-medium text-gray-900 active:bg-gray-50 disabled:opacity-50"
          >
            Recht trekken vastleggen
          </button>
          {txId && (
            <p className="text-sm text-gray-500">
              De gekoppelde bankbetaling wordt een overboeking en telt niet meer als inkomen of uitgave.
            </p>
          )}
        </section>

        {status.entries.length > 0 && (
          <section className="space-y-2 border-t border-gray-100 pt-5">
            <h3 className="text-base font-medium text-gray-900">Eerder ingevuld</h3>
            <ul className="divide-y divide-gray-100">
              {status.entries.map((e) => (
                <li key={e.id} className="flex min-h-[48px] items-center justify-between gap-3 py-1">
                  <span className="min-w-0 text-sm text-gray-700">
                    <span className="text-gray-500">{shortDate(e.date)}</span>{" "}
                    {e.kind === "balance"
                      ? `Saldo ${euro(e.amount)}`
                      : `${e.amount > 0 ? "Ontvangen" : "Betaald"} ${euro(Math.abs(e.amount))}${
                          e.transactionName ? ` · ${e.transactionName}` : ""
                        }`}
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (!confirm("Deze invulling verwijderen?")) return;
                      run(() => deleteWbwEntry(e.id));
                    }}
                    className="min-h-[44px] shrink-0 px-2 text-sm font-medium text-red-600 disabled:opacity-50"
                  >
                    Wis
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

          </>
        ) : (
          <p className="border-t border-gray-100 pt-4 text-sm text-gray-500">
            Je saldo wordt automatisch opgehaald. Zelf invullen kun je weer aanzetten bij Instellingen &gt; Bankkoppelingen
            als WieBetaaltWat het ophalen blokkeert.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {error && status.configured && !status.manual && (
          <p className="text-sm text-gray-500">
            Lukt het ophalen niet meer? Zet zelf invullen aan bij Instellingen &gt; Bankkoppelingen.
          </p>
        )}
      </div>
    </details>
  );
}
