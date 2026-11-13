"use client";

import { Note, NumberBox, Section, SrcBadge, euro, pct } from "./ui";
import { usePlan } from "./plan-provider";
import { contributionFor } from "@/lib/plan/model";
import { lawFor, type LawYear } from "@/lib/plan/law";
import type { PlanEvent } from "@/lib/plan/types";

// ---------------------------------------------------------------- salary per year

export function SalaryEditor() {
  const { result: r, x, setSalary, clearSalaries } = usePlan();
  const rows = r.pay.filter((p) => p.year <= r.purchase.year + 3);
  const edited = Object.keys(x.salaryYou).length + Object.keys(x.salaryPartner).length;

  return (
    <div className="space-y-3">
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="px-2 py-2 font-medium">Jaar</th>
              <th className="px-2 py-2 font-medium">Jij, bruto</th>
              {x.buyingTogether && <th className="px-2 py-2 font-medium">Partner, bruto</th>}
              <th className="px-2 py-2 text-right font-medium">Netto/mnd</th>
              <th className="px-2 py-2 text-right font-medium">Belasting</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.year} className={`border-t border-gray-100 ${p.year === r.purchase.year ? "bg-teal-50" : ""}`}>
                <td className="px-2 py-2 font-medium text-gray-900">{p.year}</td>
                <td className="px-2 py-1.5">
                  <NumberBox
                    value={Math.round(p.grossYou)}
                    onChange={(n) => setSalary("salaryYou", p.year, n)}
                    className={p.fromInput.you ? "!border-teal-500 !bg-teal-50" : ""}
                  />
                </td>
                {x.buyingTogether && (
                  <td className="px-2 py-1.5">
                    <NumberBox
                      value={Math.round(p.grossPartner)}
                      onChange={(n) => setSalary("salaryPartner", p.year, n)}
                      className={p.fromInput.partner ? "!border-teal-500 !bg-teal-50" : ""}
                    />
                  </td>
                )}
                <td className="px-2 py-2 text-right">{euro(p.netMonthly)}</td>
                <td className="px-2 py-2 text-right">{pct(p.avgRate * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edited > 0 && (
        <button type="button" onClick={clearSalaries} className="min-h-[44px] text-sm text-red-600 underline">
          Alle aangepaste jaren wissen ({edited})
        </button>
      )}
      <p className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <SrcBadge src="calc" /> bruto volgt uit {pct(x.salaryGrowthPct)} groei per jaar tot jij een bedrag invult (groen).
        <SrcBadge src="law" /> netto en belasting volgen uit de regels van 2026.
      </p>
    </div>
  );
}

// ------------------------------------------------------------- contributions per year

