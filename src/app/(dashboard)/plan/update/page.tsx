"use client";

import { useState } from "react";
import { Banner, Block, LineChart, Legend, List, Note, NumberBox, Row, Section, euro } from "../ui";
import { usePlan } from "../plan-provider";
import { monthsBetween } from "@/lib/plan/model";
import { FIELD_BY_ID } from "@/lib/plan/fields";
import type { CheckIn } from "@/lib/plan/types";

// "1.234,56" or "1,234.56" or "1234.56" to a number.
function toNumber(raw: string): number | null {
  const s = raw.replace(/[^\d.,-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let t = s;
  if (lastComma >= 0 && lastDot >= 0) t = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lastComma >= 0) t = s.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function splitLine(line: string, delim: string) {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === delim && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

// The DEGIRO portfolio export: one row per position with a value in EUR.
function parsePortfolio(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const delim = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const head = splitLine(lines[0], delim).map((h) => h.toLowerCase());
  let col = head.findIndex((h) => h.includes("waarde in eur") || h.includes("value in eur"));
  if (col < 0) col = head.findIndex((h) => h === "waarde" || h === "value");
  if (col < 0) return null;
  let total = 0;
  let count = 0;
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delim);
    const n = toNumber(cells[col] ?? "");
    if (n !== null) {
      total += n;
      count++;
    }
  }
  return count > 0 ? { total, count, column: splitLine(lines[0], delim)[col] } : null;
}


const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};
const dateNl = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });

const TRIGGERS = [
  "Een salarisaanbod, promotie of baanwissel.",
  "Een besluit over samen kopen, of een vaste startdatum van je partner.",
  "De hypotheekrente wijkt meer dan 0,5 procentpunt af van de aanname.",
  "De woningprijzen in je zoekregio wijken ongeveer 10% af van het gekozen pad.",
  "Een wijziging in NHG, startersvrijstelling, hypotheekrenteaftrek of box 3.",
  "Een grote gebeurtenis: schenking, erfenis, bonus of een auto.",
];

