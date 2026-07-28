import { enableBankingFetch } from "./client";

export interface Aspsp {
  name: string;
  country: string;
  logo?: string;
  psu_types: string[];
}

export async function listAspsps(country: string): Promise<Aspsp[]> {
  const data = await enableBankingFetch<{ aspsps: Aspsp[] }>(
    `/aspsps?country=${encodeURIComponent(country)}`
  );
  // This app only ever requests psu_type "personal" — hide ASPSPs that
  // don't support it (e.g. business-only entities like "ING Wholesale
  // Banking") so they can't be picked and fail with a confusing API error.
  return data.aspsps.filter((aspsp) => aspsp.psu_types?.includes("personal"));
}

export interface StartAuthorizationParams {
  aspspName: string;
  aspspCountry: string;
  authRef: string;
  redirectUrl: string;
  validUntil: string;
}

export async function startAuthorization({
  aspspName,
  aspspCountry,
  authRef,
  redirectUrl,
  validUntil,
}: StartAuthorizationParams): Promise<{ url: string }> {
  return enableBankingFetch<{ url: string }>("/auth", {
    method: "POST",
    body: JSON.stringify({
      access: { valid_until: validUntil },
      aspsp: { name: aspspName, country: aspspCountry },
      state: authRef,
      redirect_url: redirectUrl,
      psu_type: "personal",
    }),
  });
}

// GET /sessions/{id} only lists account UIDs (name/currency/IBAN require a
// separate GET /accounts/{uid}/details call per account) — but the initial
// POST /sessions response has sometimes returned full account objects
// instead, for reasons that aren't documented. Accept either shape rather
// than assuming: treating an object as a bare UID string built a malformed
// details URL, which failed silently and corrupted account_uid with the
// whole object (also the root cause of a "sync times out" bug — the same
// corrupted value then went into the transactions URL too).
export type AccountEntry = string | EnableBankingAccountDetails;

export interface CreateSessionResult {
  session_id: string;
  accounts: AccountEntry[];
  access: { valid_until: string };
}

export async function createSession(code: string): Promise<CreateSessionResult> {
  return enableBankingFetch<CreateSessionResult>("/sessions", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

// Some ASPSPs populate the session's account list asynchronously right
// after authorization — poll a couple of times before concluding there's
// genuinely nothing there.
export async function createSessionWithRetry(code: string): Promise<CreateSessionResult> {
  const session = await createSession(code);
  if (session.accounts.length > 0) return session;

  for (let attempt = 0; attempt < 2; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const retried = await enableBankingFetch<CreateSessionResult>(
      `/sessions/${session.session_id}`
    );
    if (retried.accounts.length > 0) return retried;
  }
  return session;
}

export interface EnableBankingAccountDetails {
  uid: string;
  name?: string;
  currency?: string;
  account_id?: { iban?: string };
}

export async function getAccountDetails(
  accountUid: string
): Promise<EnableBankingAccountDetails> {
  return enableBankingFetch<EnableBankingAccountDetails>(`/accounts/${accountUid}/details`);
}
