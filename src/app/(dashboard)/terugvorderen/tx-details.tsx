export interface TxInfo {
  name: string | null;
  date: string | null;
  amount: number | null;
  description: string | null;
  iban: string | null;
}

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export function TxDetails({ tx, label = "Transactiegegevens" }: { tx: TxInfo; label?: string }) {
  return (
    <details className="group">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-sm text-blue-600 [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">›</span>
        {label}
      </summary>
      <dl className="space-y-2 rounded-xl bg-gray-50 px-4 py-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">Naam</dt>
          <dd className="text-right text-gray-900">{tx.name ?? "Onbekend"}</dd>
        </div>
        {tx.date && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Datum</dt>
            <dd className="text-gray-900">{new Date(tx.date).toLocaleDateString("nl-NL")}</dd>
          </div>
        )}
        {tx.amount != null && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Bedrag</dt>
            <dd className="text-gray-900">{euro(Math.abs(tx.amount))}</dd>
          </div>
        )}
        {tx.iban && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Rekening</dt>
            <dd className="break-all text-right font-mono text-xs text-gray-900">{tx.iban}</dd>
          </div>
        )}
        {tx.description && (
          <div>
            <dt className="text-gray-500">Omschrijving</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-gray-900">{tx.description}</dd>
          </div>
        )}
      </dl>
    </details>
  );
}
