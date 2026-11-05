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
  // You, as a member of that list (needed to add an expense to it).
  memberId?: string;
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
        balance?: {
          list?: { id?: unknown; name?: unknown };
          member?: { id?: unknown };
          amount?: { currency?: unknown; fractional?: unknown };
        };
      }
    )?.balance;
    const cents = Number(b?.amount?.fractional);
    const currency = typeof b?.amount?.currency === "string" ? b.amount.currency : null;
    const id = typeof b?.list?.id === "string" ? b.list.id : null;
    if (!id || !currency || !Number.isFinite(cents)) continue;
    lists.push({
      id,
      name: typeof b?.list?.name === "string" ? b.list.name.trim() : "Lijst",
      currency,
      amount: cents / 100,
      memberId: typeof b?.member?.id === "string" ? b.member.id : undefined,
    });
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

export interface WbwSession {
  headers: Record<string, string>;
  loginMs: number;
}

// Logs in like the website does and returns the headers (with the session
// cookie) for the calls that follow.
export async function wbwLogin(): Promise<WbwSession> {
  const t0 = Date.now();
  const email = process.env.WBW_EMAIL;
  const password = process.env.WBW_PASSWORD;
  if (!email || !password) throw new Error("WBW_EMAIL en WBW_PASSWORD staan nog niet in Vercel.");

  const headers: Record<string, string> = { ...HEADERS, "X-Device-Id": DEVICE_ID };
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
  return { headers: { ...headers, Cookie: cookie }, loginMs: Date.now() - t0 };
}

export async function fetchWbwBalances(): Promise<WbwListBalance[]> {
  return (await fetchWbwBalancesTimed()).lists;
}

