import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultCategories, getCategories } from "@/actions/transactions";
import { CategorySelect } from "./category-select";
import { FlagReclaimButton } from "./flag-reclaim-button";

const FILTERS = [
  { value: "all", label: "Alles" },
  { value: "expense", label: "Afschrijvingen" },
  { value: "income", label: "Bijschrijvingen" },
] as const;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await ensureDefaultCategories();

  const { type } = await searchParams;
  const activeFilter = FILTERS.some((f) => f.value === type) ? type! : "all";

  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select(
      "id, booking_date, amount, currency, counterparty_name, raw_description, category_id, flagged_for_reclaim"
    )
    .order("booking_date", { ascending: false })
    .limit(100);

  if (activeFilter === "expense") query = query.lt("amount", 0);
  if (activeFilter === "income") query = query.gt("amount", 0);

  const [{ data: transactions }, categories] = await Promise.all([
    query,
    getCategories(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Transacties</h1>
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1 text-xs">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "all" ? "/transactions" : `/transactions?type=${f.value}`}
              className={
                activeFilter === f.value
                  ? "rounded px-2 py-1 font-medium bg-gray-900 text-white"
                  : "rounded px-2 py-1 text-gray-600 hover:bg-gray-50"
              }
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      {transactions && transactions.length > 0 ? (
        <ul className="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">
                    {tx.counterparty_name ?? "Onbekend"}
                  </p>
                  <p className="text-gray-500">
                    {new Date(tx.booking_date).toLocaleDateString("nl-NL")}
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
              </div>
              {tx.raw_description && (
                <p className="whitespace-pre-wrap break-words text-xs text-gray-500">
                  {tx.raw_description}
                </p>
              )}
              {tx.amount < 0 && (
                <div>
                  {tx.flagged_for_reclaim ? (
                    <Link
                      href="/reclaims"
                      className="text-xs font-medium text-amber-700 underline"
                    >
                      In wachtrij om te verdelen — bekijk
                    </Link>
                  ) : (
                    <FlagReclaimButton transactionId={tx.id} />
                  )}
                </div>
              )}
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
