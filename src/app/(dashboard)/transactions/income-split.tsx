"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearSplit, linkPassthroughPayout, splitIncome, unlinkPassthroughPayout } from "@/actions/passthrough";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

interface Split {
  id: string;
  amount: number;
  personName: string;
  payoutId: string | null;
  payout: { booking_date: string; counterparty_name: string | null; amount: number } | null;
}

interface Outgoing {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
}

// For an incoming payment that is only partly yours (huurtoeslag shared with
// housemates): say who gets which part; the rest is yours.
export function IncomeSplit({
  transactionId,
  amount,
  people,
  splits,
  outgoing,
}: {
  transactionId: string;
  amount: number;
  people: { id: string; name: string }[];
  splits: Split[];
  outgoing: Outgoing[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [rentId, setRentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const chosen = Object.keys(selected);
  const others = chosen.reduce((s, id) => s + (Number(selected[id]) || 0), 0);
  const own = Math.round((amount - others) * 100) / 100;

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Er ging iets mis");
      }
    });
  }

  function togglePerson(id: string, on: boolean) {
    const next = { ...selected };
    if (on) next[id] = "";
    else delete next[id];
    // Equal parts between you and everyone selected, easy to adjust afterwards.
    const n = Object.keys(next).length;
    if (n > 0) {
      const part = (Math.floor((amount / (n + 1)) * 100) / 100).toFixed(2);
      for (const key of Object.keys(next)) next[key] = part;
    }
    setSelected(next);
  }

  if (splits.length > 0) {
    const passed = splits.reduce((s, x) => s + x.amount, 0);
    return (
      <div className="space-y-2 rounded-xl bg-teal-50 p-4 text-sm">
        <p className="font-medium text-teal-900">
          {euro(passed)} van dit bedrag is voor huisgenoten, {euro(amount - passed)} is voor jou.
        </p>
        <ul className="space-y-2">
          {splits.map((s) => (
            <li key={s.id} className="space-y-1 rounded-lg bg-white p-3 ring-1 ring-teal-100">
              <div className="flex items-center justify-between gap-3">
                <span className="text-base text-gray-900">{s.personName}</span>
                <span className="text-base font-semibold text-gray-900">{euro(s.amount)}</span>
              </div>
              {s.payoutId && s.payout ? (
                <div className="flex items-center justify-between gap-3 text-gray-500">
                  <span>
                    Overgemaakt op {new Date(s.payout.booking_date).toLocaleDateString("nl-NL")} (
                    {euro(Math.abs(s.payout.amount))})
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => unlinkPassthroughPayout(s.id))}
                    className="min-h-[44px] underline disabled:opacity-50"
                  >
                    Ontkoppel
                  </button>
                </div>
              ) : (
                <select
                  disabled={isPending}
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) run(() => linkPassthroughPayout(s.id, id));
                  }}
                  className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 disabled:opacity-50"
                >
                  <option value="" disabled>
                    Koppel jouw overboeking naar {s.personName}…
                  </option>
                  {[...outgoing]
                    .sort((a, b) => Math.abs(Math.abs(a.amount) - s.amount) - Math.abs(Math.abs(b.amount) - s.amount))
                    .slice(0, 30)
                    .map((tx) => (
                      <option key={tx.id} value={tx.id}>
                        {Math.abs(Math.abs(tx.amount) - s.amount) < 0.01 ? "✓ " : ""}
                        {new Date(tx.booking_date).toLocaleDateString("nl-NL")} · {tx.counterparty_name ?? "Onbekend"} ·{" "}
                        {euro(Math.abs(tx.amount))}
                      </option>
                    ))}
                </select>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirm("De verdeling van dit bedrag ongedaan maken?")) return;
            run(() => clearSplit(transactionId));
          }}
          className="min-h-[44px] text-sm text-gray-600 underline disabled:opacity-50"
        >
          Verdeling ongedaan maken
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[44px] self-start text-sm text-gray-500 underline"
      >
        Deel is voor huisgenoten (bijv. huurtoeslag)
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl bg-gray-50 p-4">
      <p className="text-sm text-gray-600">
        Kies wie een deel krijgt. Dat deel telt niet als jouw inkomen. Wat overblijft is voor jou.
      </p>
      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.id} className="flex min-h-[48px] items-center gap-3">
            <input
              type="checkbox"
              checked={p.id in selected}
              onChange={(e) => togglePerson(p.id, e.target.checked)}
              className="h-5 w-5 accent-teal-700"
            />
            <span className="flex-1 text-base text-gray-900">{p.name}</span>
            {p.id in selected && (
              <label className="flex h-[44px] w-28 items-center gap-1 rounded-xl border border-gray-300 bg-white px-2">
                <span className="text-gray-400">€</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={selected[p.id]}
                  onChange={(e) => setSelected({ ...selected, [p.id]: e.target.value })}
                  className="h-full w-full min-w-0 bg-transparent text-base outline-none"
                />
              </label>
            )}
          </li>
        ))}
      </ul>
      {chosen.length > 0 && (
        <p className={`text-sm ${own < 0 ? "font-medium text-red-600" : "text-gray-700"}`}>
          Voor jou blijft over: <span className="font-semibold">{euro(own)}</span>
        </p>
      )}
      {chosen.length > 0 && own > 0 && (
        <label className="block">
          <span className="mb-1 block text-sm text-gray-500">
            Jouw deel verrekenen met de huur (dan telt je huur als huur min dit deel)
          </span>
          <select
            value={rentId}
            onChange={(e) => setRentId(e.target.value)}
            className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900"
          >
            <option value="">Niet verrekenen, telt als inkomen</option>
            {outgoing.map((tx) => (
              <option key={tx.id} value={tx.id}>
                {new Date(tx.booking_date).toLocaleDateString("nl-NL")} · {tx.counterparty_name ?? "Onbekend"} ·{" "}
                {euro(Math.abs(tx.amount))}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending || chosen.length === 0 || own < 0}
          onClick={() =>
            run(() =>
              splitIncome(
                transactionId,
                chosen.map((id) => ({ personId: id, amount: Number(selected[id]) || 0 })),
                rentId || null
              )
            )
          }
          className="min-h-[48px] flex-1 rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
        >
          Opslaan
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-800"
        >
          Annuleren
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
