import Link from "next/link";
import { getDebts } from "@/actions/debts";
import { summarize, summarizeMortgage } from "@/lib/debts/calc";
import { AddDebtButtons, DebtEditor, type EditorDebt } from "./debt-editor";

const euro = (n: number, digits = 0) =>
  n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });
const date = (d: Date | string) => new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
const card = "rounded-2xl bg-white ring-1 ring-gray-200";

function daysUntil(iso: string) {
  return Math.ceil((Date.parse(`${iso}T23:59:59`) - Date.now()) / 86_400_000);
}

function RateLine({ until }: { until: string | null }) {
  if (!until) return null;
  const days = daysUntil(until);
  return (
    <span className={days <= 90 && days >= 0 ? "text-amber-700" : "text-gray-500"}>
      rente vast tot {date(until)}
      {days >= 0 && ` (nog ${days} dagen)`}
    </span>
  );
}

export default async function SchuldenPage() {
  const debts = await getDebts();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Schulden en hypotheek</h1>
      </div>

      {debts.length === 0 && (
        <p className={`${card} p-5 text-base text-gray-600`}>
          Voeg je studielening of hypotheek toe. De maandlast komt dan bij je vaste lasten.
        </p>
      )}

      {debts.map((d) => {
        const editor: EditorDebt = {
          id: d.id,
          kind: d.kind,
          name: d.name,
          repay_start: d.repay_start,
          term_years: d.term_years,
          monthly_payment: d.monthly_payment,
          gift_adjustment: d.gift_adjustment,
          property_value: d.property_value,
          debt_parts: d.debt_parts,
        };

        if (d.kind === "mortgage") {
          const s = summarizeMortgage(d, d.debt_parts);
          return (
            <section key={d.id} className={`${card} space-y-4 p-5`}>
              <div>
                <p className="text-sm text-gray-500">{d.name}</p>
                <p className="text-4xl font-semibold text-gray-900">{euro(s.total)}</p>
                <p className="text-sm text-gray-500">openstaande schuld</p>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                <div>
                  <p className="text-sm text-gray-500">Maandlast{d.monthly_payment == null && " (berekend)"}</p>
                  <p className="text-xl font-semibold text-gray-900">{euro(s.monthlyCost)}</p>
                  {d.monthly_payment == null && s.computedMonthly > 0 && (
                    <p className="text-xs text-gray-400">
                      {euro(s.interestMonth)} rente, {euro(s.principalMonth)} aflossing
                    </p>
                  )}
                </div>
                {s.equity != null && (
                  <div>
                    <p className="text-sm text-gray-500">Overwaarde</p>
                    <p className={`text-xl font-semibold ${s.equity >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {euro(s.equity)}
                    </p>
                    {s.ltv != null && <p className="text-xs text-gray-400">{Math.round(s.ltv)}% van de woningwaarde</p>}
                  </div>
                )}
              </div>
              {s.parts.length > 0 && (
                <ul className="divide-y divide-gray-100 border-t border-gray-100">
                  {s.parts.map((p) => (
                    <li key={p.id} className="space-y-1 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-base font-medium text-gray-900">{p.name}</span>
                        <span className="text-base text-gray-900">{euro(p.current)}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {p.rate.toString().replace(".", ",")}%,{" "}
                        {p.repay_type === "linear" ? "lineair" : p.repay_type === "interest_only" ? "aflossingsvrij" : "annuïteit"}
                        {" · "}
                        {euro(p.monthly)} per maand
                      </p>
                      <p className="text-sm">
                        <RateLine until={p.rate_fixed_until} />
                        {p.balanceAtFixedEnd != null && (
                          <span className="text-gray-500"> · dan nog {euro(p.balanceAtFixedEnd)} schuld</span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <DebtEditor debt={editor} />
            </section>
          );
        }

        const s = summarize(d, d.debt_parts);
        return (
          <section key={d.id} className={`${card} space-y-4 p-5`}>
            <div>
              <p className="text-sm text-gray-500">{d.name}</p>
              <p className="text-sm text-gray-500">Wat je echt terugbetaalt</p>
              <p className="text-4xl font-semibold text-gray-900">{euro(s.realNow)}</p>
              {s.giftTotal > 0 && (
                <p className="text-sm text-gray-500">
                  Bij DUO staat {euro(s.totalAtLender)}, waarvan {euro(s.giftTotal)} prestatiebeurs die een gift wordt.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
              <div>
                <p className="text-sm text-gray-500">Rente per jaar</p>
                <p className="text-xl font-semibold text-gray-900">{euro(s.interestPerYear)}</p>
                <p className="text-xs text-gray-400">ongeveer {euro(s.interestPerYear / 12)} per maand</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Nu per maand</p>
                <p className="text-xl font-semibold text-gray-900">{euro(s.monthlyCost)}</p>
                <p className="text-xs text-gray-400">{s.repaying ? "in de aflosfase" : "je betaalt nog niets"}</p>
              </div>
            </div>

            {d.repay_start && s.aanloopEnd && s.repayEnd && (
              <div className="space-y-2 border-t border-gray-100 pt-3 text-base">
                <p className="text-sm font-medium text-gray-700">Fasen</p>
                <p className="text-gray-900">
                  Aanloopfase tot en met {date(s.aanloopEnd)}
                  <span className="block text-sm text-gray-500">je betaalt niets, de rente loopt wel door</span>
                </p>
                <p className="text-gray-900">
                  Aflosfase vanaf {date(d.repay_start)}
                  <span className="block text-sm text-gray-500">
                    {d.term_years} jaar, tot {date(s.repayEnd)}. Wat dan nog openstaat wordt kwijtgescholden.
                  </span>
                </p>
                {s.projectedAtStart != null && s.estimatedMonthly != null && (
                  <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                    Verwacht bij de start van de aflosfase: schuld ongeveer {euro(s.projectedAtStart)}, en een{" "}
                    {d.monthly_payment == null ? "geschat " : ""}maandbedrag van ongeveer{" "}
                    <span className="font-semibold">{euro(d.monthly_payment ?? s.estimatedMonthly)}</span>. DUO stelt het
                    definitieve bedrag elk jaar in november vast, dat vul je hieronder in.
                  </p>
                )}
              </div>
            )}

            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {s.parts.map((p) => (
                <li key={p.id} className="space-y-1 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-medium text-gray-900">
                      {p.name}
                      {p.is_gift && <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">gift</span>}
                    </span>
                    <span className="text-base text-gray-900">{euro(p.current)}</span>
                  </div>
                  <p className="text-sm">
                    <span className="text-gray-500">{p.rate.toString().replace(".", ",")}%, </span>
                    <RateLine until={p.rate_fixed_until} />
                  </p>
                </li>
              ))}
            </ul>

            <p className="text-xs text-gray-400">
              Bedragen zijn berekend vanaf de stand van je gegevens en kunnen licht afwijken van DUO.
            </p>
            <DebtEditor debt={editor} />
          </section>
        );
      })}

      <AddDebtButtons hasDuo={debts.some((d) => d.kind === "duo")} />
    </div>
  );
}
