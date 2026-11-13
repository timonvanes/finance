// Every place in the app that can sit in the bottom bar. What is not in the bar is
// listed under "Meer". Each person picks their own.

export type NavKey =
  | "overview"
  | "transactions"
  | "reclaims"
  | "returns"
  | "plan"
  | "pots"
  | "loans"
  | "notifications"
  | "settings";

export interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  hint: string;
  match: (path: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "overview", href: "/", label: "Overzicht", hint: "Hoe je ervoor staat deze maand", match: (p) => p === "/" },
  { key: "transactions", href: "/transactions", label: "Transacties", hint: "Je afschrijvingen en bijschrijvingen", match: (p) => p.startsWith("/transactions") },
  { key: "reclaims", href: "/terugvorderen", label: "Terugvorderen", hint: "Geld terugvragen aan anderen", match: (p) => p.startsWith("/terugvorderen") },
  { key: "returns", href: "/returns", label: "Retouren", hint: "Bestellingen en retourtermijnen", match: (p) => p.startsWith("/returns") },
  { key: "plan", href: "/plan", label: "Financieel plan", hint: "Huis, hypotheek, inkomen, sparen en beleggen", match: (p) => p.startsWith("/plan") || p.startsWith("/huis") },
  { key: "pots", href: "/pots", label: "Potjes", hint: "Sparen, beleggen en vakantie", match: (p) => p.startsWith("/pots") },
  { key: "loans", href: "/leningen", label: "Leningen", hint: "Geld dat je van iemand hebt geleend", match: (p) => p.startsWith("/leningen") },
  { key: "notifications", href: "/meldingen", label: "Meldingen", hint: "Kies welke pushmeldingen je krijgt", match: (p) => p.startsWith("/meldingen") },
  { key: "settings", href: "/settings", label: "Instellingen", hint: "Maandstart, budgetten, categorieën, banken, account", match: (p) => p.startsWith("/settings") },
];

export const MAX_TABS = 4;
export const DEFAULT_TABS: NavKey[] = ["overview", "transactions", "reclaims", "returns"];

const KEYS = new Set<string>(NAV_ITEMS.map((i) => i.key));

// What is stored may be old or empty: keep only known items, no doubles, at most four.
// Returns drops out when that module is switched off.
export function cleanTabs(raw: unknown, returnsOn: boolean): NavKey[] {
  const list = Array.isArray(raw) ? raw : DEFAULT_TABS;
  const out: NavKey[] = [];
  for (const k of list) {
    if (typeof k !== "string" || !KEYS.has(k) || out.includes(k as NavKey)) continue;
    if (k === "returns" && !returnsOn) continue;
    out.push(k as NavKey);
    if (out.length === MAX_TABS) break;
  }
  return out.length > 0 ? out : DEFAULT_TABS.filter((k) => k !== "returns" || returnsOn);
}

export const isNavKey = (k: unknown): k is NavKey => typeof k === "string" && KEYS.has(k);
