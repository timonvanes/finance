import { createClient } from "@/lib/supabase/server";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, booking_date, amount, currency, counterparty_name, raw_description")
    .order("booking_date", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">Transacties</h1>

      {transactions && transactions.length > 0 ? (
        <ul className="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-gray-900">
                  {tx.counterparty_name ?? "Onbekend"}
                </p>
                <p className="text-gray-500">
                  {new Date(tx.booking_date).toLocaleDateString("nl-NL")}
                  {tx.raw_description ? ` · ${tx.raw_description}` : ""}
                </p>
              </div>
              <span
                className={
                  tx.amount < 0 ? "font-medium text-gray-900" : "font-medium text-green-700"
                }
              >
                {tx.amount < 0 ? "-" : "+"}
                {"€"}
                {Math.abs(tx.amount).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          Nog geen transacties. Koppel eerst een bank en klik op &quot;Sync
          now&quot; bij{" "}
          <a href="/settings/bank-connections" className="underline">
            Bankkoppelingen
          </a>
          .
        </p>
      )}
    </div>
  );
}
