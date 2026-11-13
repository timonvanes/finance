import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { enableBankingFetch, psuHeaders, type PsuContext } from "./client";

// Starting a payment at the person's own bank through Enable Banking. The app only prepares
// it: the person approves it in their own bank app (strong customer authentication), so no
// money moves without that. Only transfers between the person's own accounts are made.

export type TransferMode = "once" | "monthly";

export interface StartTransferParams {
  aspspName: string;
  aspspCountry: string;
  debtorIban: string | null;
  creditorIban: string;
  creditorName: string;
  amount: string; // "123.45"
  description: string;
  mode: TransferMode;
  firstDate: string | null; // YYYY-MM-DD, for a monthly order
  redirectUrl: string;
  state: string;
  psu?: PsuContext | null;
}

export async function startTransfer(p: StartTransferParams): Promise<{ url: string; paymentId: string }> {
  const transaction: Record<string, unknown> = {
    instructed_amount: { amount: p.amount, currency: "EUR" },
    beneficiary: {
      creditor: { name: p.creditorName },
      creditor_account: { scheme_name: "IBAN", identification: p.creditorIban },
    },
    remittance_information: [p.description],
  };
  if (p.mode === "monthly") {
    // A standing order is described inside the same request: first date, monthly, and
    // moved to the following working day when it falls on a weekend.
    transaction.requested_execution_date = p.firstDate;
    transaction.frequency = "MNTH";
    transaction.execution_rule = "FWNG";
  }

  const data = await enableBankingFetch<{ payment_id: string; url: string }>("/payments", {
    method: "POST",
    headers: psuHeaders(p.psu),
    body: JSON.stringify({
      aspsp: { name: p.aspspName, country: p.aspspCountry },
      payment_type: "SEPA",
      psu_type: "personal",
      language: "nl",
      state: p.state,
      redirect_url: p.redirectUrl,
      payment_request: {
        ...(p.debtorIban ? { debtor_account: { scheme_name: "IBAN", identification: p.debtorIban } } : {}),
        credit_transfer_transaction: [transaction],
      },
    }),
  });
  return { url: data.url, paymentId: data.payment_id };
}

// The "state" travelling through the bank and back carries what was asked, signed, so the
// page that receives the person afterwards can show it without trusting the address bar.
const STATE_PREFIX = "pay.";
const MAX_AGE_MS = 60 * 60 * 1000;

function sign(body: string): string {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update(body).digest("base64url");
}

export function signPaymentState(info: { amount: string; mode: TransferMode }): string {
  const body = Buffer.from(JSON.stringify({ a: info.amount, m: info.mode, t: Date.now(), n: randomBytes(6).toString("hex") })).toString("base64url");
  return `${STATE_PREFIX}${body}.${sign(body)}`;
}

export function isPaymentState(state: string): boolean {
  return state.startsWith(STATE_PREFIX);
}

export function readPaymentState(state: string): { amount: string; mode: TransferMode } | null {
  if (!isPaymentState(state)) return null;
  const [body, signature] = state.slice(STATE_PREFIX.length).split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { a: string; m: TransferMode; t: number };
    if (Date.now() - parsed.t > MAX_AGE_MS) return null;
    if (parsed.m !== "once" && parsed.m !== "monthly") return null;
    return { amount: String(parsed.a), mode: parsed.m };
  } catch {
    return null;
  }
}