export function ContribEditor() {
  const { b, x, app, result: r, patchX } = usePlan();
  const startYear = r.startYear;
  const years = Array.from({ length: Math.min(10, Math.max(1, r.purchase.year - startYear + 1)) }, (_, i) => startYear + i);

  const setContrib = (year: number, k: "save" | "bonds" | "invest", n: number) =>
    patchX((cur) => {
      const base = contributionFor({ b, x: cur, app }, year);
      return { ...cur, contrib: { ...cur.contrib, [String(year)]: { ...base, [k]: n } } };
    });

  return (
    <div className="space-y-3">
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[460px] text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="px-2 py-2 font-medium">Jaar</th>
              <th className="px-2 py-2 font-medium">Sparen</th>
              <th className="px-2 py-2 font-medium">Obligaties</th>
              <th className="px-2 py-2 font-medium">Beleggen</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const c = contributionFor({ b, x, app }, y);
              const custom = Boolean(x.contrib[String(y)]);
              return (
                <tr key={y} className="border-t border-gray-100">
                  <td className="px-2 py-2 font-medium text-gray-900">{y}</td>
                  {(["save", "bonds", "invest"] as const).map((k) => (
                    <td key={k} className="px-1.5 py-1.5">
                      <NumberBox value={Math.round(c[k])} onChange={(n) => setContrib(y, k, n)} className={custom ? "!border-teal-500 !bg-teal-50" : ""} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {Object.keys(x.contrib).length > 0 && (
        <button type="button" onClick={() => patchX((cur) => ({ ...cur, contrib: {} }))} className="min-h-[44px] text-sm text-red-600 underline">
          Aangepaste jaren wissen
        </button>
      )}
      <Note>Per maand. Groen is door jou aangepast. De rest volgt uit je inleg en de stijging per jaar.</Note>
    </div>
  );
}

// ------------------------------------------------------------------------- events

export function EventsEditor() {
  const { x, patchX } = usePlan();
  const set = (id: string, p: Partial<PlanEvent>) =>
    patchX((cur) => ({ ...cur, events: cur.events.map((e) => (e.id === id ? { ...e, ...p } : e)) }));
  return (
    <div className="space-y-3">
      {x.events.length === 0 && (
        <Note>Nog geen gebeurtenissen. Denk aan een bruiloft, een auto, een schenking van je ouders, een bonus of erfenis.</Note>
      )}
      {x.events.map((e) => (
        <div key={e.id} className="space-y-2 rounded-xl bg-gray-50 p-3">
          <input
            value={e.label}
            onChange={(ev) => set(e.id, { label: ev.target.value })}
            placeholder="Omschrijving, bijvoorbeeld schenking ouders"
            className="min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberBox value={e.amount} onChange={(n) => set(e.id, { amount: n })} unit="€" placeholder="+ erbij, − eruit" />
            <NumberBox value={e.year} onChange={(n) => set(e.id, { year: Math.round(n) })} unit="jaar" />
          </div>
          <button
            type="button"
            onClick={() => patchX((cur) => ({ ...cur, events: cur.events.filter((v) => v.id !== e.id) }))}
            className="min-h-[40px] text-sm text-red-600 underline"
          >
            Verwijderen
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          patchX((cur) => ({
            ...cur,
            events: [...cur.events, { id: crypto.randomUUID(), label: "", amount: 0, year: Number(cur.startDate.slice(0, 4)) + 1 }],
          }))
        }
        className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white text-base font-medium text-gray-900 active:bg-gray-50"
      >
        + Gebeurtenis toevoegen
      </button>
      <Note>Een positief bedrag komt in het midden van het jaar bij je spaargeld, een negatief bedrag gaat eraf.</Note>
    </div>
  );
}

// -------------------------------------------------------------- law table per year

export function LawEditor() {
  const { x, patchX, app } = usePlan();
  const rows = [...x.law].sort((a, c) => a.year - c.year);
  const thisYear = Number(app.today.slice(0, 4));
  const set = (year: number, fn: (r: LawYear) => LawYear) =>
    patchX((cur) => ({ ...cur, law: cur.law.map((r) => (r.year === year ? fn(r) : r)) }));
  const field = (label: string, year: number, get: (r: LawYear) => number, put: (r: LawYear, n: number) => LawYear, unit = "%") => (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs text-gray-600">{label}</span>
      <NumberBox value={get(rows.find((r) => r.year === year)!)} onChange={(n) => set(year, (r) => put(r, n))} unit={unit} />
    </label>
  );
  void lawFor;

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Section
          key={r.year}
          title={String(r.year)}
          hint={`Gecontroleerd ${new Date(r.checkedOn).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}`}
          open={r.year === thisYear}
        >
          <div className="grid grid-cols-2 gap-3">
            {field("NHG-kostengrens", r.year, (q) => q.nhgLimit, (q, n) => ({ ...q, nhgLimit: n }), "€")}
            {field("Grens startersvrijstelling", r.year, (q) => q.starterLimit, (q, n) => ({ ...q, starterLimit: n }), "€")}
            {field("Max. aftrektarief hypotheekrente", r.year, (q) => q.reliefMaxRate * 100, (q, n) => ({ ...q, reliefMaxRate: n / 100 }))}
            {field("Heffingsvrij vermogen p.p.", r.year, (q) => q.box3.exemptPerPerson, (q, n) => ({ ...q, box3: { ...q.box3, exemptPerPerson: n } }), "€")}
            {field("Fictief rendement sparen", r.year, (q) => q.box3.savingsReturnPct, (q, n) => ({ ...q, box3: { ...q.box3, savingsReturnPct: n } }))}
            {field("Fictief rendement beleggen", r.year, (q) => q.box3.otherReturnPct, (q, n) => ({ ...q, box3: { ...q.box3, otherReturnPct: n } }))}
            {field("Fictieve rente schulden", r.year, (q) => q.box3.debtReturnPct, (q, n) => ({ ...q, box3: { ...q.box3, debtReturnPct: n } }))}
            {field("Tarief box 3", r.year, (q) => q.box3.ratePct, (q, n) => ({ ...q, box3: { ...q.box3, ratePct: n } }))}
            {field("Schuldendrempel p.p.", r.year, (q) => q.box3.debtThresholdPerPerson, (q, n) => ({ ...q, box3: { ...q.box3, debtThresholdPerPerson: n } }), "€")}
          </div>
          <p className="text-xs text-gray-500">
            Bron: {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-teal-700 underline">{r.source}</a> : r.source}
          </p>
          {r.note && <p className="text-xs text-gray-500">{r.note}</p>}
          <button type="button" onClick={() => set(r.year, (q) => ({ ...q, checkedOn: app.today }))} className="min-h-[44px] text-sm text-teal-700 underline">
            Markeer als gecontroleerd vandaag
          </button>
        </Section>
      ))}
      <button
        type="button"
        onClick={() =>
          patchX((cur) => {
            const last = [...cur.law].sort((a, c) => a.year - c.year).pop()!;
            return { ...cur, law: [...cur.law, { ...last, year: last.year + 1, box3: { ...last.box3 }, checkedOn: app.today, note: "Overgenomen van het jaar ervoor: controleer na Prinsjesdag." }] };
          })
        }
        className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white text-base font-medium text-gray-900 active:bg-gray-50"
      >
        + Volgend jaar toevoegen
      </button>
      <Note>De belastingschijven en heffingskortingen staan vast op de regels van 2026 en stijgen daarna mee met de indexatie die je instelt.</Note>
    </div>
  );
}