// What is due now: assumptions whose check date has passed, and the moments of the year.
function DuePanel() {
  const { doc, today, markChecked, scenario } = usePlan();
  const [every, setEvery] = useState(6);
  const month = Number(today.slice(5, 7));
  const due = Object.entries(doc.meta)
    .filter(([, m]) => m.nextCheck <= addMonths(today, 1))
    .sort((u, v) => u[1].nextCheck.localeCompare(v[1].nextCheck));
  const seasonal: string[] = [];
  if (month >= 10) seasonal.push("Na Prinsjesdag: werk de wetsparameters van het volgende jaar bij (tabblad Belasting, Wetsparameters per jaar): NHG-grens, startersgrens, aftrektarief en box 3.");
  if (month <= 2) seasonal.push("Nieuw jaar: leg je saldi, je salaris uit de jaaropgave en je studieschuld vast met een nieuwe meting hieronder.");
  const checks = scenario.id ? TRIGGERS : [];

  return (
    <Block title="Wat moet nu bijgewerkt worden?" sub="Aannames met een controledatum die voorbij is of binnen een maand komt.">
      {seasonal.map((t) => (
        <p key={t} className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t}</p>
      ))}
      {due.length === 0 ? (
        <p className="text-sm text-gray-600">Alle aannames zijn recent gecontroleerd.</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Volgende controle over
            <select value={every} onChange={(e) => setEvery(Number(e.target.value))} className="min-h-[40px] rounded-lg border border-gray-300 bg-white px-2 text-sm">
              <option value={3}>3 maanden</option>
              <option value={6}>6 maanden</option>
              <option value={12}>12 maanden</option>
            </select>
          </label>
          <ul className="divide-y divide-gray-100">
            {due.map(([id, m]) => (
              <li key={id} className="space-y-1 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-gray-900">{FIELD_BY_ID.get(id)?.label ?? id}</span>
                  <span className={`shrink-0 text-xs ${m.nextCheck < today ? "font-medium text-amber-700" : "text-gray-500"}`}>
                    {m.nextCheck < today ? "te laat sinds " : "uiterlijk "}
                    {dateNl(m.nextCheck)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Bron: {m.url ? <a href={m.url} target="_blank" rel="noreferrer" className="text-teal-700 underline">{m.source}</a> : m.source}. Laatst gecontroleerd {dateNl(m.checkedOn)}.
                </p>
                {m.note && <p className="text-xs text-gray-500">{m.note}</p>}
                <button type="button" onClick={() => markChecked(id, addMonths(today, every))} className="min-h-[40px] text-sm font-medium text-teal-700 underline">
                  Gecontroleerd, nog goed
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="space-y-1.5 border-t border-gray-100 pt-3">
        <p className="text-sm font-medium text-gray-900">Doe ook een tussentijdse update bij</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          {checks.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </Block>
  );
}

// How the plan looks now compared with the previous time it was saved.
function DriftPanel() {
  const { doc, scenario, variant, result } = usePlan();
  const snaps = doc.snapshots.filter((q) => q.scenarioId === scenario.id && q.variant === variant);
  const last = snaps[snaps.length - 1];
  const prev = snaps[snaps.length - 2];
  const ti = result.sim.checkpoints.indexOf(result.targetMonth);
  const now = { need: result.purchase.needTotal, wealth: result.sim.p10[ti] ?? 0, prob: result.probEnough, loan: result.purchase.loan, shortfall: result.shortfall };
  const base = last ?? null;
  const delta = (a: number, b: number) => a - b;
  const row = (label: string, cur: number, old: number | undefined, fmt: (n: number) => string, goodWhenUp: boolean) => {
    const d = old === undefined ? null : delta(cur, old);
    return (
      <Row
        key={label}
        label={label}
        value={fmt(cur)}
        sub={d === null ? "nog niet eerder opgeslagen" : d === 0 ? "ongewijzigd" : `${d > 0 ? "+" : "−"}${fmt(Math.abs(d))} sinds ${dateNl(base!.date)}`}
        tone={d === null || d === 0 ? undefined : (d > 0) === goodWhenUp ? "good" : "bad"}
      />
    );
  };
  void prev;
  return (
    <Block title="Wat is er verschoven?" sub={`${scenario.name}, variant ${variant}, tegenover de laatste keer opslaan`}>
      <List>
        {row("Wat je nodig hebt", now.need, base?.need, euro, false)}
        {row("Wat je hebt (tegenvallend)", now.wealth, base?.wealth, euro, true)}
        {row("Kans dat het lukt", now.prob * 100, base ? base.prob * 100 : undefined, (n) => `${Math.round(n)}%`, true)}
        {row("Hypotheek", now.loan, base?.loan, euro, true)}
        {row("Tekort (negatief = overschot)", now.shortfall, base?.shortfall, euro, false)}
      </List>
      <Note>Elke keer dat je opslaat bewaart het plan een momentopname per scenario en variant. Zo zie je hoe je situatie verschuift met de jaren.</Note>
    </Block>
  );
}

function HistoryPanel() {
  const { doc, scenario } = usePlan();
  const rows = doc.history.filter((h) => h.scenario === scenario.id).slice(-30).reverse();
  return (
    <Section title="Geschiedenis van je aannames" hint={`${rows.length} wijzigingen bewaard voor dit scenario`}>
      {rows.length === 0 ? (
        <Note>Nog geen wijzigingen bewaard. Zodra je een aanname verandert en opslaat, staat de oude waarde hier met de datum.</Note>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((h, i) => (
            <li key={i} className="py-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-gray-900">{h.label}</span>
                <span className="shrink-0 text-xs text-gray-400">{dateNl(h.date)}</span>
              </div>
              <p className="text-xs text-gray-600">
                {h.from} → <strong>{h.to}</strong>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export default function UpdatePage() {
  const { result: r, b, x, app, patchX, patchB } = usePlan();
  const today = app.today;
  const [date, setDate] = useState(today);
  const [grossYou, setGrossYou] = useState(b.incomeGrossYear);
  const [grossPartner, setGrossPartner] = useState(b.partnerIncomeGrossYear);
  const [savings, setSavings] = useState(app.savingsNow);
  const [bonds, setBonds] = useState(x.startBonds);
  const [stocks, setStocks] = useState(app.investNow);
  const [studyDebt, setStudyDebt] = useState(Math.round(app.study.balanceNow));
  const [note, setNote] = useState("");
  const [rebase, setRebase] = useState(true);
  const [csv, setCsv] = useState<{ total: number; count: number; column: string; name: string } | { error: string } | null>(null);

  const startTotal = b.startSavings + x.startBonds + b.startInvest;
  const expectedAt = (iso: string): number | null => {
    const m = monthsBetween(x.startDate, iso);
    if (m < 0) return null;
    const pts: [number, number][] = [[0, startTotal], ...r.sim.checkpoints.map((c, i): [number, number] => [c, r.sim.mid[i]])];
    pts.sort((u, v) => u[0] - v[0]);
    if (m > pts[pts.length - 1][0]) return null;
    for (let i = 0; i < pts.length - 1; i++) {
      if (m >= pts[i][0] && m <= pts[i + 1][0]) {
        const span = pts[i + 1][0] - pts[i][0];
        return span === 0 ? pts[i][1] : pts[i][1] + ((m - pts[i][0]) / span) * (pts[i + 1][1] - pts[i][1]);
      }
    }
    return null;
  };

  const actualTotal = savings + bonds + stocks;
  const expected = expectedAt(date);
  const delta = expected === null ? null : actualTotal - expected;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const p = parsePortfolio(text);
    setCsv(p ? { ...p, name: file.name } : { error: "Ik herken de kolom met de waarde in euro niet. Gebruik de export van het overzicht Portefeuille." });
  };

  const add = () => {
    const entry: CheckIn = {
      id: crypto.randomUUID(),
      date,
      grossYou,
      grossPartner,
      savings,
      bonds,
      stocks,
      studyDebt,
      note: note.trim(),
      expectedTotal: expected,
      actualTotal,
    };
    patchX((cur) => ({
      ...cur,
      checkins: [...cur.checkins, entry].sort((u, v) => u.date.localeCompare(v.date)),
      ...(rebase ? { startDate: date, startBonds: bonds } : {}),
    }));
    if (rebase) patchB((cur) => ({ ...cur, startSavings: savings, startInvest: stocks, incomeGrossYear: grossYou || cur.incomeGrossYear, partnerIncomeGrossYear: grossPartner || cur.partnerIncomeGrossYear }));
    setNote("");
  };

  const hist = [...x.checkins].sort((u, v) => u.date.localeCompare(v.date));

  return (
    <div className="space-y-4">
      <Banner level="info" title="Eens per jaar bijwerken">
        Leg hier vast hoe het er echt voor staat: je salaris, je saldi en je schuld. Het plan vergelijkt dat met wat het verwachtte en rekent daarna vanaf je echte stand verder. Zo blijft het plan kloppen, ook als je situatie verandert.
      </Banner>

      <DuePanel />
      <DriftPanel />

      <Block title="Nieuwe meting" sub="Vul in wat er nu is. Wat de app al weet staat er vast in.">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">Datum</span>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="box-border min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base" />
          </label>
          <div />
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">Jouw bruto jaarsalaris</span>
            <NumberBox value={grossYou} onChange={setGrossYou} unit="€" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">Partner, bruto per jaar</span>
            <NumberBox value={grossPartner} onChange={setGrossPartner} unit="€" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">Gespaard</span>
            <NumberBox value={savings} onChange={setSavings} unit="€" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">Obligaties</span>
            <NumberBox value={bonds} onChange={setBonds} unit="€" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">Aandelen en beleggingen</span>
            <NumberBox value={stocks} onChange={setStocks} unit="€" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">Studieschuld</span>
            <NumberBox value={studyDebt} onChange={setStudyDebt} unit="€" />
          </label>
        </div>
        <button
          type="button"
          onClick={() => {
            setSavings(app.savingsNow);
            setStocks(app.investNow);
            setStudyDebt(Math.round(app.study.balanceNow));
          }}
          className="min-h-[44px] text-sm text-sky-700 underline"
        >
          Vul in vanuit mijn potjes en studielening ({euro(app.savingsNow)} gespaard, {euro(app.investNow)} belegd)
        </button>

        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-900">Beleggingen uit een DEGIRO-bestand</p>
          <p className="text-xs text-gray-600">
            Kies in DEGIRO het overzicht <em>Portefeuille</em> en download het als CSV. Het bestand wordt in je browser gelezen en nergens naartoe gestuurd. Het plan telt de kolom &quot;Waarde in EUR&quot; bij elkaar op.
          </p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="block w-full text-sm" />
          {csv && "error" in csv && <p className="text-sm text-red-600">{csv.error}</p>}
          {csv && "total" in csv && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
              <span>
                {csv.count} regels in &quot;{csv.column}&quot; samen {euro(csv.total)}
              </span>
              <button type="button" onClick={() => setStocks(Math.round(csv.total))} className="min-h-[40px] shrink-0 font-medium text-teal-700 underline">
                Gebruik als beleggingen
              </button>
            </div>
          )}
          <p className="text-xs text-gray-500">Zit er cash in je DEGIRO-account, dan staat dat ook in dit overzicht. Pas het bedrag aan als je dat bij sparen telt.</p>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notitie, bijvoorbeeld nieuwe baan of promotie"
          className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
        />

        <List>
          <Row label="Totaal vermogen (sparen, obligaties, beleggingen)" value={euro(actualTotal)} strong />
          <Row label="Het plan verwachtte op deze datum" value={expected === null ? "nog niet te berekenen" : euro(expected)} how="Het verwachte verloop van het plan (vaste rendementen), geïnterpoleerd tussen de jaren." />
          {delta !== null && (
            <Row label={delta >= 0 ? "Je loopt voor op het plan" : "Je loopt achter op het plan"} value={euro(Math.abs(delta))} strong tone={delta >= 0 ? "good" : "bad"} />
          )}
        </List>

        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input type="checkbox" checked={rebase} onChange={(e) => setRebase(e.target.checked)} className="mt-1 h-5 w-5" />
          <span>Gebruik deze meting als nieuw startpunt: het plan rekent vanaf deze datum verder met deze saldi en dit salaris.</span>
        </label>
        <button
          type="button"
          onClick={add}
          className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800"
        >
          Meting toevoegen
        </button>
        <Note>Daarna kun je rechtsonder op Opslaan tikken. Pas dan wordt de meting bewaard.</Note>
      </Block>

      <HistoryPanel />

      <Block title="Eerdere metingen" sub="Wat je vastlegde, tegenover wat het plan verwachtte.">
        {hist.length === 0 ? (
          <Note>Nog geen metingen. Doe de eerste hierboven, bijvoorbeeld op je verjaardag of in januari.</Note>
        ) : (
          <>
            <LineChart
              labels={hist.map((h) => h.date.slice(0, 4))}
              lines={[
                { label: "werkelijk", color: "#0f766e", values: hist.map((h) => h.actualTotal) },
                { label: "verwacht", color: "#6b7280", dash: true, values: hist.map((h) => h.expectedTotal ?? h.actualTotal) },
              ]}
            />
            <Legend items={[{ color: "#0f766e", label: "Werkelijk" }, { color: "#6b7280", label: "Verwacht door het plan", dash: true }]} />
            <ul className="divide-y divide-gray-100">
              {[...hist].reverse().map((h) => {
                const d = h.expectedTotal === null ? null : h.actualTotal - h.expectedTotal;
                return (
                  <li key={h.id} className="space-y-1 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-base font-medium text-gray-900">{new Date(h.date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</span>
                      <span className="text-base font-semibold text-gray-900">{euro(h.actualTotal)}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Gespaard {euro(h.savings)} · obligaties {euro(h.bonds)} · beleggingen {euro(h.stocks)} · studieschuld {euro(h.studyDebt)} · salaris {euro(h.grossYou)}
                    </p>
                    {d !== null && <p className={`text-xs ${d >= 0 ? "text-green-700" : "text-red-600"}`}>{d >= 0 ? "Voor" : "Achter"} op het plan met {euro(Math.abs(d))}</p>}
                    {h.note && <p className="text-xs italic text-gray-600">{h.note}</p>}
                    <button
                      type="button"
                      onClick={() => patchX((cur) => ({ ...cur, checkins: cur.checkins.filter((c) => c.id !== h.id) }))}
                      className="min-h-[36px] text-xs text-red-600 underline"
                    >
                      Verwijderen
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Block>
    </div>
  );
}
