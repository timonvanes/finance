import Link from "next/link";
import { getLastChecks, getPots, getSavingsInbox } from "@/actions/pots";
import { getDashboardSummary } from "@/actions/dashboard";
import { computePotBalance } from "@/lib/pots/balance";
import { computeSchedule, depositedInPeriod } from "@/lib/pots/insights";
import { periodRange } from "@/lib/month";
import { getMonthStartDay } from "@/lib/settings";
import { InvestmentCalculator } from "./investment-calculator";
import { InfoButton } from "./info-button";
import { PlanRow } from "./plan-row";
import { SavingsInbox } from "./inbox";
import { LeftoverCard } from "./leftover-card";
import { AutoDetect } from "./auto-detect";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const STALE_CHECK_DAYS = 45;

export default async function PotsPage() {
  const [pots, checks, inbox, startDay] = await Promise.all([
    getPots(),
    getLastChecks(),
    getSavingsInbox(),
    getMonthStartDay(),
  ]);
  const summary = pots.length > 0 ? await getDashboardSummary(0) : null;

  const balances = new Map(pots.map((p) => [p.id, computePotBalance(p)]));
  const totalBalance = [...balances.values()].reduce((s, b) => s + b, 0);

  const planned = pots.filter((p) => p.monthly_amount);
  const plannedTotal = planned.reduce((s, p) => s + Number(p.monthly_amount), 0);
  const depositedTotal = pots.reduce((s, p) => s + depositedInPeriod(p, 0, startDay), 0);
  const plannedDeposited = planned.reduce(
    (s, p) => s + Math.min(depositedInPeriod(p, 0, startDay), Number(p.monthly_amount)),
    0
  );

  const period = periodRange(0, startDay);
  const periodLabel = period.labelDate.toLocaleDateString("nl-NL", { month: "long" });
  const leftover = summary
    ? summary.monthIncome - summary.monthExpense - Math.max(plannedTotal, depositedTotal)
    : 0;

  const now = Date.now();
  const staleCount = pots.filter((p) => {
    const c = checks.get(p.id);
    return !c || now - new Date(c.checkedAt).getTime() > STALE_CHECK_DAYS * 86400000;
  }).length;

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
            <p>
              Met <span className="font-medium">Saldo controleren</span> vergelijk je het saldo
              hier met het echte saldo bij je bank en corrigeer je verschillen.
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
        {plannedTotal > 0 && (
          <p className="mt-1 text-sm text-gray-500">{euro(plannedTotal)} per maand gepland</p>
        )}
        {staleCount > 0 && (
          <p className="mt-2 text-sm text-amber-700">
            {staleCount === pots.length ? "Nog niet" : `${staleCount} potje${staleCount > 1 ? "s" : ""} niet recent`}{" "}
            gecontroleerd met je bank — open een potje en kies Saldo controleren.
          </p>
        )}
      </div>

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
                planned={Number(p.monthly_amount)}
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

      <details className="rounded-2xl bg-white ring-1 ring-gray-200">
        <summary className="flex min-h-[56px] cursor-pointer items-center px-5 text-base font-medium text-gray-700">
          Beleggen: wat kan €X per maand opleveren?
        </summary>
        <div className="p-3">
          <InvestmentCalculator />
        </div>
      </details>
    </div>
  );
}
