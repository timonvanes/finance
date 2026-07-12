import { createClient } from "@/lib/supabase/server";
import { ensureDefaultCategories, getCategories } from "@/actions/transactions";
import { CategorySelect } from "./category-select";

export default async function TransactionsPage() {
  await ensureDefaultCategories();

  const supabase = await createClient();

  const [{ data: transactions }, categories] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, booking_date, amount, currency, counterparty_name, raw_description, category_id"
      )
      .order("booking_date", { ascending: false })
      .limit(100),
    getCategories(),
  ]);

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">Transacties</h1>

      {transactions && transactions.length > 0 ? (
        <ul className="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">
                  {tx.counterparty_name ?? "Onbekend"}
                </p>
                <p className="truncate text-gray-500">
                  {new Date(tx.booking_date).toLocaleDateString("nl-NL")}
                  {tx.raw_description ? ` · ${tx.raw_description}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <CategorySelect
                  transactionId={tx.id}
                  categoryId={tx.category_id}
                  categories={categories}
                />
                <span
                  className={
                    tx.amount < 0
                      ? "w-20 text-right font-medium text-gray-900"
                      : "w-20 text-right font-medium text-green-700"
                  }
                >
                  {tx.amount < 0 ? "-" : "+"}
                  {"€"}
                  {Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
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
