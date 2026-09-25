import Link from "next/link";
import { notFound } from "next/navigation";
import { getPots } from "@/actions/pots";
import { computePotBalance, computeRequiredMonthlyDeposit } from "@/lib/pots/balance";
import {
  averageMonthlyNet,
  computeSchedule,
  depositedInPeriod,
  effectiveMonthly,
  netInPeriod,
  projectedFinish,
} from "@/lib/pots/insights";
import { getMonthStartDay } from "@/lib/settings";
import { periodRange } from "@/lib/month";
import { InfoButton } from "../../info-button";
import { GoalSpendCard } from "../goal-spend-card";
import { EntryForm, EntryList, MonthlyPlanForm, SettingsForms } from "../pot-detail-forms";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export default async function PotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pots, startDay] = await Promise.all([getPots(), getMonthStartDay()]);
  const pot = pots.find((p) => p.id === id);
  if (!pot) notFound();

  const balance = computePotBalance(pot);
  const schedule = computeSchedule(pot, balance);
  const required = computeRequiredMonthlyDeposit(balance, pot.target_amount, pot.target_date);
  const pace = averageMonthlyNet(pot, startDay);
  const finish = projectedFinish(balance, pot.target_amount, pace);
  const pct = pot.target_amount ? Math.min(100, (balance / pot.target_amount) * 100) : null;
  const deposited = depositedInPeriod(pot, 0, startDay);
  const baseBalance = balance - netInPeriod(pot, 0, startDay);
  const periodStart = periodRange(0, startDay).startDate;
  const monthly = effectiveMonthly(pot, baseBalance, periodStart);
  const canAuto = !!(pot.target_amount && pot.target_date);
  const autoAmount = canAuto ? effectiveMonthly({ ...pot, monthly_auto: true }, baseBalance, periodStart) : null;
  const pending = pot.target_amount
    ? pot.pot_entries
        .filter((e) => e.amount < 0 && !e.goal_spend && e.entry_date >= pot.opening_balance_date)
        .map((e) => ({ id: e.id, potName: pot.name, amount: Math.abs(e.amount), date: e.entry_date, note: e.note }))
    : [];
  const entries = [...pot.pot_entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/pots"
          aria-label="Terug"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold text-gray-900">{pot.name}</h1>
        <InfoButton>
          <p>
            <span className="font-medium">Op schema</span> vergelijkt je saldo met een rechte lijn
            van je startbedrag naar het doel op de doeldatum. <span className="font-medium">Tempo</span>{" "}
            is je gemiddelde netto inleg over de laatste afgeronde perioden; daarmee schat de app
            wanneer je het doel haalt.
          </p>
          <p>
            Overboekingen worden automatisch herkend als je bij <span className="font-medium">Instellingen</span>{" "}
            een herkenningstekst invult, bijvoorbeeld het nummer achter &quot;Oranje spaarrekening&quot;.
          </p>
        </InfoButton>
      </div>

      {pending.length > 0 && <GoalSpendCard items={pending} />}

      <div className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        <div>
          <p className="text-sm text-gray-500">Saldo</p>
          <p className="text-4xl font-semibold text-gray-900">{euro(balance)}</p>
        </div>
        {pot.target_amount && pct != null && (
          <>
            <div className="h-3 rounded-full bg-gray-100">
              <div className="h-3 rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-gray-500">
              {Math.round(pct)}% van {euro(pot.target_amount)}
              {pot.target_date && ` · doel ${new Date(pot.target_date).toLocaleDateString("nl-NL")}`}
            </p>
          </>
        )}
        {schedule.status !== "none" && (
          <ul className="space-y-1 border-t border-gray-100 pt-3 text-base">
            <li
              className={
                schedule.status === "behind" ? "text-red-600" : schedule.status === "done" ? "text-teal-700" : "text-gray-700"
              }
            >
              {schedule.status === "done"
                ? "Doel bereikt"
                : schedule.status === "on_track"
                  ? "Op schema"
                  : `${euro(Math.abs(schedule.difference))} ${schedule.status === "ahead" ? "voor" : "achter"} op schema`}
            </li>
            {required != null && required > 0 && (
              <li className="text-gray-700">Nodig: {euro(required)} per maand om op tijd te zijn</li>
            )}
            <li className="text-gray-500">
              Tempo: {euro(pace)} per maand
              {finish && ` · doel rond ${finish.toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}`}
              {!finish && schedule.status !== "done" && pace <= 0 && " · geen inleg de laatste maanden"}
            </li>
          </ul>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="px-1 text-lg font-semibold text-gray-900">Geschiedenis ({entries.length})</h2>
        <EntryList entries={entries} />
      </section>

      <details className="rounded-2xl bg-white ring-1 ring-gray-200">
        <summary className="flex min-h-[56px] cursor-pointer items-center px-5 text-base font-medium text-gray-700">
          Instellingen van dit potje
        </summary>
        <div className="space-y-6 p-5 pt-2">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Maandplan</h3>
            <p className="text-sm text-gray-500">
              Hoeveel je per maand in dit potje wilt zetten.
              {monthly != null && ` Deze periode ingelegd: ${euro(deposited)} van ${euro(monthly)}.`}
            </p>
            <MonthlyPlanForm
              potId={pot.id}
              initial={pot.monthly_amount != null ? Number(pot.monthly_amount) : null}
              auto={!!pot.monthly_auto}
              autoAmount={autoAmount}
              canAuto={canAuto}
              remaining={pot.target_amount != null ? Number(pot.target_amount) - balance : null}
              requiredMonthly={required}
            />
          </div>
          <div className="space-y-3 border-t border-gray-100 pt-6">
            <h3 className="text-lg font-semibold text-gray-900">Saldo handmatig aanpassen</h3>
            <p className="text-sm text-gray-500">
              Alleen nodig als een overboeking niet automatisch werd herkend, of voor geld dat niet via je bank liep.
            </p>
            <EntryForm potId={pot.id} hasTarget={!!pot.target_amount} />
          </div>
          <div className="border-t border-gray-100 pt-6">
          <SettingsForms
            potId={pot.id}
            matchText={pot.match_text}
            targetAmount={pot.target_amount != null ? Number(pot.target_amount) : null}
            targetDate={pot.target_date}
            openingBalance={Number(pot.opening_balance)}
            openingBalanceDate={pot.opening_balance_date}
          />
          </div>
        </div>
      </details>
    </div>
  );
}
