import Link from "next/link";
import { after } from "next/server";
import {
  getAccountBalances,
  getDashboardSummary,
  getFreeToSpendPerMonth,
  getMonthlySpendByCategory,
  getRecurringPayments,
} from "@/actions/dashboard";
import { getBudgetStatus, getSpendingAnomaly } from "@/actions/budgets";
import { autoSyncStaleConnections } from "@/actions/bank-connections";
import { getPotsTotalBalance } from "@/actions/pots";
import { getOpenLoansTotal } from "@/actions/loans";
import { SyncAllButton } from "./sync-all-button";
import { periodRange } from "@/lib/month";
import { getMonthStartDay } from "@/lib/settings";

const MONTH_NAMES = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

const euro = (n: number, digits = 2) =>
  n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });

const card = "rounded-2xl bg-white ring-1 ring-gray-200";

// The after() auto-sync can take a while on a big first sync — give it
// room instead of being cut off by the default function timeout.
export const maxDuration = 60;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  // Keeps bank data fresh without blocking the page — runs after the
  // response is sent, throttled to once per hour per connection.
  after(() => autoSyncStaleConnections());

  const { month } = await searchParams;
  // 0 = this month, 1 = previous month, etc. — can't navigate into the future.
  const monthsAgo = Math.max(0, parseInt(month ?? "0", 10) || 0);
  const isCurrentMonth = monthsAgo === 0;

  const [summary, categorySpend, recurring, budgetStatus, anomaly, balances, potsTotal, freeToSpend, loans] =
    await Promise.all([
      getDashboardSummary(monthsAgo),
      getMonthlySpendByCategory(monthsAgo),
      getRecurringPayments(),
      getBudgetStatus(),
      getSpendingAnomaly(),
      getAccountBalances(),
      getPotsTotalBalance(),
      getFreeToSpendPerMonth(),
      getOpenLoansTotal(),
    ]);

  const now = new Date();
  const startDay = await getMonthStartDay();
  const period = periodRange(monthsAgo, startDay);
  const viewedDate = period.labelDate;
  const rangeLabel =
    startDay === 1
      ? null
      : `${period.startDate.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} – ${new Date(
          period.endDate.getFullYear(),
          period.endDate.getMonth(),
          period.endDate.getDate() - 1
        ).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`;
  const monthLabel =
    viewedDate.getFullYear() === now.getFullYear()
      ? MONTH_NAMES[viewedDate.getMonth()]
      : `${MONTH_NAMES[viewedDate.getMonth()]} ${viewedDate.getFullYear()}`;
  const maxCategoryTotal = Math.max(1, ...categorySpend.map((c) => c.total));
  const budgetWarnings = budgetStatus.filter((b) => b.aheadOfPace || b.overBudget);
  const expenseDelta = summary.monthExpense - summary.previousMonthExpense;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-semibold text-gray-900">Overzicht</h1>
        <SyncAllButton />
      </div>

      {balances.accounts.length > 0 && (
        <section className={`${card} p-5`}>
          <p className="text-sm text-gray-500">Totaal op je betaalrekeningen</p>
          <p className="mt-1 text-4xl font-semibold text-gray-900">{euro(balances.total)}</p>
          <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
            {balances.accounts.map((a) => (
              <li key={a.id} className="flex min-h-[48px] items-center justify-between gap-3 text-base">
                <span className="min-w-0 truncate text-gray-600">
                  {a.institutionName}
                  {a.displayName && ` · ${a.displayName}`}
                </span>
                <span className="shrink-0 font-medium text-gray-900">{euro(a.balance)}</span>
              </li>
            ))}
          </ul>
          {potsTotal > 0 && (
            <Link href="/pots" className="mt-2 block text-sm text-teal-700">
              Daarnaast {euro(potsTotal)} in je potjes ›
            </Link>
          )}
        </section>
      )}

      {freeToSpend != null && (
        <section className={`${card} flex items-center justify-between gap-4 p-5`}>
          <div>
            <p className="text-sm text-gray-500">Vrije ruimte per maand</p>
            <p className="text-xs text-gray-400">gemiddelde van de laatste maanden</p>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{euro(Math.max(0, freeToSpend), 0)}</p>
        </section>
      )}

      {loans.count > 0 && (
        <Link href="/leningen" className={`${card} flex min-h-[64px] items-center gap-3 px-5 py-3 active:bg-gray-50`}>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-gray-500">Nog af te lossen aan leningen</span>
            <span className="block text-xs text-gray-400">{loans.count} openstaand</span>
          </span>
          <span className="text-2xl font-semibold text-gray-900">{euro(loans.total)}</span>
          <span className="text-2xl text-gray-300">›</span>
        </Link>
      )}

      {isCurrentMonth && (anomaly || budgetWarnings.length > 0) && (
        <section className="space-y-2">
          {anomaly && (
            <p className="rounded-2xl bg-red-50 p-4 text-base text-red-700 ring-1 ring-red-100">
              Je hebt tot nu toe deze maand {euro(anomaly.monthToDateSpend, 0)} uitgegeven —{" "}
              {Math.round(anomaly.pctAbove)}% meer dan gewoonlijk op dit punt van de maand (~
              {euro(anomaly.usualMonthToDateSpend, 0)}).
            </p>
          )}
          {budgetWarnings.map((b) => (
            <p
              key={b.categoryId}
              className={
                b.overBudget
                  ? "rounded-2xl bg-red-50 p-4 text-base text-red-700 ring-1 ring-red-100"
                  : "rounded-2xl bg-amber-50 p-4 text-base text-amber-800 ring-1 ring-amber-100"
              }
            >
              {b.overBudget ? (
                <>
                  Budget <span className="font-medium">{b.categoryName}</span> overschreden:{" "}
                  {euro(b.spent, 0)} van {euro(b.monthlyLimit, 0)}.
                </>
              ) : (
                <>
                  Je zit op {Math.round(b.pctOfMonthElapsed)}% van de maand, maar al op{" "}
                  {Math.round(b.pctUsed)}% van je budget voor{" "}
                  <span className="font-medium">{b.categoryName}</span> ({euro(b.spent, 0)} van{" "}
                  {euro(b.monthlyLimit, 0)}).
                </>
              )}
            </p>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="px-1 text-lg font-semibold text-gray-900">Te doen</h2>
        <ul className={`${card} overflow-hidden`}>
          {[
            { href: "/transactions?type=unreviewed", value: String(summary.unreviewedCount), label: "nog te controleren" },
            {
              href: "/transactions?type=uncategorized",
              value: String(summary.uncategorizedCount),
              label: "nog te categoriseren",
            },
            {
              href: "/terugvorderen",
              value: euro(summary.outstandingReclaimsTotal),
              label: "nog te ontvangen (terugvorderen)",
            },
          ].map((row) => (
            <li key={row.href} className="border-b border-gray-100 last:border-b-0">
              <Link href={row.href} className="flex min-h-[64px] items-center gap-3 px-5 py-3 active:bg-gray-50">
                <span className="w-24 shrink-0 text-xl font-semibold text-gray-900">{row.value}</span>
                <span className="flex-1 text-base text-gray-600">{row.label}</span>
                <span className="text-2xl text-gray-300">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-lg font-semibold capitalize text-gray-900">{monthLabel}</h2>
            {rangeLabel && <p className="text-sm text-gray-500">{rangeLabel}</p>}
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/?month=${monthsAgo + 1}`}
              aria-label="Vorige maand"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl text-gray-700 ring-1 ring-gray-200 active:bg-gray-100"
            >
              ‹
            </Link>
            {isCurrentMonth ? (
              <span className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-gray-300">›</span>
            ) : (
              <Link
                href={monthsAgo - 1 === 0 ? "/" : `/?month=${monthsAgo - 1}`}
                aria-label="Volgende maand"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl text-gray-700 ring-1 ring-gray-200 active:bg-gray-100"
              >
                ›
              </Link>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className={`${card} p-4`}>
            <p className="text-2xl font-semibold text-green-700">{euro(summary.monthIncome, 0)}</p>
            <p className="text-sm text-gray-500">binnengekomen</p>
          </div>
          <div className={`${card} p-4`}>
            <p className="text-2xl font-semibold text-gray-900">{euro(summary.monthExpense, 0)}</p>
            <p className="text-sm text-gray-500">uitgegeven</p>
            {summary.previousMonthExpense > 0 && (
              <p className={`text-sm ${expenseDelta > 0 ? "text-red-600" : "text-green-700"}`}>
                {expenseDelta > 0 ? "+" : ""}
                {euro(expenseDelta, 0)} t.o.v. vorige maand
              </p>
            )}
          </div>
        </div>
      </section>

      {isCurrentMonth && budgetStatus.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-semibold text-gray-900">Budgetten</h2>
            <Link href="/settings/budgets" className="flex min-h-[44px] items-center text-sm text-teal-700">
              Aanpassen
            </Link>
          </div>
          <ul className={`${card} space-y-4 p-5`}>
            {budgetStatus.map((b) => (
              <li key={b.categoryId}>
                <div className="mb-2 flex items-center justify-between text-base">
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
                    {euro(b.spent, 0)} / {euro(b.monthlyLimit, 0)}
                  </span>
                </div>
                <div className="relative h-3 rounded-full bg-gray-100">
                  <div
                    className={
                      b.overBudget
                        ? "h-3 rounded-full bg-red-600"
                        : b.aheadOfPace
                          ? "h-3 rounded-full bg-amber-500"
                          : "h-3 rounded-full bg-teal-600"
                    }
                    style={{ width: `${Math.min(100, b.pctUsed)}%` }}
                  />
                  {/* marker for how far the month has progressed */}
                  <div
                    className="absolute top-[-3px] h-[18px] w-0.5 bg-gray-400"
                    style={{ left: `${b.pctOfMonthElapsed}%` }}
                    title="Zover is de maand"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="px-1 text-lg font-semibold text-gray-900">Uitgaven per categorie</h2>
        {categorySpend.length > 0 ? (
          <ul className={`${card} space-y-4 p-5`}>
            {categorySpend.map((c) => {
              const delta = c.total - c.previousTotal;
              return (
                <li key={c.name}>
                  <div className="mb-2 flex items-center justify-between text-base">
                    <span className="text-gray-900">{c.name}</span>
                    <span className="font-medium text-gray-900">
                      {euro(c.total, 0)}
                      {c.previousTotal > 0 && Math.abs(delta) >= 1 && (
                        <span
                          className={`ml-1 text-sm font-normal ${delta > 0 ? "text-red-600" : "text-green-700"}`}
                        >
                          ({delta > 0 ? "+" : ""}
                          {euro(delta, 0)})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100">
                    <div
                      className="h-3 rounded-full bg-teal-700"
                      style={{ width: `${(c.total / maxCategoryTotal) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={`${card} p-5 text-base text-gray-500`}>Nog geen uitgaven in deze maand.</p>
        )}
      </section>

      {isCurrentMonth && (
        <section className="space-y-2">
          <h2 className="px-1 text-lg font-semibold text-gray-900">Vaste lasten</h2>
          {recurring.length > 0 ? (
            <ul className={`${card} overflow-hidden`}>
              {recurring.map((r) => (
                <li
                  key={r.counterpartyName}
                  className="flex min-h-[64px] items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-gray-900">{r.counterpartyName}</p>
                    <p className="text-sm text-gray-500">{r.occurrences}x in de laatste 90 dagen</p>
                  </div>
                  <span className="shrink-0 text-base font-medium text-gray-900">
                    ~{euro(r.averageAmount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`${card} p-5 text-base text-gray-500`}>
              Nog geen vaste lasten herkend — dit werkt beter zodra er meer historie is.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
