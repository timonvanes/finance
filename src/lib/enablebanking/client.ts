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

export async function enableBankingFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
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
    throw new Error(
      `Enable Banking request failed: ${response.status} ${path} — ${body}`
    );
  }

  return response.json() as Promise<T>;
}
