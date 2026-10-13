import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMonthStartDay } from "@/lib/settings";
import { isoDate, periodRange } from "@/lib/month";
import { buildStatement, isIsoDate, type CategoryGroup } from "@/lib/statement";
import { PrintButton } from "../../print-button";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

const PRESETS = [
  { value: "maand", label: "Deze maand" },
  { value: "vorige", label: "Vorige maand" },
  { value: "jaar", label: "Dit jaar" },
  { value: "vorigjaar", label: "Vorig jaar" },
  { value: "aangepast", label: "Zelf kiezen" },
] as const;

function resolvePeriod(preset: string, startDay: number, van?: string, tot?: string) {
  const now = new Date();
  if (preset === "vorige" || preset === "maand") {
    const r = periodRange(preset === "vorige" ? 1 : 0, startDay);
    const lastDay = new Date(r.endDate.getFullYear(), r.endDate.getMonth(), r.endDate.getDate() - 1);
    return { from: r.start, to: isoDate(lastDay), title: `${MONTHS[r.labelDate.getMonth()]} ${r.labelDate.getFullYear()}` };
  }
  if (preset === "jaar" || preset === "vorigjaar") {
    const y = now.getFullYear() - (preset === "vorigjaar" ? 1 : 0);
    return { from: `${y}-01-01`, to: `${y}-12-31`, title: `Jaaroverzicht ${y}` };
  }
  if (isIsoDate(van) && isIsoDate(tot) && van <= tot) {
    return {
      from: van,
      to: tot,
      title: `${new Date(van).toLocaleDateString("nl-NL")} t/m ${new Date(tot).toLocaleDateString("nl-NL")}`,
    };
  }
  return null;
}

