import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import {
  getAccountBalances,
  getDashboardSummary,
  getFreeToSpendPerMonth,
  getMonthlyIncomeByCategory,
  getMonthlySpendByCategory,
  getRecurringPayments,
} from "@/actions/dashboard";
import { getBudgetStatus, getSpendingAnomaly } from "@/actions/budgets";
import { autoSyncStaleConnections, getPsuContext } from "@/actions/bank-connections";
import { getPots } from "@/actions/pots";
import { computePotBalance } from "@/lib/pots/balance";
import { netInPeriod, periodMonthly, planCatchUp } from "@/lib/pots/insights";
import { CatchUpCard } from "./pots/catch-up-card";
import { getOpenLoansTotal } from "@/actions/loans";
import { SyncAllButton } from "./sync-all-button";
import { periodRange } from "@/lib/month";
import { getHiddenDashboardModules, getMonthStartDay } from "@/lib/settings";
import { getDebtFixedCosts } from "@/actions/debts";

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
  // Tab prefetches render this page too — those must not hit the bank API.
  const requestHeaders = await headers();
  const isPrefetch =
    requestHeaders.has("next-router-prefetch") || requestHeaders.get("purpose") === "prefetch";
  // Captured now: request headers aren't available inside after().
  const psu = await getPsuContext();
  if (!isPrefetch) after(() => autoSyncStaleConnections(psu));

  const { month } = await searchParams;
  // 0 = this month, 1 = previous month, etc. — can't navigate into the future.
  const monthsAgo = Math.max(0, parseInt(month ?? "0", 10) || 0);
  const isCurrentMonth = monthsAgo === 0;

  const hiddenModules = new Set(await getHiddenDashboardModules());
  const show = (key: string) => !hiddenModules.has(key);

  const [debtCosts, summary, categorySpend, incomeByCategory, recurring, budgetStatus, anomaly, balances, pots, freeToSpend, loans] =
    await Promise.all([
      getDebtFixedCosts(),
      getDashboardSummary(monthsAgo),
      getMonthlySpendByCategory(monthsAgo),
      getMonthlyIncomeByCategory(monthsAgo),
      getRecurringPayments(),
      getBudgetStatus(),
      getSpendingAnomaly(),
      getAccountBalances(),
      getPots(),
      getFreeToSpendPerMonth(),
      getOpenLoansTotal(),
    ]);

  const potBalances = new Map(pots.map((p) => [p.id, computePotBalance(p)]));
  const potsTotal = [...potBalances.values()].reduce((sum, b) => sum + b, 0);
  // What to set aside from the next salary: each pot's monthly plan.
  const startDay = await getMonthStartDay();
  const catchUps = new Map(pots.map((p) => [p.id, planCatchUp(p, startDay)]));
  const reservations = pots
    .map((p) => {
      const base = periodMonthly(p, potBalances.get(p.id) ?? 0, startDay) ?? 0;
      const carry = base > 0 ? Math.ceil(catchUps.get(p.id)?.shortfall ?? 0) : 0;
      return { id: p.id, name: p.name, base, carry, amount: base + carry };
    })
    .filter((r) => r.amount > 0);
  const catchUpItems = pots.flatMap((p) =>
    (catchUps.get(p.id)?.pending ?? []).map((x) => ({
      potId: p.id,
      potName: p.name,
      periodStart: x.periodStart,
      monthName: new Date(x.labelDate).toLocaleDateString("nl-NL", { month: "long" }),
      missing: x.missing,
    }))
  );
  const plannedSavings = reservations.reduce((sum, r) => sum + r.amount, 0);

  const now = new Date();
  const period = periodRange(monthsAgo, startDay);
  const nextPeriodLabel = periodRange(0, startDay).endDate.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
  });
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
  const maxIncomeTotal = Math.max(1, ...incomeByCategory.map((c) => c.total));
  const totalIncome = incomeByCategory.reduce((s, c) => s + c.total, 0);
  const totalExpense = categorySpend.reduce((s, c) => s + c.total, 0);
  // Money moved into pots this period: set aside, not spent, but not free either.
  const reservedTotal = pots.reduce((s, p) => s + netInPeriod(p, monthsAgo, startDay), 0);
  const net = totalIncome - totalExpense - reservedTotal;
  const budgetByName = new Map(budgetStatus.map((b) => [b.categoryName, b]));
  const overBudgets = budgetStatus.filter((b) => b.overBudget);
  const expenseDelta = summary.monthExpense - summary.previousMonthExpense;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-semibold text-gray-900">Overzicht</h1>
        <SyncAllButton />
      </div>

      {show("accounts") && balances.accounts.length > 0 && (
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

      {show("freeToSpend") && freeToSpend != null && (
        <section className={`${card} space-y-2 p-5`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">Vrije ruimte per maand</p>
              <p className="text-xs text-gray-400">gemiddelde van de laatste maanden</p>
            </div>
            <p className="text-2xl font-semibold text-gray-900">
              {euro(Math.max(0, freeToSpend - plannedSavings), 0)}
            </p>
          </div>
          {plannedSavings > 0 && (
            <p className="text-sm text-gray-500">
              na {euro(plannedSavings, 0)} gepland sparen (voor sparen {euro(Math.max(0, freeToSpend), 0)})
            </p>
          )}
        </section>
      )}

      {show("reservations") && isCurrentMonth && reservations.length > 0 && (
        <section className={`${card} space-y-3 p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">Reserveren van je volgende loon</p>
              <p className="text-xs text-gray-400">voor sparen naar je potjes, vanaf {nextPeriodLabel}</p>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{euro(plannedSavings, 0)}</p>
          </div>
          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {reservations.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/pots/${r.id}`}
                  className="flex min-h-[48px] items-center justify-between gap-3 text-base active:bg-gray-50"
                >
                  <span className="min-w-0 text-gray-700">
                    <span className="block truncate">{r.name}</span>
                    {r.carry > 0 && (
                      <span className="block text-sm text-amber-700">inclusief {euro(r.carry, 0)} achterstand</span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium text-gray-900">{euro(r.amount, 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {show("reservations") && isCurrentMonth && catchUpItems.length > 0 && <CatchUpCard items={catchUpItems} />}

      {show("loans") && loans.count > 0 && (
        <Link href="/leningen" prefetch className={`${card} flex min-h-[64px] items-center gap-3 px-5 py-3 active:bg-gray-50`}>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-gray-500">Nog af te lossen aan leningen</span>
            <span className="block text-xs text-gray-400">{loans.count} openstaand</span>
          </span>
          <span className="text-2xl font-semibold text-gray-900">{euro(loans.total)}</span>
          <span className="text-2xl text-gray-300">›</span>
        </Link>
      )}

      {show("alerts") && isCurrentMonth && (anomaly || overBudgets.length > 0) && (
        <section className="space-y-2">
          {anomaly && (
            <p className="rounded-2xl bg-red-50 p-4 text-base text-red-700 ring-1 ring-red-100">
              Je hebt tot nu toe deze maand {euro(anomaly.monthToDateSpend, 0)} uitgegeven —{" "}
              {Math.round(anomaly.pctAbove)}% meer dan gewoonlijk op dit punt van de maand (~
              {euro(anomaly.usualMonthToDateSpend, 0)}).
            </p>
          )}
          {overBudgets.length > 0 && (
            <Link
              href="/settings/budgets"
              className="flex min-h-[56px] items-center justify-between gap-3 rounded-2xl bg-red-50 px-5 py-3 text-base text-red-700 ring-1 ring-red-100 active:bg-red-100"
            >
              <span>
                {overBudgets.length === 1
                  ? `Budget ${overBudgets[0].categoryName} is overschreden`
                  : `${overBudgets.length} budgetten zijn overschreden`}
              </span>
              <span className="text-2xl text-red-300">›</span>
            </Link>
          )}
        </section>
      )}

      {show("todo") && (
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
              <Link href={row.href} prefetch className="flex min-h-[64px] items-center gap-3 px-5 py-3 active:bg-gray-50">
                <span className="w-24 shrink-0 text-xl font-semibold text-gray-900">{row.value}</span>
                <span className="flex-1 text-base text-gray-600">{row.label}</span>
                <span className="text-2xl text-gray-300">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      )}

      {show("month") && (
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
      )}

      {show("budgets") && isCurrentMonth && budgetStatus.length > 0 && (
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
                    {b.period !== "month" && (
                      <span className="ml-1 text-xs font-normal text-gray-400">{b.periodLabel}</span>
                    )}
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

      {show("profitLoss") && (
      <section className="space-y-3">
        <h2 className="px-1 text-lg font-semibold text-gray-900">Baten en lasten</h2>

        <div className={`${card} p-5`}>
          <p className="text-sm text-gray-500">Netto na potjes</p>
          <p className={`mt-1 text-3xl font-semibold ${net >= 0 ? "text-green-700" : "text-red-600"}`}>
            {net >= 0 ? `${euro(net, 0)} over` : `${euro(Math.abs(net), 0)} te veel uitgegeven`}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-3 text-base">
            <div>
              <p className="text-sm text-gray-500">Baten</p>
              <p className="font-semibold text-green-700">{euro(totalIncome, 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Lasten</p>
              <p className="font-semibold text-gray-900">{euro(totalExpense, 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Potjes</p>
              <p className="font-semibold text-teal-700">{euro(reservedTotal, 0)}</p>
            </div>
          </div>
        </div>

        <details className={`${card} group`}>
          <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-3 px-5 [&::-webkit-details-marker]:hidden">
            <span className="text-base font-medium text-gray-900">Baten per categorie</span>
            <span className="flex items-center gap-2">
              <span className="text-base font-semibold text-green-700">{euro(totalIncome, 0)}</span>
              <span className="text-2xl text-gray-300 transition-transform group-open:rotate-90">›</span>
            </span>
          </summary>
          {incomeByCategory.length > 0 ? (
            <ul className="space-y-4 border-t border-gray-100 p-5">
              {incomeByCategory.map((c) => (
                <li key={c.name}>
                  <div className="mb-2 flex items-center justify-between text-base">
                    <span className="text-gray-900">{c.name}</span>
                    <span className="font-medium text-gray-900">{euro(c.total, 0)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100">
                    <div
                      className="h-3 rounded-full bg-green-600"
                      style={{ width: `${(c.total / maxIncomeTotal) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-t border-gray-100 p-5 text-base text-gray-500">Nog geen baten in deze periode.</p>
          )}
        </details>

        <details className={`${card} group`}>
          <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-3 px-5 [&::-webkit-details-marker]:hidden">
            <span className="text-base font-medium text-gray-900">Lasten per categorie</span>
            <span className="flex items-center gap-2">
              <span className="text-base font-semibold text-gray-900">{euro(totalExpense, 0)}</span>
              <span className="text-2xl text-gray-300 transition-transform group-open:rotate-90">›</span>
            </span>
          </summary>
          {categorySpend.length > 0 ? (
            <ul className="space-y-4 border-t border-gray-100 p-5">
              {categorySpend.map((c) => {
                const delta = c.total - c.previousTotal;
                const budget = isCurrentMonth ? budgetByName.get(c.name) : undefined;
                const left = budget ? budget.monthlyLimit - budget.spent : null;
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
                    {left != null && (
                      <p className={`mt-1 text-sm ${left >= 0 ? "text-gray-500" : "font-medium text-red-600"}`}>
                        {left >= 0 ? `${euro(left, 0)} over van je budget` : `${euro(Math.abs(left), 0)} boven je budget`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="border-t border-gray-100 p-5 text-base text-gray-500">Nog geen lasten in deze periode.</p>
          )}
        </details>
      </section>
      )}

      {show("fixed") && isCurrentMonth && (
        <section className="space-y-2">
          <h2 className="px-1 text-lg font-semibold text-gray-900">Vaste lasten</h2>
          {recurring.length > 0 || reservations.length > 0 || debtCosts.length > 0 ? (
            <ul className={`${card} overflow-hidden`}>
              {debtCosts.map((c) => (
                <li key={`debt-${c.id}`} className="border-b border-gray-100 last:border-b-0">
                  <Link
                    href="/settings/schulden"
                    className="flex min-h-[64px] items-center justify-between gap-3 px-5 py-3 active:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-gray-900">{c.name}</p>
                      <p className="text-sm text-gray-500">{c.estimated ? "geschat maandbedrag" : "maandbedrag"}</p>
                    </div>
                    <span className="shrink-0 text-base font-medium text-gray-900">
                      {c.estimated ? "~" : ""}
                      {euro(c.amount)}
                    </span>
                  </Link>
                </li>
              ))}
              {reservations.map((r) => (
                <li key={`pot-${r.id}`} className="border-b border-gray-100 last:border-b-0">
                  <Link
                    href={`/pots/${r.id}`}
                    className="flex min-h-[64px] items-center justify-between gap-3 px-5 py-3 active:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-gray-900">Sparen · {r.name}</p>
                      <p className="text-sm text-gray-500">maandelijks plan</p>
                    </div>
                    <span className="shrink-0 text-base font-medium text-gray-900">{euro(r.base)}</span>
                  </Link>
                </li>
              ))}
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
