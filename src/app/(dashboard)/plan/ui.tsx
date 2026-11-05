"use client";

import { useState, type ReactNode } from "react";
import { FIELD_BY_ID, VARIANT_FIELDS, whyText } from "@/lib/plan/fields";
import { SOURCE_LABEL, VARIANTS, type Source } from "@/lib/plan/types";
import { fieldValue, usePlan } from "./plan-provider";

export const euro = (n: number, digits = 0) =>
  n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: digits, minimumFractionDigits: digits });
export const pct = (n: number, digits = 1) => `${n.toFixed(digits).replace(".", ",")}%`;
export const card = "rounded-2xl bg-white ring-1 ring-gray-200";

const SRC_STYLE: Record<Source, string> = {
  user: "bg-gray-100 text-gray-600",
  app: "bg-sky-100 text-sky-800",
  law: "bg-teal-100 text-teal-800",
  assume: "bg-amber-100 text-amber-800",
  calc: "bg-violet-100 text-violet-800",
};

export function SrcBadge({ src }: { src: Source }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${SRC_STYLE[src]}`}>{SOURCE_LABEL[src]}</span>;
}

// ------------------------------------------------------------------- inputs

const fmtInput = (n: number) => (Number.isFinite(n) ? String(n).replace(".", ",") : "");
const parseInput = (s: string): number | null => {
  const t = s.trim().replace(/\./g, (m, i, all) => (all.indexOf(",") >= 0 ? "" : m)).replace(",", ".");
  if (t === "" || t === "-") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const inputCls =
  "box-border min-h-[48px] w-full min-w-0 max-w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 text-base";

export function NumberBox({
  value,
  onChange,
  unit,
  placeholder,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        value={text ?? (value === 0 && placeholder ? "" : fmtInput(value))}
        placeholder={placeholder}
        onFocus={() => setText(value === 0 ? "" : fmtInput(value))}
        onBlur={() => setText(null)}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseInput(e.target.value);
          if (n !== null) onChange(n);
        }}
        className={`${inputCls} ${unit ? "pr-9" : ""} ${className ?? ""}`}
      />
      {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{unit}</span>}
    </div>
  );
}

// A field of the plan, drawn from the registry: name, source and the why.
export function F({ id }: { id: string }) {
  const { b, x, app, setField, scenario, variant, doc } = usePlan();
  const f = FIELD_BY_ID.get(id);
  const [open, setOpen] = useState(false);
  if (!f) return null;
  const v = f.get(b, x);
  const appVal = f.appValue?.(app);
  const differs = appVal !== undefined && typeof v === "number" && Math.abs(appVal - v) > 0.5;
  const unit = f.unit === "€" ? "€" : f.unit === "%" ? "%" : f.unit === "jaar" ? "jr" : f.unit === "mnd" ? "mnd" : undefined;

  let control: ReactNode;
  if (f.kind === "bool") {
    control = (
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(v)}
        onClick={() => setField(id, !v)}
        className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border px-3 text-base ${v ? "border-teal-600 bg-teal-50 text-teal-900" : "border-gray-300 bg-white text-gray-600"}`}
      >
        <span>{v ? "Ja" : "Nee"}</span>
        <span className={`h-6 w-11 rounded-full p-0.5 transition ${v ? "bg-teal-600" : "bg-gray-300"}`}>
          <span className={`block h-5 w-5 rounded-full bg-white transition ${v ? "translate-x-5" : ""}`} />
        </span>
      </button>
    );
  } else if (f.kind === "select") {
    control = (
      <select value={String(v)} onChange={(e) => setField(id, e.target.value)} className={inputCls}>
        {f.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (f.kind === "date") {
    control = <input type="date" value={String(v)} onChange={(e) => setField(id, e.target.value)} className={inputCls} />;
  } else {
    control = <NumberBox value={Number(v)} onChange={(n) => setField(id, n)} unit={unit} />;
  }

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm text-gray-600">{f.label}</span>
        <button type="button" onClick={() => setOpen(!open)} className="shrink-0" aria-expanded={open} aria-label="Waar komt dit vandaan?">
          <SrcBadge src={f.src} />
        </button>
      </div>
      {control}
      {open && <p className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">{whyText(f, app)}</p>}
      {VARIANT_FIELDS.has(id) && (
        <p className="mt-1 text-[11px] text-gray-500">
          {VARIANTS.map((vv, i) => {
            const val = fieldValue(scenario, vv.key, id);
            const txt = typeof val === "number" ? `${String(Math.round(val * 100) / 100).replace(".", ",")}${f.unit === "%" ? "%" : f.unit === "€" ? " euro" : ""}` : String(val ?? "");
            return (
              <span key={vv.key} className={vv.key === variant ? "font-semibold text-gray-800" : ""}>
                {i > 0 && " · "}
                {vv.label} {txt}
              </span>
            );
          })}
        </p>
      )}
      {doc.meta[id] && (
        <p className="mt-1 text-[11px] text-gray-400">
          Gecontroleerd {new Date(doc.meta[id].checkedOn).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
          {doc.meta[id].nextCheck < app.today && <span className="font-medium text-amber-700"> · controle is aan de beurt</span>}
        </p>
      )}
      {differs && (
        <button type="button" onClick={() => setField(id, Math.round(appVal))} className="mt-1 text-xs text-sky-700 underline">
          Je app zegt {euro(appVal)}, gebruik dat
        </button>
      )}
    </div>
  );
}

export function Grid({ ids, cols = 2 }: { ids: string[]; cols?: 1 | 2 }) {
  return (
    <div className={`grid gap-3 ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {ids.map((id) => (
        <F key={id} id={id} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------- layout

export function Section({ title, hint, children, open = false }: { title: string; hint?: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className={`${card} group`}>
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-5 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-base font-medium text-gray-900">{title}</span>
          {hint && <span className="block text-xs text-gray-500">{hint}</span>}
        </span>
        <span className="text-2xl text-gray-300 transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-4 border-t border-gray-100 p-5">{children}</div>
    </details>
  );
}

export function Block({ title, sub, children }: { title?: string; sub?: string; children: ReactNode }) {
  return (
    <section className={`${card} space-y-3 p-5`}>
      {title && (
        <div>
          <h2 className="text-base font-medium text-gray-900">{title}</h2>
          {sub && <p className="text-xs text-gray-500">{sub}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

// A number the plan calculated, with how it was calculated one tap away.
export function Stat({
  label,
  value,
  sub,
  how,
  tone = "default",
  big = false,
  src = "calc",
}: {
  label: string;
  value: string;
  sub?: string;
  how?: string;
  tone?: "default" | "good" | "bad" | "warn";
  big?: boolean;
  src?: Source;
}) {
  const [open, setOpen] = useState(false);
  const color = tone === "good" ? "text-green-700" : tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-700" : "text-gray-900";
  return (
    <div className="min-w-0">
      <button type="button" onClick={() => how && setOpen(!open)} className="block w-full text-left" disabled={!how}>
        <p className="flex items-center gap-1.5 text-sm text-gray-500">
          {label}
          {how && <SrcBadge src={src} />}
        </p>
        <p className={`${big ? "text-3xl" : "text-xl"} font-semibold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </button>
      {open && how && <p className="mt-1.5 rounded-lg bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-900">{how}</p>}
    </div>
  );
}

export function Row({ label, value, sub, strong, how, tone }: { label: string; value: string; sub?: string; strong?: boolean; how?: string; tone?: "good" | "bad" }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-2">
      <button type="button" onClick={() => how && setOpen(!open)} disabled={!how} className="flex w-full items-baseline justify-between gap-3 text-left">
        <span className={`min-w-0 text-sm ${strong ? "font-medium text-gray-900" : "text-gray-600"}`}>
          {label}
          {sub && <span className="block text-xs text-gray-400">{sub}</span>}
        </span>
        <span className={`shrink-0 text-sm ${strong ? "font-semibold" : "font-medium"} ${tone === "good" ? "text-green-700" : tone === "bad" ? "text-red-600" : "text-gray-900"}`}>{value}</span>
      </button>
      {open && how && <p className="mt-1 rounded-lg bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-900">{how}</p>}
    </li>
  );
}

export const List = ({ children }: { children: ReactNode }) => <ul className="divide-y divide-gray-100">{children}</ul>;

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-gray-500">{children}</p>;
}

export function Banner({ level, title, children }: { level: "ok" | "info" | "warn" | "bad"; title: string; children: ReactNode }) {
  const cls = {
    ok: "border-green-200 bg-green-50 text-green-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    bad: "border-red-200 bg-red-50 text-red-900",
  }[level];
  const dot = { ok: "bg-green-600", info: "bg-sky-600", warn: "bg-amber-500", bad: "bg-red-600" }[level];
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <p className="flex items-start gap-2 text-sm font-medium">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
        {title}
      </p>
      <p className="mt-1 pl-4 text-sm leading-relaxed opacity-90">{children}</p>
    </div>
  );
}

// -------------------------------------------------------------------- charts

export function LineChart({
  labels,
  lines,
  band,
  need,
  height = 190,
  money = true,
}: {
  labels: string[];
  lines: { label: string; color: string; values: number[]; dash?: boolean; width?: number }[];
  band?: { lo: number[]; hi: number[]; color: string };
  need?: number[];
  height?: number;
  money?: boolean;
}) {
  const W = 340;
  const H = height;
  const pad = { l: 44, r: 8, t: 10, b: 22 };
  const n = labels.length;
  const all = [...lines.flatMap((l) => l.values), ...(band ? [...band.hi, ...band.lo] : []), ...(need ?? [])];
  const max = Math.max(1, ...all) * 1.05;
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const fmt = (v: number) => (money ? (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))) : String(Math.round(v)));
  const step = Math.max(1, Math.ceil(n / 7));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-gray-100" />
          <text x={pad.l - 4} y={y(t) + 3} textAnchor="end" className="fill-gray-400 text-[9px]">
            {fmt(t)}
          </text>
        </g>
      ))}
      {band && (
        <polygon
          fill={band.color}
          opacity="0.18"
          points={[...band.hi.map((v, i) => `${x(i)},${y(v)}`), ...band.lo.map((v, i) => `${x(i)},${y(v)}`).reverse()].join(" ")}
        />
      )}
      {need && (
        <polyline fill="none" stroke="#ef4444" strokeWidth="1.8" strokeDasharray="4 3" points={need.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      )}
      {lines.map((l) => (
        <polyline
          key={l.label}
          fill="none"
          stroke={l.color}
          strokeWidth={l.width ?? 2}
          strokeDasharray={l.dash ? "4 3" : undefined}
          points={l.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
        />
      ))}
      {labels.map((lab, i) =>
        i % step === 0 || i === n - 1 ? (
          <text key={lab + i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-gray-400 text-[9px]">
            {lab}
          </text>
        ) : null
      )}
    </svg>
  );
}

export function Legend({ items }: { items: { color: string; label: string; dash?: boolean }[] }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5" style={{ background: i.color, opacity: i.dash ? 0.7 : 1 }} />
          {i.label}
        </span>
      ))}
    </p>
  );
}

export function Bar({ value, max, color = "bg-teal-600" }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-2.5 rounded-full bg-gray-100">
      <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0))}%` }} />
    </div>
  );
}
