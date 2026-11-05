"use client";

import { useState } from "react";
import { Banner, Block, LineChart, Legend, List, Note, NumberBox, Row, euro } from "../ui";
import { usePlan } from "../plan-provider";
import { monthsBetween } from "@/lib/plan/model";
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
