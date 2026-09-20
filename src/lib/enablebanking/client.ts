import { SignJWT, importPKCS8 } from "jose";

const API_BASE_URL = "https://api.enablebanking.com";

async function signRequestJwt() {
  const applicationId = process.env.ENABLE_BANKING_APPLICATION_ID!;
  const privateKeyPem = process.env.ENABLE_BANKING_PRIVATE_KEY!;

  const privateKey = await importPKCS8(privateKeyPem, "RS256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: applicationId })
    .setIssuer("enablebanking.com")
    .setAudience("api.enablebanking.com")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}

// Banks limit unattended ("background") data fetches to about 4 per day.
// Passing at least one PSU header tells the bank the user is actively using
// the app, and then that daily limit does not apply (Enable Banking FAQ).
export interface PsuContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function psuHeaders(psu?: PsuContext | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (psu?.ipAddress) headers["Psu-Ip-Address"] = psu.ipAddress;
  if (psu?.userAgent) headers["Psu-User-Agent"] = psu.userAgent;
  return headers;
}

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

// Transient network errors ("fetch failed", timeouts) and 429/5xx responses
// from Enable Banking were surfacing directly as a hard sync failure —
// retry a few times with backoff before giving up.
export async function enableBankingFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const jwt = await signRequestJwt();

      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.text();
        const error = new Error(
          `Enable Banking request failed: ${response.status} ${path} — ${body}`
        );
        // Only retry on rate-limiting/server errors — a 4xx like a bad
        // request or expired consent won't succeed on retry.
        // The daily background limit can't be retried away — waiting a
        // second won't help, only time (or a user-present request) does.
        const dailyLimit = body.includes("ASPSP_RATE_LIMIT_EXCEEDED");
        if (!dailyLimit && (response.status === 429 || response.status >= 500)) {
          lastError = error;
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * attempt));
            continue;
          }
        }
        throw error;
      }

      return response.json() as Promise<T>;
    } catch (err) {
      lastError = err;
      const isNetworkError = err instanceof TypeError; // fetch's own failure mode
      if (isNetworkError && attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * attempt));
        continue;
      }
      if (!isNetworkError) throw err;
    }
  }

  throw lastError;
}
