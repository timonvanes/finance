"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPotValueCheckMonths, updatePotValue } from "@/actions/pots";
import { parseDegiroPortfolio, type ParsedPortfolio } from "@/lib/degiro-csv";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const dateText = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

// Sets the value of an investment pot from the portfolio export of the broker (DEGIRO has no
// API). The file is read in the browser: only the total goes to the server.
export function ShareImport({
  potId,
  balance,
  everyMonths,
  lastChecked,
  nextDue,
  due,
}: {
  potId: string;
  balance: number;
  everyMonths: number | null;
  lastChecked: string | null;
  nextDue: string | null;
  due: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedPortfolio | null>(null);
  const [fileName, setFileName] = useState("");
  const [withCash, setWithCash] = useState(true);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    setDone(null);
    setError(null);
    if (!file) return;
    setFileName(file.name);
    setParsed(parseDegiroPortfolio(await file.text()));
  }

  const total = parsed?.ok ? Math.round((parsed.stocksTotal + (withCash ? parsed.cashTotal : 0)) * 100) / 100 : 0;

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div>
        <h2 className="text-base font-medium text-gray-900">Waarde bijwerken uit je portefeuille</h2>
        <p className="text-sm text-gray-500">
          DEGIRO heeft geen koppeling, dus je zet de waarde zelf bij met een export. Op de computer: Portefeuille, dan exporteren, en kies CSV. Het bestand wordt alleen in je browser gelezen; er wordt alleen het totaalbedrag opgeslagen.
        </p>
      </div>

      <div className={`rounded-xl px-4 py-3 text-sm ${due ? "bg-amber-50 text-amber-900" : "bg-gray-50 text-gray-700"}`}>
        {lastChecked ? `Laatst bijgewerkt op ${dateText(lastChecked)}.` : "Nog niet bijgewerkt met een export."}
        {everyMonths ? (due ? " Het is tijd om het bij te werken." : nextDue ? ` Volgende keer uiterlijk ${dateText(nextDue)}.` : "") : " Geen herinnering ingesteld."}
      </div>

      <div className="space-y-2">
        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="min-h-[48px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800"
        >
          {fileName ? "Ander bestand kiezen" : "CSV-bestand kiezen"}
        </button>
        {fileName && <p className="text-xs text-gray-500">{fileName}</p>}
      </div>

      {parsed && !parsed.ok && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{parsed.error}</p>}

      {parsed?.ok && (
        <div className="space-y-3">
          <ul className="max-h-56 divide-y divide-gray-100 overflow-auto rounded-xl bg-gray-50 px-3">
            {parsed.positions
              .filter((p) => withCash || !p.cash)
              .map((p, i) => (
                <li key={`${p.product}-${i}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-gray-700">{p.product}</span>
                  <span className="shrink-0 font-medium text-gray-900">{euro(p.value)}</span>
                </li>
              ))}
          </ul>
          {parsed.cashTotal !== 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={withCash} onChange={(e) => setWithCash(e.target.checked)} className="h-5 w-5" />
              Geld op je beleggingsrekening ({euro(parsed.cashTotal)}) telt mee
            </label>
          )}
          <div className="flex items-baseline justify-between rounded-xl bg-teal-50 px-4 py-3">
            <span className="text-sm text-teal-900">Nieuwe waarde (nu {euro(balance)})</span>
            <span className="text-lg font-semibold text-teal-900">{euro(total)}</span>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await updatePotValue(potId, total);
                if (r.error) {
                  setError(r.error);
                  return;
                }
                setDone(`De waarde staat nu op ${euro(total)}.`);
                setParsed(null);
                setFileName("");
                router.refresh();
              })
            }
            className="min-h-[48px] w-full rounded-xl border border-teal-700 bg-white text-base font-medium text-teal-800 active:bg-teal-50 disabled:opacity-50"
          >
            {pending ? "Bezig…" : `Waarde zetten op ${euro(total)}`}
          </button>
          <p className="text-xs text-gray-500">Het verschil met nu telt als waardeverandering, niet als storting. Je maandbedrag en Tikkie veranderen er niet door.</p>
        </div>
      )}

      {done && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{done}</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <label className="block space-y-1">
        <span className="text-sm text-gray-700">Herinner me om dit bij te werken</span>
        <select
          defaultValue={everyMonths ?? ""}
          onChange={(e) =>
            start(async () => {
              await setPotValueCheckMonths(potId, e.target.value ? Number(e.target.value) : null);
              router.refresh();
            })
          }
          className="box-border min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
        >
          <option value="">Geen herinnering</option>
          <option value="3">Elk kwartaal</option>
          <option value="6">Elk half jaar</option>
          <option value="12">Elk jaar</option>
        </select>
      </label>
    </section>
  );
}
