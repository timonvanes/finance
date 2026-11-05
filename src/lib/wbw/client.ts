// Read-only link with WieBetaaltWat. It logs in the way the website does and
// reads the saldo per list from the website's own API. That API is not public
// or documented, so any error says exactly which step failed; nothing here ever
// writes to WieBetaaltWat.

const BASE = "https://app.wiebetaaltwat.nl/api";

export function isWbwConfigured() {
  return Boolean(process.env.WBW_EMAIL && process.env.WBW_PASSWORD);
}

// Your saldo in one WieBetaaltWat list (+ = you still get, - = you still owe).
export interface WbwListBalance {
  id: string;
  name: string;
  currency: string;
  amount: number;
}

// The API returns { data: [{ balance: { list: {id, name}, member, amount: { currency, fractional } } }] }
// with fractional in the smallest unit (cents).
export function parseWbwBalances(json: unknown): WbwListBalance[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new Error("WieBetaaltWat gaf een onverwacht antwoord (geen lijst met saldo's).");

  const lists: WbwListBalance[] = [];
  for (const item of data) {
    const b = (
      item as {
        balance?: { list?: { id?: unknown; name?: unknown }; amount?: { currency?: unknown; fractional?: unknown } };
      }
    )?.balance;
    const cents = Number(b?.amount?.fractional);
    const currency = typeof b?.amount?.currency === "string" ? b.amount.currency : null;
    const id = typeof b?.list?.id === "string" ? b.list.id : null;
    if (!id || !currency || !Number.isFinite(cents)) continue;
    lists.push({ id, name: typeof b?.list?.name === "string" ? b.list.name.trim() : "Lijst", currency, amount: cents / 100 });
  }
  return lists;
}

// Net euro saldo over the lists that count. Other currencies never count.
export function euroSaldo(lists: WbwListBalance[], excluded: string[]): number {
  const skip = new Set(excluded);
  const cents = lists
    .filter((l) => l.currency === "EUR" && !skip.has(l.id))
    .reduce((sum, l) => sum + Math.round(l.amount * 100), 0);
  return cents / 100;
}

// The headers the website's own client sends with every call (read from its
// code). The API answers 400 without the version header.
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "Accept-Version": "11",
  "Accept-Language": "nl",
  "X-App-React": "true",
  "Cache-Control": "no-cache",
  Origin: "https://app.wiebetaaltwat.nl",
  Referer: "https://app.wiebetaaltwat.nl/",
  "User-Agent": "Mozilla/5.0 (compatible; finance-app)",
};

// A stable id for this server, like the device id the website keeps in the browser.
const DEVICE_ID = process.env.WBW_DEVICE_ID || "6f1c2b7e-3a49-4d58-9d0e-5b8a1c2e7f43";

function cookiesFrom(res: Response) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

export interface WbwTimings {
  loginMs: number;
  balancesMs: number;
}

export async function fetchWbwBalances(): Promise<WbwListBalance[]> {
  return (await fetchWbwBalancesTimed()).lists;
}

// Same, plus how long each step took (the sync button shows it to find what is slow).
export async function fetchWbwBalancesTimed(): Promise<{ lists: WbwListBalance[]; timings: WbwTimings }> {
  const t0 = Date.now();
  const email = process.env.WBW_EMAIL;
  const password = process.env.WBW_PASSWORD;
  if (!email || !password) throw new Error("WBW_EMAIL en WBW_PASSWORD staan nog niet in Vercel.");

  const headers = { ...HEADERS, "X-Device-Id": DEVICE_ID };
  const login = await fetch(`${BASE}/users/sign_in`, {
    method: "POST",
    headers,
    body: JSON.stringify({ user: { email, password } }),
    cache: "no-store",
  });
  if (login.status === 401 || login.status === 422) {
    throw new Error("Inloggen bij WieBetaaltWat mislukt: het e-mailadres of wachtwoord klopt niet. Werkt je account alleen met Google of Apple, dan gaat dit niet.");
  }
  if (!login.ok) {
    // The reason the API gives (never the request, so no password) helps to see what is missing.
    const reason = (await login.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    throw new Error(`Inloggen bij WieBetaaltWat mislukt (status ${login.status})${reason ? `: ${reason}` : ""}.`);
  }

  const cookie = cookiesFrom(login);
  if (!cookie) throw new Error("Inloggen bij WieBetaaltWat gaf geen sessie terug.");
  const loginMs = Date.now() - t0;

  const t1 = Date.now();
  const res = await fetch(`${BASE}/balances`, { headers: { ...headers, Cookie: cookie }, cache: "no-store" });
  if (!res.ok) throw new Error(`Saldo's ophalen bij WieBetaaltWat mislukt (status ${res.status}).`);
  const lists = parseWbwBalances(await res.json());
  return { lists, timings: { loginMs, balancesMs: Date.now() - t1 } };
}
