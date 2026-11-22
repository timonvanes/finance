// Reads the portfolio export of DEGIRO (CSV, Dutch or English column names) and adds up the value
// in euros. Nothing is sent anywhere: this runs in the browser and only the total is kept.

export interface Position {
  product: string;
  value: number; // in euros
  cash: boolean;
}

export type ParsedPortfolio = { ok: true; positions: Position[]; stocksTotal: number; cashTotal: number } | { ok: false; error: string };

// One line of CSV, with quotes. The delimiter is found from the header line.
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// "1.326,24", "1326,24", "EUR 1,326.24" and "1326.24" all become a number.
export function parseAmount(raw: string): number | null {
  let t = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(t)) return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    t = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastComma > -1) {
    // only commas: thousands (1,326) when exactly three digits follow a single comma group, else decimal
    t = /^-?\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (lastDot > -1) {
    t = /^-?\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseDegiroPortfolio(text: string): ParsedPortfolio {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { ok: false, error: "Het bestand is leeg of heeft geen regels." };
  const head = lines[0];
  const delim = [",", ";", "\t"].map((d) => ({ d, n: head.split(d).length })).sort((a, b) => b.n - a.n)[0].d;
  const cols = splitLine(head, delim).map((c) => c.toLowerCase());
  const valueCol = cols.findIndex((c) => /^(waarde in eur|value in eur)/.test(c));
  const productCol = cols.findIndex((c) => /^(product)/.test(c));
  if (valueCol < 0 || productCol < 0) {
    return { ok: false, error: "Ik vind de kolommen \"Product\" en \"Waarde in EUR\" niet. Is dit de export van je portefeuille (niet van je transacties)?" };
  }
  const positions: Position[] = [];
  for (const line of lines.slice(1)) {
    const f = splitLine(line, delim);
    const product = f[productCol] ?? "";
    const value = parseAmount(f[valueCol] ?? "");
    if (!product || value === null) continue;
    if (/^(totaal|total)\b/i.test(product)) continue;
    positions.push({ product, value, cash: /^cash\b/i.test(product) });
  }
  if (positions.length === 0) return { ok: false, error: "Ik vind geen regels met een waarde in euro's in dit bestand." };
  const sum = (cash: boolean) => Math.round(positions.filter((p) => p.cash === cash).reduce((s, p) => s + p.value, 0) * 100) / 100;
  return { ok: true, positions, stocksTotal: sum(false), cashTotal: sum(true) };
}
