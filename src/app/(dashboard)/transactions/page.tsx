import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultCategories, getCategories } from "@/actions/transactions";
import { CategorySelect } from "./category-select";
import { ReviewActions } from "./review-actions";

const FILTERS = [
  { value: "unreviewed", label: "Te controleren" },
  { value: "uncategorized", label: "Te categoriseren" },
  { value: "all", label: "Alles" },
  { value: "expense", label: "Afschrijvingen" },
  { value: "income", label: "Bijschrijvingen" },
] as const;

function buildHref(type: string, sort: string) {
  const params = new URLSearchParams();
  if (type !== "unreviewed") params.set("type", type);
  if (sort !== "desc") params.set("sort", sort);
  const query = params.toString();
  return query ? `/transactions?${query}` : "/transactions";
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string }>;
}) {
  await ensureDefaultCategories();

  const { type, sort } = await searchParams;
  const activeFilter = FILTERS.some((f) => f.value === type) ? type! : "unreviewed";
  const activeSort = sort === "asc" ? "asc" : "desc";

  const supabase = await createClient();

  let query = supabase
    // visible_transactions hides rows from before a connection's
    // "Historie vanaf" date without deleting them.
    .from("visible_transactions")
    .select(
      `id, booking_date, amount, currency, counterparty_name, raw_description, category_id, category_source, flagged_for_reclaim, reviewed, is_transfer,
      bank_accounts(bank_connections(institution_name))`
    )
    .order("booking_date", { ascending: activeSort === "asc" })
    .limit(100);

  if (activeFilter === "expense") query = query.lt("amount", 0);
  if (activeFilter === "income") query = query.gt("amount", 0);
  if (activeFilter === "unreviewed") query = query.eq("reviewed", false).lt("amount", 0);
  if (activeFilter === "uncategorized")
    query = query.eq("category_source", "none").eq("is_transfer", false);

  const [{ data: transactions }, categories] = await Promise.all([
    query,
    getCategories(),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-gray-900">Transacties</h1>
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap gap-1 rounded-md border border-gray-200 bg-white p-1 text-sm">
            {FILTERS.map((f) => (
              <Link
                key={f.value}
                href={buildHref(f.value, activeSort)}
                className={
                  activeFilter === f.value
                    ? "min-h-[40px] rounded px-3 py-2 font-medium bg-gray-900 text-white flex items-center"
                    : "min-h-[40px] rounded px-3 py-2 text-gray-600 hover:bg-gray-50 flex items-center"
                }
              >
                {f.label}
              </Link>
            ))}
          </div>
          <Link
            href={buildHref(activeFilter, activeSort === "asc" ? "desc" : "asc")}
            className="flex min-h-[40px] items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Datum {activeSort === "asc" ? "↑ oudste eerst" : "↓ nieuwste eerst"}
          </Link>
        </div>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-red-300 bg-red-50" />
          geen categorie
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-amber-300 bg-amber-50" />
          automatisch toegekend
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-green-300 bg-green-50" />
          zelf gecontroleerd
        </span>
      </p>

      {transactions && transactions.length > 0 ? (
        <ul className="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {transactions.map((tx) => {
            const bankAccount = Array.isArray(tx.bank_accounts)
              ? tx.bank_accounts[0]
              : tx.bank_accounts;
            const bankConnection = bankAccount
              ? Array.isArray(bankAccount.bank_connections)
                ? bankAccount.bank_connections[0]
                : bankAccount.bank_connections
              : null;

            return (
              <li key={tx.id} className="flex flex-col gap-2 px-4 py-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-gray-900">
                      {tx.counterparty_name ?? "Onbekend"}
                    </p>
                    <p className="text-gray-500">
                      {new Date(tx.booking_date).toLocaleDateString("nl-NL")}
                      {bankConnection?.institution_name && (
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {bankConnection.institution_name}
                        </span>
                      )}
                      {tx.is_transfer && (
                        <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          Verschuiving eigen rekening
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <CategorySelect
                      transactionId={tx.id}
                      categoryId={tx.category_id}
                      categorySource={tx.category_source}
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
                {tx.amount < 0 && !tx.is_transfer && (
                  <ReviewActions
                    transactionId={tx.id}
                    reviewed={tx.reviewed}
                    flaggedForReclaim={tx.flagged_for_reclaim}
                  />
                )}
              </li>
            );
          })}
        </ul>
      ) : activeFilter === "unreviewed" ? (
        <p className="mt-4 text-sm text-gray-500">
          Niks te controleren — alle afschrijvingen zijn gecontroleerd. Bekijk{" "}
          <Link href="/transactions?type=all" className="underline">
            alle transacties
          </Link>
          .
        </p>
      ) : activeFilter === "uncategorized" ? (
        <p className="mt-4 text-sm text-gray-500">
          Niks te categoriseren — alles heeft al een categorie.
        </p>
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