function Groups({ groups, showTx, positive }: { groups: CategoryGroup[]; showTx: boolean; positive: boolean }) {
  return (
    <ul className="divide-y divide-gray-100">
      {groups.map((g) => (
        <li key={g.name}>
          {showTx ? (
            <details open className="group">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 py-2 [&::-webkit-details-marker]:hidden">
                <span className="font-medium text-gray-900">{g.name}</span>
                <span className="font-semibold text-gray-900">{euro(g.total)}</span>
              </summary>
              <ul className="mb-2 space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-sm print:bg-transparent">
                {g.transactions.map((tx) => (
                  <li key={tx.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-gray-700">
                      <span className="text-gray-400">{new Date(tx.date).toLocaleDateString("nl-NL")}</span> {tx.name}
                    </span>
                    <span className="shrink-0 text-gray-900">{positive ? "" : "−"}{euro(tx.amount)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <div className="flex min-h-[48px] items-center justify-between gap-3 py-2">
              <span className="text-gray-900">{g.name}</span>
              <span className="font-medium text-gray-900">{euro(g.total)}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function RapportPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; van?: string; tot?: string; w?: string }>;
}) {
  const { p, van, tot, w } = await searchParams;
  const preset = PRESETS.some((x) => x.value === p) ? p! : "maand";
  const view = w === "transacties" ? "transacties" : "categorie";
  const startDay = await getMonthStartDay();
  const period = resolvePeriod(preset, startDay, van, tot);

  const supabase = await createClient();
  const statement = period ? await buildStatement(supabase, period.from, period.to) : null;
  const longRange = period ? (Date.parse(period.to) - Date.parse(period.from)) / 86_400_000 > 45 : false;
  const nameOfMonth = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 print:hidden">
        <Link
          href="/settings"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Baten en lasten</h1>
      </div>

      <form method="get" className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200 print:hidden">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-500">Periode</span>
          <select
            name="p"
            defaultValue={preset}
            className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
          >
            {PRESETS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3 [&_input]:min-w-0 [&_label]:min-w-0">
          <label className="block">
            <span className="mb-1 block text-sm text-gray-500">Van (bij zelf kiezen)</span>
            <input
              type="date"
              name="van"
              defaultValue={van ?? ""}
              className="box-border min-h-[52px] w-full min-w-0 max-w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 text-base"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-500">Tot en met</span>
            <input
              type="date"
              name="tot"
              defaultValue={tot ?? ""}
              className="box-border min-h-[52px] w-full min-w-0 max-w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 text-base"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-500">Weergave</span>
          <select
            name="w"
            defaultValue={view}
            className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
          >
            <option value="categorie">Per categorie</option>
            <option value="transacties">Alle transacties per categorie</option>
          </select>
        </label>
        <button
          type="submit"
          className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800"
        >
          Toon rapport
        </button>
      </form>

      {!period || !statement ? (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Kies een geldige periode: bij &quot;Zelf kiezen&quot; vul je beide datums in.
        </p>
      ) : (
        <>
          <div className="space-y-5 rounded-2xl bg-white p-5 ring-1 ring-gray-200 print:ring-0">
            <div>
              <p className="text-xl font-semibold text-gray-900">Baten en lasten</p>
              <p className="text-base capitalize text-gray-600">{period.title}</p>
              <p className="text-sm text-gray-400">
                {new Date(period.from).toLocaleDateString("nl-NL")} t/m {new Date(period.to).toLocaleDateString("nl-NL")}
              </p>
            </div>

            <div>
              <h2 className="mb-1 flex items-baseline justify-between text-lg font-semibold text-gray-900">
                <span>Baten</span>
                <span className="text-green-700">{euro(statement.totalIncome)}</span>
              </h2>
              {statement.income.length > 0 ? (
                <Groups groups={statement.income} showTx={view === "transacties"} positive />
              ) : (
                <p className="text-sm text-gray-500">Geen baten in deze periode.</p>
              )}
            </div>

            <div>
              <h2 className="mb-1 flex items-baseline justify-between text-lg font-semibold text-gray-900">
                <span>Lasten</span>
                <span>{euro(statement.totalExpense)}</span>
              </h2>
              {statement.expense.length > 0 ? (
                <Groups groups={statement.expense} showTx={view === "transacties"} positive={false} />
              ) : (
                <p className="text-sm text-gray-500">Geen lasten in deze periode.</p>
              )}
            </div>

            {Math.abs(statement.reserved) > 0.5 && (
              <div>
                <h2 className="flex items-baseline justify-between text-lg font-semibold text-gray-900">
                  <span>Gereserveerd in potjes</span>
                  <span className="text-teal-700">{euro(statement.reserved)}</span>
                </h2>
                <p className="text-sm text-gray-500">Geld dat je hebt opzij gezet, dus niet uitgegeven.</p>
              </div>
            )}

            <div className="flex items-baseline justify-between border-t-2 border-gray-900 pt-3">
              <span className="text-lg font-semibold text-gray-900">
                {statement.net >= 0 ? "Netto over na potjes" : "Netto te veel uitgegeven"}
              </span>
              <span className={`text-2xl font-semibold ${statement.net >= 0 ? "text-green-700" : "text-red-600"}`}>
                {euro(Math.abs(statement.net))}
              </span>
            </div>

            {longRange && statement.monthly.length > 0 && (
              <div>
                <h2 className="mb-2 text-lg font-semibold text-gray-900">Per maand</h2>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="py-2 font-medium">Maand</th>
                      <th className="py-2 text-right font-medium">Baten</th>
                      <th className="py-2 text-right font-medium">Lasten</th>
                      <th className="py-2 text-right font-medium">Netto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.monthly.map((m) => (
                      <tr key={m.key} className="border-b border-gray-100">
                        <td className="py-2 capitalize">{nameOfMonth(m.key)}</td>
                        <td className="py-2 text-right">{euro(m.income)}</td>
                        <td className="py-2 text-right">{euro(m.expense)}</td>
                        <td className={`py-2 text-right font-medium ${m.income - m.expense >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {euro(m.income - m.expense)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-gray-400">
              Bedragen zijn wat echt van jou is: doorgegeven, verrekende en teruggevorderde delen zijn eruit gehaald.
              Overboekingen tussen eigen rekeningen tellen niet mee.
            </p>
          </div>

          <div className="space-y-2 print:hidden">
            <PrintButton />
            <a
              href={`/api/export/statement?from=${period.from}&to=${period.to}`}
              className="flex min-h-[52px] w-full items-center justify-center rounded-xl border border-gray-300 text-base font-medium text-gray-900 active:bg-gray-50"
            >
              Download als CSV (Excel)
            </a>
          </div>
        </>
      )}
    </div>
  );
}
