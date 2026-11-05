"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setWbwImportFrom, setWbwListIncluded, setWbwManual, syncWbwBalance } from "@/actions/wbw";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

export interface WbwSettings {
  configured: boolean;
  manual: boolean;
  importFrom: string | null;
  importedCount: number;
  latestDate: string | null;
  latestSyncedAt: string | null;
  latestBalance: number | null;
  lists: { id: string; name: string; currency: string; amount: number; included: boolean }[];
}

// WieBetaaltWat next to the banks: refresh, the date expenses are taken in from,
// and which lists count. Expenses others paid for you (your part) come in as
// transactions on your to-do list.
export function WbwSection({ settings }: { settings: WbwSettings }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(settings.importFrom ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Plain state, not a transition: a transition stays "pending" until the whole
  // page has reloaded.
  async function work(fn: () => Promise<string | null>) {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const text = await fn();
      if (text) setNote(text);
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  const refresh = () =>
    work(async () => {
      const r = await syncWbwBalance();
      if ("error" in r) {
        setError(r.error);
        return null;
      }
      const parts = [`Saldo ${euro(r.balance)} over ${r.lists} lijsten.`];
      if (r.imports) parts.push(`Uitgaven: ${r.imports.imported} nieuw, ${r.imports.updated} bijgewerkt, ${r.imports.removed} verwijderd.`);
      if (r.removed > 0) parts.push(`${r.removed} terugvordering(en) verwijderd omdat de uitgave in WieBetaaltWat is verwijderd.`);
      return parts.join(" ");
    });

  const saveDate = () =>
    work(async () => {
      const earlier = settings.importFrom && date < settings.importFrom;
      if (
        settings.importFrom &&
        !earlier &&
        date > settings.importFrom &&
        settings.importedCount > 0 &&
        !confirm(
          `Uitgaven van vóór ${longDate(date)} die al zijn ingeladen worden uit je transacties verwijderd. Doorgaan?`
        )
      ) {
        return null;
      }
      const r = await setWbwImportFrom(date);
      if (r.error) {
        setError(r.error);
        return null;
      }
      const s = await syncWbwBalance();
      if ("error" in s) {
        setError(s.error);
        return null;
      }
      return s.imports ? `Ingeladen vanaf ${longDate(date)}: ${s.imports.imported} nieuw, ${s.imports.updated} bijgewerkt.` : "Opgeslagen.";
    });

  const stop = () =>
    work(async () => {
      if (!confirm(`Niet meer inladen? De ${settings.importedCount} ingeladen transacties worden verwijderd en de schatting uit je saldo komt terug.`)) {
        return null;
      }
      const r = await setWbwImportFrom(null);
      if (r.error) {
        setError(r.error);
        return null;
      }
      setDate("");
      return "Niet meer ingeladen.";
    });

  return (
    <section>
      <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">WieBetaaltWat</h2>
      <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        {!settings.configured ? (
          <p className="text-base text-gray-500">
            Niet gekoppeld. Zet WBW_EMAIL en WBW_PASSWORD in Vercel om je saldo en uitgaven op te halen.
          </p>
        ) : (
          <>
            <div>
              <p className="text-lg font-medium text-gray-900">Gekoppeld</p>
              <p className="text-sm text-gray-500">
                {settings.latestSyncedAt
                  ? `Laatst ververst ${new Date(settings.latestSyncedAt).toLocaleString("nl-NL", {
                      timeZone: "Europe/Amsterdam",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Nog niet opgehaald"}
                {settings.latestBalance != null && ` · saldo ${euro(settings.latestBalance)}`}
              </p>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              className="min-h-[48px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
            >
              {busy ? "Bezig…" : "Verversen"}
            </button>
            {note && <p className="text-sm text-teal-700">{note}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="space-y-2 border-t border-gray-100 pt-4">
              <h3 className="text-base font-medium text-gray-900">Uitgaven inladen</h3>
              <p className="text-sm text-gray-500">
                Jouw deel van wat anderen in WieBetaaltWat betaalden komt als transactie bij Te doen, zodat je het kunt
                categoriseren, als eigen uitgave kunt markeren of kunt terugvorderen. Wat jij zelf betaalde staat al via
                de bank.
              </p>
              <label className="block space-y-1">
                <span className="text-sm text-gray-500">Inladen vanaf</span>
                <input
                  type="date"
                  value={date}
                  disabled={busy}
                  onChange={(e) => setDate(e.target.value)}
                  className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-4 text-base disabled:opacity-50"
                />
              </label>
              <button
                type="button"
                disabled={busy || !date || date === settings.importFrom}
                onClick={() => void saveDate()}
                className="min-h-[48px] w-full rounded-xl border border-gray-300 text-base font-medium text-gray-900 active:bg-gray-50 disabled:opacity-50"
              >
                {settings.importFrom ? "Startdatum opslaan en inladen" : "Inladen starten"}
              </button>
              {settings.importFrom && (
                <>
                  <p className="text-sm text-gray-500">
                    Aan sinds {longDate(settings.importFrom)} · {settings.importedCount} ingeladen
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void stop()}
                    className="min-h-[44px] w-full text-base text-gray-600 underline disabled:opacity-50"
                  >
                    Niet meer inladen
                  </button>
                </>
              )}
            </div>

            <div className="space-y-2 border-t border-gray-100 pt-4">
              <label className="flex min-h-[44px] items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-base text-gray-900">Zelf invullen (terugval)</span>
                  <span className="block text-sm text-gray-500">
                    Brengt het handmatig invullen van je saldo en het rechttrekken terug op Terugvorderen. Voor als
                    WieBetaaltWat het ophalen blokkeert.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.manual}
                  disabled={busy}
                  onChange={(e) =>
                    void work(async () => {
                      const r = await setWbwManual(e.target.checked);
                      if (r.error) setError(r.error);
                      return null;
                    })
                  }
                  className="h-6 w-6 shrink-0 accent-teal-700"
                />
              </label>
            </div>

            {settings.lists.length > 0 && (
              <div className="space-y-2 border-t border-gray-100 pt-4">
                <h3 className="text-base font-medium text-gray-900">Lijsten die meetellen</h3>
                <p className="text-sm text-gray-500">
                  Voor je saldo en voor het inladen van uitgaven. Lijsten in een andere munt tellen niet mee.
                </p>
                <ul className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-200">
                  {settings.lists.map((l) => {
                    const foreign = l.currency !== "EUR";
                    return (
                      <li key={l.id}>
                        <label className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
                          <span className="min-w-0">
                            <span className="block truncate text-base text-gray-900">{l.name}</span>
                            <span className="block text-sm text-gray-500">
                              {foreign
                                ? `${l.currency} ${l.amount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })} · andere munt`
                                : euro(l.amount)}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={l.included && !foreign}
                            disabled={busy || foreign}
                            onChange={(e) =>
                              void work(async () => {
                                const r = await setWbwListIncluded(l.id, e.target.checked);
                                if (r.error) setError(r.error);
                                return null;
                              })
                            }
                            className="h-6 w-6 shrink-0 accent-teal-700"
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
