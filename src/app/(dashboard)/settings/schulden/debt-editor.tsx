"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDebt, deleteDebt, deletePart, saveDebt, savePart } from "@/actions/debts";

export interface EditorPart {
  id: string;
  name: string;
  balance: number;
  balance_date: string;
  rate: number;
  rate_fixed_until: string | null;
  is_gift: boolean;
  gift_inside?: boolean;
  repay_type?: "annuity" | "linear" | "interest_only";
  end_date?: string | null;
}

export interface EditorDebt {
  id: string;
  kind: string;
  name: string;
  repay_start: string | null;
  term_years: number;
  monthly_payment: number | null;
  gift_adjustment: number;
  property_value: number | null;
  debt_parts: EditorPart[];
}

const input =
  "box-border min-h-[48px] w-full min-w-0 max-w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 text-base";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm text-gray-500">{label}</span>
      {children}
    </label>
  );
}

export function AddDebtButtons({ hasDuo }: { hasDuo: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const add = (kind: "duo" | "mortgage" | "other", name: string) =>
    startTransition(async () => {
      await createDebt(kind, name);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      {!hasDuo && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => add("duo", "Studielening DUO")}
          className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-4 text-base font-medium text-gray-900 active:bg-gray-50 disabled:opacity-50"
        >
          + Studielening (DUO)
        </button>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => add("mortgage", "Hypotheek")}
        className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-4 text-base font-medium text-gray-900 active:bg-gray-50 disabled:opacity-50"
      >
        + Hypotheek
      </button>
    </div>
  );
}

function PartForm({ debt, part, onDone }: { debt: EditorDebt; part: EditorPart | null; onDone: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const mortgage = debt.kind === "mortgage";
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(part?.name ?? "");
  const [balance, setBalance] = useState(part ? String(part.balance) : "");
  const [balanceDate, setBalanceDate] = useState(part?.balance_date ?? today);
  const [rate, setRate] = useState(part ? String(part.rate) : "");
  const [fixedUntil, setFixedUntil] = useState(part?.rate_fixed_until ?? "");
  const [isGift, setIsGift] = useState(part?.is_gift ?? false);
  const [giftInside, setGiftInside] = useState(part?.gift_inside ?? false);
  const [repayType, setRepayType] = useState(part?.repay_type ?? "annuity");
  const [endDate, setEndDate] = useState(part?.end_date ?? "");

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await savePart(part?.id ?? null, debt.id, {
          name,
          balance: Number(balance.replace(",", ".")),
          balanceDate,
          rate: Number(rate.replace(",", ".")),
          rateFixedUntil: fixedUntil || null,
          isGift,
          giftInside,
          repayType,
          endDate: endDate || null,
        });
        onDone();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-xl bg-gray-50 p-4">
      <Field label="Naam">
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={mortgage ? "Openstaand bedrag" : "Schuld incl. rente"}>
          <input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} className={input} />
        </Field>
        <Field label="Rente (% per jaar)">
          <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className={input} />
        </Field>
        <Field label="Bedrag geldt per">
          <input type="date" value={balanceDate} onChange={(e) => setBalanceDate(e.target.value)} className={input} />
        </Field>
        <Field label="Rente vast tot">
          <input type="date" value={fixedUntil} onChange={(e) => setFixedUntil(e.target.value)} className={input} />
        </Field>
      </div>
      {mortgage ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Aflossingsvorm">
            <select
              value={repayType}
              onChange={(e) => setRepayType(e.target.value as typeof repayType)}
              className={input}
            >
              <option value="annuity">Annuïteit</option>
              <option value="linear">Lineair</option>
              <option value="interest_only">Aflossingsvrij</option>
            </select>
          </Field>
          <Field label="Einddatum lening">
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
          </Field>
        </div>
      ) : (
        <label className="flex min-h-[48px] items-center gap-3 text-base text-gray-900">
          <input
            type="checkbox"
            checked={isGift}
            onChange={(e) => setIsGift(e.target.checked)}
            className="h-6 w-6 accent-teal-700"
          />
          Wordt een gift (hoef ik niet terug te betalen)
        </label>
      )}
      {!mortgage && !isGift && (
        <label className="flex min-h-[48px] items-center gap-3 text-base text-gray-900">
          <input
            type="checkbox"
            checked={giftInside}
            onChange={(e) => setGiftInside(e.target.checked)}
            className="h-6 w-6 accent-teal-700"
          />
          Hierin zit prestatiebeurs die een gift wordt
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="min-h-[48px] flex-1 rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
        >
          Opslaan
        </button>
        {part && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirm("Dit onderdeel verwijderen?")) return;
              startTransition(async () => {
                await deletePart(part.id);
                onDone();
                router.refresh();
              });
            }}
            className="min-h-[48px] rounded-xl border border-red-200 px-4 text-base text-red-600 disabled:opacity-50"
          >
            Verwijderen
          </button>
        )}
        <button type="button" onClick={onDone} className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-700">
          Annuleren
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function DebtEditor({ debt }: { debt: EditorDebt }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null); // part id, "new", or null
  const mortgage = debt.kind === "mortgage";
  const [name, setName] = useState(debt.name);
  const [repayStart, setRepayStart] = useState(debt.repay_start ?? "");
  const [termYears, setTermYears] = useState(String(debt.term_years));
  const [monthly, setMonthly] = useState(debt.monthly_payment != null ? String(debt.monthly_payment) : "");
  const [gift, setGift] = useState(debt.gift_adjustment ? String(debt.gift_adjustment) : "");
  const [property, setProperty] = useState(debt.property_value != null ? String(debt.property_value) : "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveDebt(debt.id, {
          name,
          repayStart: repayStart || null,
          termYears: Number(termYears),
          monthlyPayment: monthly ? Number(monthly.replace(",", ".")) : null,
          giftAdjustment: gift ? Number(gift.replace(",", ".")) : 0,
          propertyValue: property ? Number(property.replace(",", ".")) : null,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
      }
    });
  }

  return (
    <details className="rounded-xl bg-gray-50 px-4">
      <summary className="flex min-h-[52px] cursor-pointer items-center text-base font-medium text-gray-700">
        Gegevens aanpassen
      </summary>
      <div className="space-y-4 pb-4">
        <div className="space-y-3">
          <Field label="Naam">
            <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </Field>
          {!mortgage && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Aflosfase begint op">
                <input type="date" value={repayStart} onChange={(e) => setRepayStart(e.target.value)} className={input} />
              </Field>
              <Field label="Looptijd (jaren)">
                <input inputMode="numeric" value={termYears} onChange={(e) => setTermYears(e.target.value)} className={input} />
              </Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={mortgage ? "Maandlast (leeg = berekend)" : "Maandbedrag van DUO (leeg = schatting)"}>
              <input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} className={input} />
            </Field>
            {mortgage ? (
              <Field label="Waarde woning">
                <input inputMode="decimal" value={property} onChange={(e) => setProperty(e.target.value)} className={input} />
              </Field>
            ) : (
              <Field label="Prestatiebeurs in de onderdelen hieronder (gift)">
                <input inputMode="decimal" value={gift} onChange={(e) => setGift(e.target.value)} className={input} />
              </Field>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={save}
              className="min-h-[48px] flex-1 rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
            >
              Opslaan
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (!confirm("Deze lening met alle onderdelen verwijderen?")) return;
                startTransition(async () => {
                  await deleteDebt(debt.id);
                  router.refresh();
                });
              }}
              className="min-h-[48px] rounded-xl border border-red-200 px-4 text-base text-red-600 disabled:opacity-50"
            >
              Verwijderen
            </button>
          </div>
          {saved && <p className="text-sm text-teal-700">Opgeslagen.</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">{mortgage ? "Leningdelen" : "Onderdelen"}</p>
          {debt.debt_parts.map((p) =>
            editing === p.id ? (
              <PartForm key={p.id} debt={debt} part={p} onDone={() => setEditing(null)} />
            ) : (
              <button
                key={p.id}
                type="button"
                onClick={() => setEditing(p.id)}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 text-left text-base active:bg-gray-50"
              >
                <span className="min-w-0 truncate text-gray-900">{p.name}</span>
                <span className="shrink-0 text-gray-500">wijzig</span>
              </button>
            )
          )}
          {editing === "new" ? (
            <PartForm debt={debt} part={null} onDone={() => setEditing(null)} />
          ) : (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-4 text-base font-medium text-gray-900 active:bg-gray-50"
            >
              + {mortgage ? "Leningdeel" : "Onderdeel"} toevoegen
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
