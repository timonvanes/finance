"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPotEntry,
  deletePot,
  deletePotEntry,
  setPotMonthlyPlan,
  updatePotMatchText,
  updatePotOpeningBalance,
  updatePotTarget,
} from "@/actions/pots";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

const input =
  "min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-4 text-base";
const primary =
  "min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50";
const label = "mb-1 block text-sm text-gray-500";

function useRun() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const router = useRouter();
  const run = (fn: () => Promise<string | void>) => {
    setMessage(null);
    startTransition(async () => {
      try {
        const text = await fn();
        if (text) setMessage({ text, error: false });
        router.refresh();
      } catch (e) {
        setMessage({ text: e instanceof Error ? e.message : "Er ging iets mis", error: true });
      }
    });
  };
  return { isPending, message, run };
}

const Message = ({ message }: { message: { text: string; error: boolean } | null }) =>
  message ? <p className={`text-sm ${message.error ? "text-red-600" : "text-teal-700"}`}>{message.text}</p> : null;

export function MonthlyPlanForm({
  potId,
  initial,
  auto,
  autoAmount,
  canAuto,
}: {
  potId: string;
  initial: number | null;
  auto: boolean;
  autoAmount: number | null;
  canAuto: boolean;
}) {
  const [mode, setMode] = useState<"auto" | "fixed">(canAuto && (auto || initial == null) ? "auto" : "fixed");
  const [value, setValue] = useState(initial != null ? String(initial) : "");
  const { isPending, message, run } = useRun();

  const unchanged =
    (mode === "auto" && auto) ||
    (mode === "fixed" && !auto && value === (initial != null ? String(initial) : ""));

  return (
    <div className="space-y-3">
      {canAuto ? (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["auto", "Automatisch"],
              ["fixed", "Vast bedrag"],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`min-h-[48px] rounded-xl text-base ring-1 ${
                mode === key ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-800 ring-gray-300"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Vul bij Doel een doelbedrag en een datum in, dan rekent de app het maandbedrag zelf uit.
        </p>
      )}

      {mode === "auto" && canAuto ? (
        <p className="rounded-xl bg-gray-50 p-4 text-base text-gray-700">
          {autoAmount != null
            ? `€${autoAmount} per maand — berekend uit je doelbedrag en doeldatum, en past zich aan naarmate je spaart.`
            : "Je hebt je doel al gehaald, of de doeldatum is voorbij."}
        </p>
      ) : (
        <div>
          <label className={label}>Bedrag per maand dat je wilt sparen</label>
          <label className="flex h-[52px] items-center gap-2 rounded-xl border border-gray-300 px-4">
            <span className="text-gray-400">€</span>
            <input
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Geen maandelijkse inleg"
              className="h-full min-w-0 flex-1 bg-transparent text-lg outline-none"
            />
          </label>
        </div>
      )}

      <button
        type="button"
        disabled={isPending || unchanged}
        onClick={() =>
          run(async () => {
            await setPotMonthlyPlan(potId, mode === "fixed" && value ? Number(value) : null, mode === "auto" && canAuto);
          })
        }
        className={primary}
      >
        {isPending ? "Bezig…" : "Opslaan"}
      </button>
      <Message message={message} />
    </div>
  );
}

export function EntryForm({ potId, hasTarget }: { potId: string; hasTarget: boolean }) {
  const [amount, setAmount] = useState("");
  const [spent, setSpent] = useState(false);
  const [spentAmount, setSpentAmount] = useState("");
  const [note, setNote] = useState("");
  const { isPending, message, run } = useRun();

  const submit = (direction: "deposit" | "withdraw") =>
    run(async () => {
      const value = Number(amount);
      if (!(value > 0)) throw new Error("Vul een bedrag in.");
      const goalSpendAmount =
        direction === "withdraw" && hasTarget
          ? spent
            ? Math.min(spentAmount ? Number(spentAmount) : value, value)
            : 0
          : undefined;
      await addPotEntry(potId, value, direction, note.trim() || null, goalSpendAmount);
      setAmount("");
      setSpent(false);
      setSpentAmount("");
      setNote("");
    });

  return (
    <div className="space-y-3">
      <label className="flex h-[52px] items-center gap-2 rounded-xl border border-gray-300 px-4">
        <span className="text-gray-400">€</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Bedrag"
          className="h-full min-w-0 flex-1 bg-transparent text-lg outline-none"
        />
      </label>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notitie (optioneel)"
        className={input}
      />
      {hasTarget && (
        <label className="flex min-h-[44px] items-center gap-3 text-base text-gray-700">
          <input type="checkbox" checked={spent} onChange={(e) => setSpent(e.target.checked)} />
          Bij opnemen: uitgegeven aan het doel (verlaagt het doelbedrag)
        </label>
      )}
      {hasTarget && spent && (
        <label className="flex h-[52px] items-center gap-2 rounded-xl border border-gray-300 px-4">
          <span className="text-sm text-gray-500">Waarvan voor het doel</span>
          <span className="text-gray-400">€</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={spentAmount}
            onChange={(e) => setSpentAmount(e.target.value)}
            placeholder="alles"
            className="h-full min-w-0 flex-1 bg-transparent text-right text-lg outline-none"
          />
        </label>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={isPending} onClick={() => submit("deposit")} className={`${primary} flex-1`}>
          Inleggen
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit("withdraw")}
          className="min-h-[52px] flex-1 rounded-xl border border-gray-300 text-base font-medium text-gray-900 active:bg-gray-50 disabled:opacity-50"
        >
          Opnemen
        </button>
      </div>
      <Message message={message} />
    </div>
  );
}

export function SettingsForms({
  potId,
  matchText,
  targetAmount,
  targetDate,
  openingBalance,
  openingBalanceDate,
}: {
  potId: string;
  matchText: string | null;
  targetAmount: number | null;
  targetDate: string | null;
  openingBalance: number;
  openingBalanceDate: string;
}) {
  const [match, setMatch] = useState(matchText ?? "");
  const [target, setTarget] = useState(targetAmount != null ? String(targetAmount) : "");
  const [tDate, setTDate] = useState(targetDate ?? "");
  const [opening, setOpening] = useState(String(openingBalance));
  const [oDate, setODate] = useState(openingBalanceDate);
  const match$ = useRun();
  const target$ = useRun();
  const opening$ = useRun();
  const del$ = useRun();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className={label}>Herkenningstekst</label>
        <input
          type="text"
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          placeholder="Leeg = de naam van het potje"
          className={input}
        />
        <button
          type="button"
          disabled={match$.isPending}
          onClick={() =>
            match$.run(async () => {
              const count = await updatePotMatchText(potId, match || null);
              return match ? `${count} eerdere transactie${count === 1 ? "" : "s"} gekoppeld.` : "Herkenning uitgezet.";
            })
          }
          className={primary}
        >
          Opslaan en oude transacties zoeken
        </button>
        <Message message={match$.message} />
      </div>

      <div className="space-y-2">
        <label className={label}>Doelbedrag</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="€ (optioneel)"
          className={input}
        />
        <label className={label}>Doeldatum</label>
        <input type="date" value={tDate} onChange={(e) => setTDate(e.target.value)} className={input} />
        <button
          type="button"
          disabled={target$.isPending}
          onClick={() => target$.run(async () => { await updatePotTarget(potId, target ? Number(target) : null, tDate || null); })}
          className={primary}
        >
          Doel opslaan
        </button>
        <Message message={target$.message} />
      </div>

      <div className="space-y-2">
        <label className={label}>Startbedrag</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
          className={input}
        />
        <label className={label}>Per datum</label>
        <input type="date" value={oDate} onChange={(e) => setODate(e.target.value)} className={input} />
        <button
          type="button"
          disabled={opening$.isPending}
          onClick={() => opening$.run(async () => { await updatePotOpeningBalance(potId, Number(opening) || 0, oDate); })}
          className={primary}
        >
          Startbedrag opslaan
        </button>
        <Message message={opening$.message} />
      </div>

      <button
        type="button"
        disabled={del$.isPending}
        onClick={() => {
          if (!confirm("Dit potje en alle bijbehorende inleg verwijderen?")) return;
          del$.run(async () => {
            await deletePot(potId);
            router.push("/pots");
          });
        }}
        className="min-h-[52px] w-full rounded-xl border border-red-200 text-base text-red-600 active:bg-red-50 disabled:opacity-50"
      >
        Potje verwijderen
      </button>
    </div>
  );
}

export function EntryList({
  entries,
}: {
  entries: { id: string; amount: number; note: string | null; entry_date: string; transaction_id: string | null; goal_spend?: string | null; goal_spend_amount?: number | null }[];
}) {
  const { isPending, run } = useRun();
  if (entries.length === 0) {
    return <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">Nog geen inleg of opname.</p>;
  }
  return (
    <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
      {entries.map((e) => (
        <li key={e.id} className="flex min-h-[60px] items-center justify-between gap-3 px-5 py-2">
          <div className="min-w-0">
            <p className="truncate text-base text-gray-900">
              {e.note ?? (e.transaction_id ? "Automatisch herkend" : e.amount >= 0 ? "Inleg" : "Opname")}
            </p>
            <p className="text-sm text-gray-500">
              {new Date(e.entry_date).toLocaleDateString("nl-NL")}
              {e.goal_spend === "yes" && ` · ${euro(Number(e.goal_spend_amount ?? Math.abs(e.amount)))} uitgegeven aan doel`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`text-base font-medium ${e.amount >= 0 ? "text-teal-700" : "text-gray-900"}`}>
              {e.amount >= 0 ? "+" : "−"}
              {euro(Math.abs(e.amount))}
            </span>
            <button
              type="button"
              disabled={isPending}
              aria-label="Verwijder regel"
              onClick={() => {
                if (!confirm("Deze regel verwijderen?")) return;
                run(async () => { await deletePotEntry(e.id); });
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 active:bg-gray-100 disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
