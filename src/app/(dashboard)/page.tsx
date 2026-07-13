import Link from "next/link";
import { after } from "next/server";
import {
  getDashboardSummary,
  getMonthlySpendByCategory,
  getRecurringPayments,
} from "@/actions/dashboard";
import { getBudgetStatus, getSpendingAnomaly } from "@/actions/budgets";
import { autoSyncStaleConnections } from "@/actions/bank-connections";

const MONTH_NAMES = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

export default async function DashboardPage() {
  // Keeps bank data fresh without blocking the page — runs after the
  // response is sent, throttled to once per hour per connection.
  after(() => autoSyncStaleConnections());

  const [summary, categorySpend, recurring, budgetStatus, anomaly] = await Promise.all([
    getDashboardSummary(),
    getMonthlySpendByCategory(),
    getRecurringPayments(),
    getBudgetStatus(),
    getSpendingAnomaly(),
  ]);

  const monthLabel = MONTH_NAMES[new Date().getMonth()];
  const maxCategoryTotal = Math.max(1, ...categorySpend.map((c) => c.total));
  const budgetWarnings = budgetStatus.filter((b) => b.aheadOfPace || b.overBudget);

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-gray-900">Overzicht</h1>

      {(anomaly || budgetWarnings.length > 0) && (
        <section className="space-y-2">
          {anomaly && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Je hebt tot nu toe deze maand €{anomaly.monthToDateSpend.toFixed(0)} uitgegeven
              — {Math.round(anomaly.pctAbove)}% meer dan je gewoonlijk op dit punt van de
              maand hebt uitgegeven (~€{anomaly.usualMonthToDateSpend.toFixed(0)}).
            </p>
          )}
          {budgetWarnings.map((b) => (
            <p
              key={b.categoryId}
              className={
                b.overBudget
                  ? "rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                  : "rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
              }
            >
              {b.overBudget ? (
                <>
                  Budget <span className="font-medium">{b.categoryName}</span> overschreden:
                  €{b.spent.toFixed(0)} van €{b.monthlyLimit.toFixed(0)}.
                </>
              ) : (
                <>
                  Je zit op {Math.round(b.pctOfMonthElapsed)}% van de maand, maar al op{" "}
                  {Math.round(b.pctUsed)}% van je budget voor{" "}
                  <span className="font-medium">{b.categoryName}</span> (€{b.spent.toFixed(0)}{" "}
                  van €{b.monthlyLimit.toFixed(0)}).
                </>
              )}
            </p>
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Te doen</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/transactions"
            className="min-h-[64px] rounded-md border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
          >
            <p className="text-2xl font-semibold text-gray-900">{summary.unreviewedCount}</p>
            <p className="text-sm text-gray-500">nog te controleren</p>
          </Link>
          <Link
            href="/transactions?type=uncategorized"
            className="min-h-[64px] rounded-md border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
          >
            <p className="text-2xl font-semibold text-gray-900">{summary.uncategorizedCount}</p>
            <p className="text-sm text-gray-500">nog te categoriseren</p>
          </Link>
          <Link
            href="/reclaims"
            className="min-h-[64px] rounded-md border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
          >
            <p className="text-2xl font-semibold text-gray-900">
              €{summary.outstandingReclaimsTotal.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500">nog openstaand (terugvorderingen)</p>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Deze maand ({monthLabel})</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
            <p className="text-xl font-semibold text-green-700">€{summary.monthIncome.toFixed(2)}</p>
            <p className="text-sm text-gray-500">binnengekomen</p>
          </div>
          <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
            <p className="text-xl font-semibold text-gray-900">€{summary.monthExpense.toFixed(2)}</p>
            <p className="text-sm text-gray-500">uitgegeven</p>
          </div>
        </div>
      </section>

      {budgetStatus.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">Budgetten ({monthLabel})</h2>
            <Link href="/settings/budgets" className="text-xs text-gray-500 underline">
              Aanpassen
            </Link>
          </div>
          <ul className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
            {budgetStatus.map((b) => (
              <li key={b.categoryId}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-900">{b.categoryName}</span>
                  <span
                    className={
                      b.overBudget
                        ? "font-medium text-red-700"
                        : b.aheadOfPace
                          ? "font-medium text-amber-700"
                          : "font-medium text-gray-900"
                    }
                  >
                    €{b.spent.toFixed(2)} / €{b.monthlyLimit.toFixed(2)}
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-gray-100">
                  <div
                    className={
                      b.overBudget
                        ? "h-2 rounded-full bg-red-600"
                        : b.aheadOfPace
                          ? "h-2 rounded-full bg-amber-500"
                          : "h-2 rounded-full bg-green-600"
                    }
                    style={{ width: `${Math.min(100, b.pctUsed)}%` }}
                  />
                  {/* marker for how far the month has progressed */}
                  <div
                    className="absolute top-[-2px] h-3 w-0.5 bg-gray-400"
                    style={{ left: `${b.pctOfMonthElapsed}%` }}
                    title="Zover is de maand"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Uitgaven per categorie ({monthLabel})
        </h2>
        {categorySpend.length > 0 ? (
          <ul className="space-y-2 rounded-md border border-gray-200 bg-white p-4">
            {categorySpend.map((c) => (
              <li key={c.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-900">{c.name}</span>
                  <span className="font-medium text-gray-900">€{c.total.toFixed(2)}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-gray-900"
                    style={{ width: `${(c.total / maxCategoryTotal) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Nog geen uitgaven deze maand.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Vaste lasten (herkend)</h2>
        {recurring.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {recurring.map((r) => (
              <li key={r.counterpartyName} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{r.counterpartyName}</p>
                  <p className="text-gray-500">{r.occurrences}x in de laatste 90 dagen</p>
                </div>
                <span className="font-medium text-gray-900">
                  ~€{r.averageAmount.toFixed(2)}/keer
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            Nog geen vaste lasten herkend — dit werkt beter zodra er meer historie is.
          </p>
        )}
      </section>
    </div>
  );
}
