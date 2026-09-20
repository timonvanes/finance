import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAvailableBanks, startBankLink } from "@/actions/bank-connections";
import { InfoButton } from "../../info-button";
import { SyncButton } from "./sync-button";
import { SyncFromDate } from "./sync-from-date";
import { DeleteConnectionButton } from "./delete-button";
import { ReauthorizeButton } from "./reauthorize-button";

// A first-time 90-day sync across several accounts can take a while —
// raise the default serverless function timeout so "Sync now" doesn't get
// cut off mid-sync (which surfaced as a generic request-failed error).
export const maxDuration = 60;

const STATUS_LABELS: Record<string, string> = {
  pending: "Bezig met koppelen…",
  linked: "Gekoppeld",
  expired: "Verlopen — opnieuw koppelen nodig",
  revoked: "Ingetrokken",
};

export default async function BankConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; linked?: string; warning?: string }>;
}) {
  const { error, linked, warning } = await searchParams;
  const supabase = await createClient();

  const [{ data: connections }, { data: accounts }, banks] = await Promise.all([
    supabase
      .from("bank_connections")
      .select(
        "id, institution_name, consent_status, consent_expires_at, last_synced_at, sync_from_date, created_at, auth_started_at"
      )
      .order("created_at", { ascending: false }),
    supabase.from("bank_accounts").select("bank_connection_id"),
    getAvailableBanks(),
  ]);

  const accountCounts = new Map<string, number>();
  for (const a of accounts ?? []) {
    accountCounts.set(a.bank_connection_id, (accountCounts.get(a.bank_connection_id) ?? 0) + 1);
  }

  // A "pending" row means the redirect back from the bank never completed —
  // the user closed the tab, 2FA timed out, or the bank/Enable Banking
  // errored partway through. There's no automatic timeout, so after a few
  // minutes it's safe to assume it's genuinely stuck rather than still in
  // progress.
  const STALE_PENDING_MS = 15 * 60 * 1000;
  const now = Date.now();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            aria-label="Terug"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
          >
            ‹
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold text-gray-900">Bankkoppelingen</h1>
          <InfoButton>
            <p>
              Blijft een koppeling op &quot;Bezig met koppelen…&quot; staan? Dan is de laatste stap bij
              de bank niet afgerond (tab gesloten, 2FA verlopen of een fout bij de bank). Na 15
              minuten verschijnt hier een knop om het opnieuw te proberen, zonder dat je
              transacties of categorieën verloren gaan.
            </p>
            <p>
              Verwijderen is alleen nodig als je een bank echt wilt loskoppelen; dan verdwijnen ook de
              bijbehorende transacties.
            </p>
            <p>
              Banken staan maar een paar verversingen per dag toe. De app ververst zelf een paar keer
              per dag; met de knop Verversen kun je zelf extra ophalen.
            </p>
          </InfoButton>
        </div>
        {linked && !warning && (
          <p className="rounded-2xl bg-green-50 p-4 text-base text-green-700">
            Bank gekoppeld.
          </p>
        )}
        {warning === "no_accounts" && (
          <p className="rounded-2xl bg-amber-50 p-4 text-base text-amber-800">
            Koppeling gelukt, maar de bank heeft geen enkele rekening vrijgegeven. Koppel
            opnieuw en let bij de bank op een stap waar je een rekening moet aanvinken/selecteren.
          </p>
        )}
        {error && (
          <p className="rounded-2xl bg-red-50 p-4 text-base text-red-700 [overflow-wrap:anywhere]">
            Koppelen mislukt ({error}).
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">
          Gekoppelde rekeningen
        </h2>
        {connections && connections.length > 0 ? (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {connections.map((c) => {
              const accountCount = accountCounts.get(c.id) ?? 0;
              const hasNoAccounts = c.consent_status === "linked" && accountCount === 0;
              // auth_started_at tracks the CURRENT attempt (reset whenever a
              // re-authorization kicks off), unlike created_at which is the
              // connection's original creation date — using created_at here
              // made a connection look instantly "stuck" the moment an old
              // connection's re-auth attempt began.
              const pendingSince = new Date(c.auth_started_at ?? c.created_at).getTime();
              const isStalePending =
                c.consent_status === "pending" && now - pendingSince > STALE_PENDING_MS;
              // Any of these mean the same thing: the last handshake with
              // the bank didn't result in a usable connection, and retrying
              // (reusing this row, so existing transaction history and
              // categorization survive) is the way forward.
              const canReauthorize = c.consent_status === "expired" || isStalePending || hasNoAccounts;
              return (
                <li key={c.id} className="space-y-3 px-5 py-4 text-base">
                  <div>
                    <p className="text-lg font-medium text-gray-900">{c.institution_name}</p>
                    <p className={`text-sm ${hasNoAccounts || isStalePending ? "text-amber-700" : "text-gray-500"}`}>
                      {isStalePending
                        ? "Koppelen niet afgerond of mislukt — probeer opnieuw"
                        : hasNoAccounts
                          ? "Gekoppeld, maar 0 rekeningen gevonden — probeer opnieuw"
                          : STATUS_LABELS[c.consent_status] ?? c.consent_status}
                    </p>
                    {c.last_synced_at && !hasNoAccounts && (
                      <p className="text-sm text-gray-500">
                        Laatst ververst{" "}
                        {new Date(c.last_synced_at).toLocaleString("nl-NL", {
                          timeZone: "Europe/Amsterdam",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    {c.consent_status === "linked" && !hasNoAccounts && (
                      <SyncButton bankConnectionId={c.id} />
                    )}
                    {canReauthorize && <ReauthorizeButton bankConnectionId={c.id} />}
                    <DeleteConnectionButton bankConnectionId={c.id} />
                  </div>
                  {c.consent_status === "linked" && !hasNoAccounts && (
                    <details className="group">
                      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-sm text-blue-600 [&::-webkit-details-marker]:hidden">
                        <span className="inline-block transition-transform group-open:rotate-90">›</span>
                        Historie beperken
                      </summary>
                      <SyncFromDate bankConnectionId={c.id} syncFromDate={c.sync_from_date} />
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">Nog geen bank gekoppeld.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">Bank koppelen</h2>
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
          {banks.map((bank) => (
            <li
              key={`${bank.name}-${bank.country}`}
              className="flex min-h-[60px] items-center justify-between px-5 py-3 text-base"
            >
              <span className="text-gray-900">{bank.name}</span>
              <form action={startBankLink}>
                <input type="hidden" name="aspspName" value={bank.name} />
                <input type="hidden" name="aspspCountry" value={bank.country} />
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-medium text-white active:bg-teal-800"
                >
                  Koppelen
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