// Same, plus how long each step took (the sync button shows it to find what is slow).
export async function fetchWbwBalancesTimed(
  session?: WbwSession
): Promise<{ lists: WbwListBalance[]; timings: WbwTimings }> {
  const s = session ?? (await wbwLogin());
  const t1 = Date.now();
  const res = await fetch(`${BASE}/balances`, { headers: s.headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Saldo's ophalen bij WieBetaaltWat mislukt (status ${res.status}).`);
  const lists = parseWbwBalances(await res.json());
  return { lists, timings: { loginMs: s.loginMs, balancesMs: Date.now() - t1 } };
}

// A person in a WieBetaaltWat list. The e-mail address is deliberately not kept.
export interface WbwMember {
  id: string;
  nickname: string;
  fullName: string;
  archived: boolean;
}

export function parseWbwMembers(json: unknown): WbwMember[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new Error("WieBetaaltWat gaf een onverwacht antwoord (geen deelnemers).");
  const members: WbwMember[] = [];
  for (const item of data) {
    const m = (item as { member?: Record<string, unknown> })?.member;
    if (!m || typeof m.id !== "string") continue;
    members.push({
      id: m.id,
      nickname: typeof m.nickname === "string" ? m.nickname.trim() : "",
      fullName: typeof m.full_name === "string" ? m.full_name.trim() : "",
      archived: m.archived === true,
    });
  }
  return members;
}

export async function fetchWbwListMembers(session: WbwSession, listId: string): Promise<WbwMember[]> {
  const res = await fetch(`${BASE}/lists/${encodeURIComponent(listId)}/members?page=0&per_page=50`, {
    headers: session.headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Deelnemers ophalen bij WieBetaaltWat mislukt (status ${res.status}).`);
  return parseWbwMembers(await res.json());
}

export interface NewWbwExpense {
  listId: string;
  name: string;
  payedById: string; // member who paid (you)
  date: string; // YYYY-MM-DD
  shares: { memberId: string; cents: number }[]; // exact amounts; must add up to the total
}

// Builds the body of "add expense": the paid total with one exact share per
// member. The shares must add up to the total to the cent.
export function buildWbwExpenseBody(e: NewWbwExpense, newId: () => string) {
  const totalCents = e.shares.reduce((sum, s) => sum + s.cents, 0);
  const money = (cents: number) => ({ currency: "EUR", fractional: cents });
  return {
    expense: {
      id: newId(),
      name: e.name,
      payed_by_id: e.payedById,
      payed_on: e.date,
      source_amount: money(totalCents),
      amount: money(totalCents),
      exchange_rate: 1,
      shares_attributes: e.shares.map((s) => ({
        id: newId(),
        member_id: s.memberId,
        meta: { type: "exact" },
        amount: money(s.cents),
        source_amount: money(s.cents),
      })),
    },
  };
}

// Adds one expense to a list. This is the only write to WieBetaaltWat.
export async function createWbwExpense(session: WbwSession, e: NewWbwExpense): Promise<{ id: string }> {
  if (e.shares.length === 0 || e.shares.some((s) => !Number.isInteger(s.cents) || s.cents < 0)) {
    throw new Error("De verdeling voor WieBetaaltWat klopt niet.");
  }
  const res = await fetch(`${BASE}/lists/${encodeURIComponent(e.listId)}/expenses`, {
    method: "POST",
    headers: { ...session.headers, "Content-Type": "application/json" },
    body: JSON.stringify(buildWbwExpenseBody(e, () => crypto.randomUUID())),
    cache: "no-store",
  });
  if (!res.ok) {
    const reason = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    throw new Error(`Uitgave aanmaken bij WieBetaaltWat mislukt (status ${res.status})${reason ? `: ${reason}` : ""}.`);
  }
  const json = (await res.json().catch(() => null)) as { expense?: { id?: string } } | null;
  return { id: json?.expense?.id ?? "" };
}

// Is an expense still in WieBetaaltWat? WieBetaaltWat keeps a deleted expense in
// the list marked "deleted" and answers 403 when you open it. "deleted" only on a
// clear sign (403, not found, or marked deleted); anything unclear is "unknown"
// and changes nothing. The caller must also check the list itself is reachable,
// because a 403 would look the same if you had lost access to the whole list.
export async function wbwExpenseState(session: WbwSession, expenseId: string): Promise<"present" | "deleted" | "unknown"> {
  const res = await fetch(`${BASE}/expenses/${encodeURIComponent(expenseId)}`, { headers: session.headers, cache: "no-store" });
  if (res.status === 403 || res.status === 404 || res.status === 410) return "deleted";
  if (!res.ok) return "unknown";
  const json = (await res.json().catch(() => null)) as { expense?: { status?: unknown; deleted_at?: unknown } } | null;
  const e = json?.expense;
  if (!e) return "unknown";
  if (e.deleted_at) return "deleted";
  if (typeof e.status === "string" && ["deleted", "removed"].includes(e.status)) return "deleted";
  return "present";
}

// Can you still open this list? Used before concluding an expense is gone: if the
// list itself cannot be reached (left it, no access), nothing is concluded.
export async function wbwListReachable(session: WbwSession, listId: string): Promise<boolean> {
  const res = await fetch(`${BASE}/lists/${encodeURIComponent(listId)}`, { headers: session.headers, cache: "no-store" });
  return res.ok;
}

// Deletes an expense in WieBetaaltWat, like the delete button there. One that is
// already gone (403 or 404) counts as done.
export async function deleteWbwExpense(session: WbwSession, expenseId: string): Promise<void> {
  const res = await fetch(`${BASE}/expenses/${encodeURIComponent(expenseId)}`, {
    method: "DELETE",
    headers: session.headers,
    cache: "no-store",
  });
  if (res.ok || res.status === 403 || res.status === 404 || res.status === 410) return;
  throw new Error(`Verwijderen bij WieBetaaltWat mislukt (status ${res.status}).`);
}

// One expense of a WieBetaaltWat list, reduced to what is needed to import it.
export interface WbwExpense {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  status: string; // "active" or "deleted"
  payerId: string;
  category: string | null; // WieBetaaltWat's main category, e.g. "Huishoudelijke uitgaven"
  // Your part in cents (euro), 0 when you have none.
  myShareCents: number;
  // The whole expense and everyone's part in it, in cents (euro).
  totalCents: number;
  shares: { memberId: string; cents: number; weight: string | null }[];
}

// How a share was set in WieBetaaltWat: a factor ("2x"), a percentage or an exact amount.
function shareWeight(meta: unknown): string | null {
  const m = meta as { type?: unknown; multiplier?: unknown; percent?: unknown; percentage?: unknown } | null | undefined;
  if (!m || typeof m.type !== "string") return null;
  if (m.type === "factor") {
    const x = Number(m.multiplier);
    return Number.isFinite(x) && x > 0 ? `${String(x).replace(".", ",")}x` : null;
  }
  if (m.type === "percent") {
    const p = Number(m.percent ?? m.percentage);
    return Number.isFinite(p) ? `${String(p).replace(".", ",")}%` : "percentage";
  }
  if (m.type === "exact") return "vast bedrag";
  return null;
}

export function parseWbwExpenses(json: unknown, myMemberId: string): WbwExpense[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new Error("WieBetaaltWat gaf een onverwacht antwoord (geen uitgaven).");
  const out: WbwExpense[] = [];
  for (const item of data) {
    const e = (item as { expense?: Record<string, unknown> })?.expense;
    if (!e || typeof e.id !== "string") continue; // incomes and payments between members are not imported
    const shares = Array.isArray(e.shares) ? (e.shares as { share?: Record<string, unknown> }[]) : [];
    const mine = shares.find((s) => s.share?.member_id === myMemberId)?.share;
    const amount = mine?.amount as { currency?: unknown; fractional?: unknown } | undefined;
    const cents = amount && amount.currency === "EUR" ? Number(amount.fractional) : 0;
    const category = (e.category as { main_description?: unknown } | null)?.main_description;
    const allShares = shares.flatMap((s) => {
      const sh = s.share;
      const a = sh?.amount as { currency?: unknown; fractional?: unknown } | undefined;
      const c = a && a.currency === "EUR" ? Number(a.fractional) : NaN;
      return typeof sh?.member_id === "string" && Number.isFinite(c) && c > 0 ? [{ memberId: sh.member_id, cents: c, weight: shareWeight(sh.meta) }] : [];
    });
    const total = (e.amount as { currency?: unknown; fractional?: unknown } | undefined)?.fractional;
    out.push({
      id: e.id,
      name: typeof e.name === "string" ? e.name.trim() : "",
      date: typeof e.payed_on === "string" ? e.payed_on.slice(0, 10) : "",
      status: typeof e.status === "string" ? e.status : "active",
      payerId: typeof e.payed_by_id === "string" ? e.payed_by_id : "",
      category: typeof category === "string" ? category : null,
      myShareCents: Number.isFinite(cents) && cents > 0 ? cents : 0,
      totalCents: Number.isFinite(Number(total)) ? Number(total) : allShares.reduce((sum, x) => sum + x.cents, 0),
      shares: allShares,
    });
  }
  return out;
}

// All expenses of a list from a date on (newest first, so it stops at the first
// page that is entirely older). Deleted expenses are included, marked as such.
export async function fetchWbwListExpenses(
  session: WbwSession,
  listId: string,
  myMemberId: string,
  fromDate: string
): Promise<WbwExpense[]> {
  const all: WbwExpense[] = [];
  for (let page = 0; page < 40; page++) {
    const res = await fetch(`${BASE}/lists/${encodeURIComponent(listId)}/list_items?page=${page}&per_page=50`, {
      headers: session.headers,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Uitgaven ophalen bij WieBetaaltWat mislukt (status ${res.status}).`);
    const json = await res.json();
    const expenses = parseWbwExpenses(json, myMemberId);
    all.push(...expenses.filter((e) => e.date >= fromDate));
    const totalPages = Number((json as { pagination?: { total_pages?: unknown } })?.pagination?.total_pages ?? 1);
    // Sorted by date, newest first: once a whole page is older, the rest is too.
    const rawCount = Array.isArray((json as { data?: unknown[] })?.data) ? (json as { data: unknown[] }).data.length : 0;
    if (rawCount === 0 || page + 1 >= totalPages) break;
    if (expenses.length > 0 && expenses.every((e) => e.date < fromDate)) break;
  }
  return all;
}
