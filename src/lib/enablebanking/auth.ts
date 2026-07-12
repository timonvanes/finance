import { enableBankingFetch } from "./client";

export interface Aspsp {
  name: string;
  country: string;
  logo?: string;
}

export async function listAspsps(country: string): Promise<Aspsp[]> {
  const data = await enableBankingFetch<{ aspsps: Aspsp[] }>(
    `/aspsps?country=${encodeURIComponent(country)}`
  );
  return data.aspsps;
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

export interface EnableBankingAccount {
  uid: string;
  name?: string;
  currency?: string;
}

export interface CreateSessionResult {
  session_id: string;
  accounts: EnableBankingAccount[];
  access: { valid_until: string };
}

export async function createSession(code: string): Promise<CreateSessionResult> {
  return enableBankingFetch<CreateSessionResult>("/sessions", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
