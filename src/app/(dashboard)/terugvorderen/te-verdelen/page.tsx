import Link from "next/link";
import { getQueuedTransactions, unflagTransactionForReclaim } from "@/actions/reclaims";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export default async function TeVerdelenPage() {
  const queued = await getQueuedTransactions();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/terugvorderen"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Te verdelen</h1>
      </div>

      {queued.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Niks meer te verdelen.
        </p>
      ) : (
        <ul className="space-y-3">
          {queued.map((tx) => (
            <li key={tx.id} className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-medium text-gray-900">
                    {tx.counterparty_name ?? "Onbekend"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(tx.booking_date).toLocaleDateString("nl-NL")}
                  </p>
                </div>
                <p className="shrink-0 text-lg font-semibold text-gray-900">
                  {euro(Math.abs(tx.amount))}
                </p>
              </div>
              <Link
                href={`/terugvorderen/nieuw?transactionId=${tx.id}`}
                className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-gray-900 text-base font-medium text-white active:bg-gray-700"
              >
                Verdelen
              </Link>
              <form action={unflagTransactionForReclaim.bind(null, tx.id)}>
                <button
                  type="submit"
                  className="min-h-[44px] w-full text-sm text-gray-500 underline"
                >
                  Uit de wachtrij halen
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
