import { createSign, generateKeyPairSync, randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BASE = "https://api.bunq.com";
const USER_AGENT = "finance-app";

export function isBunqConfigured() {
  return Boolean(process.env.BUNQ_API_KEY);
}

interface Creds {
  private_key: string;
  public_key: string;
  installation_token: string;
  session_token: string | null;
  bunq_user_id: number | null;
  monetary_account_id: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function apiKey() {
  const key = process.env.BUNQ_API_KEY;
  if (!key) throw new Error("BUNQ_API_KEY ontbreekt in Vercel.");
  return key;
}

// bunq's current scheme signs only the exact request body (empty for GETs).
function signRequest(body: string, privateKey: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(body, "utf8");
  return signer.sign(privateKey, "base64");
}

async function rawRequest(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; privateKey?: string }
): Promise<{ status: number; json: Json }> {
  const body = opts.body === undefined ? "" : JSON.stringify(opts.body);
  const headers: Record<string, string> = {
    "Cache-Control": "no-cache",
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
    "X-Bunq-Client-Request-Id": randomUUID(),
    "X-Bunq-Geolocation": "0 0 0 0 NL",
    "X-Bunq-Language": "en_US",
    "X-Bunq-Region": "nl_NL",
  };
  if (opts.token) headers["X-Bunq-Client-Authentication"] = opts.token;
  if (opts.privateKey) {
    headers["X-Bunq-Client-Signature"] = signRequest(body, opts.privateKey);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body || undefined, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function errorText(json: Json): string {
  const errors = json?.Error;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors.map((e: Json) => e.error_description ?? e.error_description_translated).filter(Boolean).join("; ");
  }
  return "onbekende fout";
}

function pick(response: Json, key: string): Json | undefined {
  const items = response?.Response;
  if (!Array.isArray(items)) return undefined;
  for (const item of items) if (item && item[key]) return item[key];
  return undefined;
}

async function loadCreds(userId: string): Promise<Creds | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("bunq_credentials").select("*").eq("user_id", userId).maybeSingle();
  return (data as Creds | null) ?? null;
}

async function install(userId: string): Promise<Creds> {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const inst = await rawRequest("POST", "/v1/installation", { body: { client_public_key: publicKey } });
  const token = pick(inst.json, "Token")?.token;
  if (!token) throw new Error(`bunq installatie mislukt: ${errorText(inst.json)}`);

  const dev = await rawRequest("POST", "/v1/device-server", {
    token,
    body: { description: "finance-app", secret: apiKey(), permitted_ips: ["*"] },
  });
  if (dev.status >= 400) throw new Error(`bunq apparaat registreren mislukt: ${errorText(dev.json)}`);

  const creds: Creds = {
    private_key: privateKey,
    public_key: publicKey,
    installation_token: token,
    session_token: null,
    bunq_user_id: null,
    monetary_account_id: null,
  };
  const admin = createAdminClient();
  const { error } = await admin
    .from("bunq_credentials")
    .upsert({ user_id: userId, ...creds, updated_at: new Date().toISOString() });
  if (error) throw error;
  return creds;
}

function userIdFrom(response: Json): number | null {
  const items = response?.Response;
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (item?.UserPerson?.id) return item.UserPerson.id;
    if (item?.UserCompany?.id) return item.UserCompany.id;
    if (item?.UserApiKey) {
      const k = item.UserApiKey;
      return k.requested_by_user?.UserPerson?.id ?? k.granted_by_user?.UserPerson?.id ?? k.id ?? null;
    }
  }
  return null;
}

async function startSession(userId: string, creds: Creds): Promise<Creds> {
  const res = await rawRequest("POST", "/v1/session-server", {
    token: creds.installation_token,
    privateKey: creds.private_key,
    body: { secret: apiKey() },
  });
  const token = pick(res.json, "Token")?.token;
  if (!token) throw new Error(`bunq sessie starten mislukt: ${errorText(res.json)}`);

  let bunqUserId = userIdFrom(res.json);
  if (!bunqUserId) {
    const users = await rawRequest("GET", "/v1/user", { token, privateKey: creds.private_key });
    bunqUserId = userIdFrom(users.json);
  }
  if (!bunqUserId) throw new Error("bunq gebruiker niet gevonden.");

  const next = { ...creds, session_token: token as string, bunq_user_id: bunqUserId };
  const admin = createAdminClient();
  await admin
    .from("bunq_credentials")
    .update({ session_token: token, bunq_user_id: bunqUserId, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return next;
}

async function ensureCreds(userId: string): Promise<Creds> {
  let creds = await loadCreds(userId);
  if (!creds) creds = await install(userId);
  if (!creds.session_token || !creds.bunq_user_id) creds = await startSession(userId, creds);
  return creds;
}

export async function bunqApi(userId: string, method: string, path: string, body?: unknown): Promise<Json> {
  let creds = await ensureCreds(userId);
  const call = () => rawRequest(method, path, { body, token: creds.session_token!, privateKey: creds.private_key });
  let res = await call();
  if (res.status === 401 || res.status === 403) {
    creds = await startSession(userId, creds);
    res = await call();
  }
  if (res.status >= 400) throw new Error(`bunq: ${errorText(res.json)}`);
  return res.json;
}

export async function getBunqAccount(
  userId: string
): Promise<{ userId: number; accountId: number; iban: string | null; name: string }> {
  const creds = await ensureCreds(userId);
  const list = await bunqApi(userId, "GET", `/v1/user/${creds.bunq_user_id}/monetary-account-bank`);
  const accounts = (list?.Response ?? []).map((i: Json) => i.MonetaryAccountBank).filter(Boolean);
  const wanted = process.env.BUNQ_MONETARY_ACCOUNT_ID ? Number(process.env.BUNQ_MONETARY_ACCOUNT_ID) : null;
  const account = wanted
    ? accounts.find((a: Json) => a.id === wanted)
    : accounts.find((a: Json) => a.status === "ACTIVE");
  if (!account) throw new Error("Geen actieve bunq-rekening gevonden.");
  const iban = (account.alias ?? []).find((a: Json) => a.type === "IBAN")?.value ?? null;
  return { userId: creds.bunq_user_id!, accountId: account.id, iban, name: account.description ?? "bunq" };
}
