import { createClient } from "@/lib/supabase/server";
import { getAvailableBanks, startBankLink } from "@/actions/bank-connections";
import { SyncButton } from "./sync-button";

const STATUS_LABELS: Record<string, string> = {
  pending: "Bezig met koppelen…",
  linked: "Gekoppeld",
  expired: "Verlopen — opnieuw koppelen nodig",
  revoked: "Ingetrokken",
};

export default async function BankConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; linked?: string }>;
}) {
  const { error, linked } = await searchParams;
  const supabase = await createClient();

  const [{ data: connections }, banks] = await Promise.all([
    supabase
      .from("bank_connections")
      .select("id, institution_name, consent_status, consent_expires_at, last_synced_at")
      .order("created_at", { ascending: false }),
    getAvailableBanks(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Bankkoppelingen</h1>
        {linked && (
          <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Bank gekoppeld.
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
            {connections.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{c.institution_name}</p>
                  <p className="text-gray-500">
                    {STATUS_LABELS[c.consent_status] ?? c.consent_status}
                    {c.last_synced_at &&
                      ` · laatst gesynchroniseerd ${new Date(
                        c.last_synced_at
                      ).toLocaleString("nl-NL")}`}
                  </p>
                </div>
                {c.consent_status === "linked" && <SyncButton bankConnectionId={c.id} />}
              </li>
            ))}
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
