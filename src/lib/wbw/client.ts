// Read-only link with WieBetaaltWat. It logs in the way the website does and
// reads the saldo per list from the website's own API. That API is not public
// or documented, so any error says exactly which step failed; nothing here ever
// writes to WieBetaaltWat.

const BASE = "https://app.wiebetaaltwat.nl/api";

export function isWbwConfigured() {
  return Boolean(process.env.WBW_EMAIL && process.env.WBW_PASSWORD);
}

export interface WbwBalances {
  // Net saldo over all lists in euros (+ = you still get, - = you still owe).
  eur: number;
  lists: number;
  // Lists in another currency; these are not part of the euro saldo.
  other: { currency: string; amount: number }[];
}

// The API returns { data: [{ balance: { list, member, amount: { currency, fractional } } }] }
// with fractional in the smallest unit (cents).
export function parseWbwBalances(json: unknown): WbwBalances {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new Error("WieBetaaltWat gaf een onverwacht antwoord (geen lijst met saldo's).");

  let eurCents = 0;
  let lists = 0;
  const otherCents = new Map<string, number>();
  for (const item of data) {
    const amount = (item as { balance?: { amount?: { currency?: unknown; fractional?: unknown } } })?.balance?.amount;
    const cents = Number(amount?.fractional);
    const currency = typeof amount?.currency === "string" ? amount.currency : null;
    if (!currency || !Number.isFinite(cents)) continue;
    lists++;
    if (currency === "EUR") eurCents += cents;
    else otherCents.set(currency, (otherCents.get(currency) ?? 0) + cents);
  }
  return {
    eur: eurCents / 100,
    lists,
    other: [...otherCents].filter(([, c]) => c !== 0).map(([currency, c]) => ({ currency, amount: c / 100 })),
  };
}

const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  Origin: "https://app.wiebetaaltwat.nl",
  Referer: "https://app.wiebetaaltwat.nl/",
  "User-Agent": "Mozilla/5.0 (compatible; finance-app)",
};

function cookiesFrom(res: Response) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

export async function fetchWbwBalances(): Promise<WbwBalances> {
  const email = process.env.WBW_EMAIL;
  const password = process.env.WBW_PASSWORD;
  if (!email || !password) throw new Error("WBW_EMAIL en WBW_PASSWORD staan nog niet in Vercel.");

  const login = await fetch(`${BASE}/users/sign_in`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ user: { email, password } }),
    cache: "no-store",
  });
  if (login.status === 401 || login.status === 422) {
    throw new Error("Inloggen bij WieBetaaltWat mislukt: het e-mailadres of wachtwoord klopt niet. Werkt je account alleen met Google of Apple, dan gaat dit niet.");
  }
  if (!login.ok) throw new Error(`Inloggen bij WieBetaaltWat mislukt (status ${login.status}).`);

  const cookie = cookiesFrom(login);
  if (!cookie) throw new Error("Inloggen bij WieBetaaltWat gaf geen sessie terug.");

  const res = await fetch(`${BASE}/balances`, { headers: { ...HEADERS, Cookie: cookie }, cache: "no-store" });
  if (!res.ok) throw new Error(`Saldo's ophalen bij WieBetaaltWat mislukt (status ${res.status}).`);
  return parseWbwBalances(await res.json());
}
