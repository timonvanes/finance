import Link from "next/link";
import { getPots, getSavingsInbox } from "@/actions/pots";
import { getDashboardSummary } from "@/actions/dashboard";
import { computePotBalance } from "@/lib/pots/balance";
import { computeSchedule, depositedInPeriod, netInPeriod, periodMonthly, planCatchUp } from "@/lib/pots/insights";
import { CatchUpCard } from "./catch-up-card";
import { periodRange } from "@/lib/month";
import { getMonthStartDay } from "@/lib/settings";
import { InfoButton } from "../info-button";
import { PlanRow } from "./plan-row";
import { SavingsInbox } from "./inbox";
import { LeftoverCard } from "./leftover-card";
import { AutoDetect } from "./auto-detect";
import { GoalSpendCard } from "./goal-spend-card";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export default async function PotsPage() {
  const [pots, inbox, startDay] = await Promise.all([
    getPots(),
    getSavingsInbox(),
    getMonthStartDay(),
  ]);
  const summary = pots.length > 0 ? await getDashboardSummary(0) : null;

  const balances = new Map(pots.map((p) => [p.id, computePotBalance(p)]));
  const totalBalance = [...balances.values()].reduce((s, b) => s + b, 0);

  // The plan per pot for this period (automatic plans follow the goal).
  const plans = new Map(
    pots.map((p) => [p.id, periodMonthly(p, balances.get(p.id) ?? 0, startDay)])
  );
  const catchUps = new Map(pots.map((p) => [p.id, planCatchUp(p, startDay)]));
  const carryOf = (id: string) => Math.ceil(catchUps.get(id)?.shortfall ?? 0);
  const planned = pots.filter((p) => plans.get(p.id));
  const plannedBaseTotal = planned.reduce((s, p) => s + (plans.get(p.id) ?? 0), 0);
  const plannedTotal = planned.reduce((s, p) => s + (plans.get(p.id) ?? 0) + carryOf(p.id), 0);
  const catchUpItems = pots.flatMap((p) =>
    (catchUps.get(p.id)?.pending ?? []).map((x) => ({
      potId: p.id,
      potName: p.name,
      periodStart: x.periodStart,
      monthName: new Date(x.labelDate).toLocaleDateString("nl-NL", { month: "long" }),
      missing: x.missing,
    }))
  );
  const depositedTotal = pots.reduce((s, p) => s + depositedInPeriod(p, 0, startDay), 0);
  const plannedDeposited = planned.reduce(
    (s, p) => s + Math.min(depositedInPeriod(p, 0, startDay), (plans.get(p.id) ?? 0) + carryOf(p.id)),
    0
  );

  const pendingSpend = pots.flatMap((p) =>
    p.target_amount
      ? p.pot_entries
          .filter((e) => e.amount < 0 && !e.goal_spend && e.entry_date >= p.opening_balance_date)
          .map((e) => ({ id: e.id, potName: p.name, amount: Math.abs(e.amount), date: e.entry_date, note: e.note }))
      : []
  );

  const period = periodRange(0, startDay);
  const periodLabel = period.labelDate.toLocaleDateString("nl-NL", { month: "long" });
  const leftover = summary
    ? summary.monthIncome - summary.monthExpense - Math.max(plannedTotal, depositedTotal)
    : 0;

  return (
    <div className="space-y-5">
      <AutoDetect />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Potjes</h1>
          <InfoButton>
            <p>
              Potjes zijn je eigen administratie voor sparen, beleggen en vakantie. Spaar- en
              beleggingsrekeningen zijn via de bankkoppeling niet zichtbaar (PSD2 geeft alleen
              toegang tot betaalrekeningen), dus het saldo hier is wat jij inlegt en opneemt.
            </p>
            <p>
              Met een <span className="font-medium">herkenningstekst</span> per potje worden
              overboekingen ernaartoe of ervandaan automatisch herkend. Bij ING (Oranje
              Spaarrekening) is dat het nummer achter de naam, bv. Z16377129. Bij Rabobank de
              naam die je zelf aan het potje gaf.
            </p>
          </InfoButton>
        </div>
        <Link
          href="/pots/nieuw"
          className="flex min-h-[48px] items-center rounded-full bg-gray-900 px-5 text-base font-medium text-white active:bg-gray-700"
        >
          + Nieuw
        </Link>
      </div>

      <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        <p className="text-sm text-gray-500">Totaal opzij gezet</p>
        <p className="mt-1 text-4xl font-semibold text-gray-900">{euro(totalBalance)}</p>
        {plannedBaseTotal > 0 && (
          <p className="mt-1 text-sm text-gray-500">{euro(plannedBaseTotal)} per maand gepland</p>
        )}
      </div>

      {catchUpItems.length > 0 && <CatchUpCard items={catchUpItems} />}

      {pendingSpend.length > 0 && <GoalSpendCard items={pendingSpend} />}

      {planned.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-lg font-semibold text-gray-900">Deze periode inleggen</h2>
            <span className="text-sm text-gray-500">
              {euro(plannedDeposited)} van {euro(plannedTotal)}
            </span>
          </div>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {planned.map((p) => (
              <PlanRow
                key={p.id}
                potId={p.id}
                name={p.name}
                planned={(plans.get(p.id) ?? 0) + carryOf(p.id)}
                carry={carryOf(p.id)}
                deposited={depositedInPeriod(p, 0, startDay)}
              />
            ))}
          </ul>
        </section>
      )}

      {inbox.length > 0 && pots.length > 0 && (
        <SavingsInbox items={inbox} pots={pots.map((p) => ({ id: p.id, name: p.name }))} />
      )}

      {pots.length > 0 && leftover >= 10 && (
        <LeftoverCard
          suggested={Math.floor(leftover)}
          pots={pots.map((p) => ({ id: p.id, name: p.name }))}
          periodLabel={periodLabel}
        />
      )}

      <section className="space-y-2">
        <h2 className="px-1 text-lg font-semibold text-gray-900">Mijn potjes ({pots.length})</h2>
        {pots.length > 0 ? (
          <ul className="space-y-3">
            {pots.map((pot) => {
              const balance = balances.get(pot.id) ?? 0;
              const schedule = computeSchedule(pot, balance);
              const pct = pot.target_amount ? Math.min(100, (balance / pot.target_amount) * 100) : null;
              return (
                <li key={pot.id}>
                  <Link
                    href={`/pots/${pot.id}`}
                    prefetch
                    className="block space-y-2 rounded-2xl bg-white p-5 ring-1 ring-gray-200 active:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-medium text-gray-900">{pot.name}</p>
                        {pot.target_amount && (
                          <p className="text-sm text-gray-500">doel {euro(pot.target_amount)}</p>
                        )}
                      </div>
                      <p className="shrink-0 text-xl font-semibold text-gray-900">{euro(balance)}</p>
                    </div>
                    {pct != null && (
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    {schedule.status !== "none" && (
                      <p
                        className={`text-sm ${
                          schedule.status === "behind"
                            ? "text-red-600"
                            : schedule.status === "done"
                              ? "text-teal-700"
                              : "text-gray-500"
                        }`}
                      >
                        {schedule.status === "done"
                          ? "Doel bereikt"
                          : schedule.status === "on_track"
                            ? "Op schema"
                            : `${euro(Math.abs(schedule.difference))} ${schedule.status === "ahead" ? "voor" : "achter"} op schema`}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
            Nog geen potjes. Maak er een aan met de knop rechtsboven.
          </p>
        )}
      </section>

    </div>
  );
}
