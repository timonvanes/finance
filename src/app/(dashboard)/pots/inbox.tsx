"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignTransactionToPot } from "@/actions/pots";
import { InfoButton } from "../info-button";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

interface InboxTx {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
  raw_description: string | null;
}

// Transactions that look like moving money to savings/investments but aren't
// tied to a pot yet: pick the pot once, optionally have it recognised next time.
export function SavingsInbox({ items, pots }: { items: InboxTx[]; pots: { id: string; name: string }[] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold text-gray-900">Nog te koppelen ({items.length})</h2>
        <InfoButton>
          <p>
            Dit zijn transacties die eruitzien als sparen of beleggen (bijvoorbeeld &quot;Oranje
            spaarrekening&quot; of een broker), maar nog niet aan een potje hangen. Kies het potje
            en de transactie telt daarna als inleg of opname in plaats van als uitgave of inkomen.
          </p>
          <p>
            Met &quot;Voortaan automatisch&quot; wordt de naam van de tegenpartij de herkenningstekst
            van het potje, zodat de volgende keer alles vanzelf gekoppeld wordt.
          </p>
        </InfoButton>
      </div>
      <ul className="space-y-3">
        {items.map((tx) => (
          <InboxRow key={tx.id} tx={tx} pots={pots} />
        ))}
      </ul>
    </section>
  );
}

function InboxRow({ tx, pots }: { tx: InboxTx; pots: { id: string; name: string }[] }) {
  const [potId, setPotId] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <li className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-medium text-gray-900">{tx.counterparty_name ?? "Onbekend"}</p>
          <p className="text-sm text-gray-500">{new Date(tx.booking_date).toLocaleDateString("nl-NL")}</p>
        </div>
        <p className={`shrink-0 text-lg font-semibold ${tx.amount < 0 ? "text-gray-900" : "text-green-700"}`}>
          {tx.amount < 0 ? "−" : "+"}
          {euro(Math.abs(tx.amount))}
        </p>
      </div>
      <select
        value={potId}
        onChange={(e) => setPotId(e.target.value)}
        className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
      >
        <option value="">Kies een potje…</option>
        {pots.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <label className="flex min-h-[44px] items-center gap-3 text-base text-gray-700">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Voortaan automatisch
      </label>
      <button
        type="button"
        disabled={!potId || isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await assignTransactionToPot(tx.id, potId, remember);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Koppelen mislukt");
            }
          });
        }}
        className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : "Koppel aan potje"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </li>
  );
}
