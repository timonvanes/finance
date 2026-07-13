import { createClient } from "@/lib/supabase/server";
import { getAvailableBanks, startBankLink } from "@/actions/bank-connections";
import { SyncButton } from "./sync-button";
import { SyncFromDate } from "./sync-from-date";
import { DeleteConnectionButton } from "./delete-button";

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
        "id, institution_name, consent_status, consent_expires_at, last_synced_at, sync_from_date"
      )
      .order("created_at", { ascending: false }),
    supabase.from("bank_accounts").select("bank_connection_id"),
    getAvailableBanks(),
  ]);

  const accountCounts = new Map<string, number>();
  for (const a of accounts ?? []) {
    accountCounts.set(a.bank_connection_id, (accountCounts.get(a.bank_connection_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Bankkoppelingen</h1>
        {linked && !warning && (
          <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Bank gekoppeld.
          </p>
        )}
        {warning === "no_accounts" && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Koppeling gelukt, maar de bank heeft geen enkele rekening vrijgegeven. Koppel
            opnieuw en let bij de bank op een stap waar je een rekening moet aanvinken/selecteren.
          </p>
        )}
        {error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Koppelen mislukt ({error}).
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Gekoppelde rekeningen
        </h2>
        {connections && connections.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {connections.map((c) => {
              const accountCount = accountCounts.get(c.id) ?? 0;
              const hasNoAccounts = c.consent_status === "linked" && accountCount === 0;
              return (
                <li key={c.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{c.institution_name}</p>
                      <p className={hasNoAccounts ? "text-amber-700" : "text-gray-500"}>
                        {hasNoAccounts
                          ? "Gekoppeld, maar 0 rekeningen gevonden — verwijder en koppel opnieuw"
                          : STATUS_LABELS[c.consent_status] ?? c.consent_status}
                        {c.last_synced_at &&
                          !hasNoAccounts &&
                          // Rendered server-side (UTC on Vercel) — without an
                          // explicit timezone this shows 1-2h behind NL.
                          ` · laatst gesynchroniseerd ${new Date(
                            c.last_synced_at
                          ).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.consent_status === "linked" && !hasNoAccounts && (
                        <SyncButton bankConnectionId={c.id} />
                      )}
                      <DeleteConnectionButton bankConnectionId={c.id} />
                    </div>
                  </div>
                  {c.consent_status === "linked" && !hasNoAccounts && (
                    <SyncFromDate bankConnectionId={c.id} syncFromDate={c.sync_from_date} />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Nog geen bank gekoppeld.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Bank koppelen</h2>
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {banks.map((bank) => (
            <li
              key={`${bank.name}-${bank.country}`}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="text-gray-900">{bank.name}</span>
              <form action={startBankLink}>
                <input type="hidden" name="aspspName" value={bank.name} />
                <input type="hidden" name="aspspCountry" value={bank.country} />
                <button
                  type="submit"
                  className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
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
