import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultCategories, getCategories } from "@/actions/transactions";
import { getContributionsForTransactions, getIncomeSourceOptions } from "@/actions/contributions";
import { CategorySelect } from "./category-select";
import { ReviewActions } from "./review-actions";
import { TransactionNote } from "./transaction-note";
import { ExpenseContribution } from "./expense-contribution";
import { RecategorizeButton } from "./recategorize-button";
import { getLoanPickerData } from "@/actions/loans";

export const maxDuration = 60;

const FILTERS = [
  { value: "unreviewed", label: "Te doen" },
  { value: "uncategorized", label: "Te categoriseren" },
  { value: "all", label: "Alles" },
  { value: "expense", label: "Afschrijvingen" },
  { value: "income", label: "Bijschrijvingen" },
] as const;

const PAGE_SIZE = 100;

function buildHref(overrides: { type?: string; sort?: string; q?: string; l?: string }, current: { type: string; sort: string; q: string; l?: string }) {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (merged.type !== "unreviewed") params.set("type", merged.type);
  if (merged.sort !== "desc") params.set("sort", merged.sort);
  if (merged.q) params.set("q", merged.q);
  if (merged.l) params.set("l", merged.l);
  const query = params.toString();
  return query ? `/transactions?${query}` : "/transactions";
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string; q?: string; l?: string }>;
}) {
  const { type, sort, q, l } = await searchParams;
  const activeFilter = FILTERS.some((f) => f.value === type) ? type! : "unreviewed";
  const limit = Math.min(1000, Math.max(PAGE_SIZE, parseInt(l ?? "", 10) || PAGE_SIZE));
  const activeSort = sort === "asc" ? "asc" : "desc";
  const activeQuery = q?.trim() ?? "";
  const current = { type: activeFilter, sort: activeSort, q: activeQuery };

  const supabase = await createClient();

  let query = supabase
    // visible_transactions hides rows from before a connection's
    // "Historie vanaf" date without deleting them.
    .from("visible_transactions")
    .select(
      `id, booking_date, amount, currency, counterparty_name, raw_description, note, category_id, category_source, flagged_for_reclaim, reviewed, is_transfer,
      bank_accounts(bank_connections(institution_name))`
    )
    .order("booking_date", { ascending: activeSort === "asc" })
    .limit(limit);

  if (activeFilter === "expense") query = query.lt("amount", 0);
  if (activeFilter === "income") query = query.gt("amount", 0);
  if (activeFilter === "unreviewed") query = query.eq("reviewed", false);
  if (activeFilter === "uncategorized")
    query = query.eq("category_source", "none").eq("is_transfer", false);
  if (activeQuery) {
    // Strip characters that would break the PostgREST .or() filter syntax.
    const safeQuery = activeQuery.replace(/[,()]/g, "");
    query = query.or(
      `counterparty_name.ilike.%${safeQuery}%,raw_description.ilike.%${safeQuery}%,note.ilike.%${safeQuery}%`
    );
  }

  // Categories only need to exist before they're read; everything else runs
  // at the same time instead of one round trip after another.
  const categoriesPromise = ensureDefaultCategories().then(() => getCategories());
  const [{ data: transactions }, categories, incomeSources] = await Promise.all([
    query,
    categoriesPromise,
    getIncomeSourceOptions(),
  ]);

  const allTxIds = (transactions ?? []).map((tx) => tx.id);
  const expenseTxIds = (transactions ?? []).filter((tx) => tx.amount < 0).map((tx) => tx.id);
  const NONE = ["00000000-0000-0000-0000-000000000000"];
  const [loanData, { data: reclaimRows }, { data: settledRows }, allContributions] = await Promise.all([
    getLoanPickerData(allTxIds),
    supabase
      .from("reclaims")
      .select("transaction_id")
      .in("transaction_id", expenseTxIds.length > 0 ? expenseTxIds : NONE),
    // Incoming payments that settle a reclaim (so they can be unlinked here).
    supabase
      .from("reclaims")
      .select("id, payment_request_id, settled_transaction_id, people(name)")
      .in("settled_transaction_id", allTxIds.length > 0 ? allTxIds : NONE),
    getContributionsForTransactions(expenseTxIds),
  ]);
  const txWithReclaim = new Set((reclaimRows ?? []).map((r) => r.transaction_id));
  const settledBy = new Map<string, { kind: "reclaim" | "request"; id: string; label: string }>();
  for (const r of settledRows ?? []) {
    const person = Array.isArray(r.people) ? r.people[0] : r.people;
    settledBy.set(r.settled_transaction_id as string, {
      kind: r.payment_request_id ? "request" : "reclaim",
      id: (r.payment_request_id ?? r.id) as string,
      label: `Betaling van ${person?.name ?? "onbekend"} voor een terugvordering`,
    });
  }
  const contributionsByTx = new Map<string, typeof allContributions>();
  for (const c of allContributions) {
    if (!contributionsByTx.has(c.expense_transaction_id)) contributionsByTx.set(c.expense_transaction_id, []);
    contributionsByTx.get(c.expense_transaction_id)!.push(c);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-gray-900">Transacties</h1>
        <Link
          href={buildHref({ sort: activeSort === "asc" ? "desc" : "asc" }, current)}
          className="flex min-h-[44px] items-center rounded-full bg-white px-4 text-sm text-gray-600 ring-1 ring-gray-200 active:bg-gray-100"
        >
          {activeSort === "asc" ? "↑ Oudste eerst" : "↓ Nieuwste eerst"}
        </Link>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={buildHref({ type: f.value }, current)}
            className={
              activeFilter === f.value
                ? "flex min-h-[44px] shrink-0 items-center rounded-full bg-teal-700 px-5 text-base font-medium text-white"
                : "flex min-h-[44px] shrink-0 items-center rounded-full bg-white px-5 text-base text-gray-700 ring-1 ring-gray-200 active:bg-gray-100"
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      <form method="get" className="flex items-center gap-2">
        {activeFilter !== "unreviewed" && <input type="hidden" name="type" value={activeFilter} />}
        {activeSort !== "desc" && <input type="hidden" name="sort" value={activeSort} />}
        <input
          type="search"
          name="q"
          defaultValue={activeQuery}
          placeholder="Zoek op naam, omschrijving of notitie…"
          className="min-h-[52px] w-full rounded-2xl border border-gray-200 bg-white px-4 text-base"
        />
        <button
          type="submit"
          className="min-h-[52px] rounded-2xl bg-gray-900 px-5 text-base font-medium text-white active:bg-gray-700"
        >
          Zoek
        </button>
        {activeQuery && (
          <Link
            href={buildHref({ q: "" }, current)}
            className="flex min-h-[44px] items-center whitespace-nowrap text-sm text-gray-500 underline"
          >
            Wissen
          </Link>
        )}
      </form>

      {(activeFilter === "uncategorized" || activeFilter === "all") && <RecategorizeButton />}

      <p className="flex flex-wrap items-center gap-3 px-1 text-xs text-gray-500">
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
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
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
              <li key={tx.id} className="flex flex-col gap-2 px-5 py-4 text-base">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-lg font-medium text-gray-900">
                      {tx.counterparty_name ?? "Onbekend"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(tx.booking_date).toLocaleDateString("nl-NL")}
                      {bankConnection?.institution_name && (
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {bankConnection.institution_name}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={
                      tx.amount < 0
                        ? "shrink-0 whitespace-nowrap text-right text-lg font-semibold text-gray-900"
                        : "shrink-0 whitespace-nowrap text-right text-lg font-semibold text-green-700"
                    }
                  >
                    {tx.amount < 0 ? "-" : "+"}
                    {"€"}
                    {Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
                <div className="[&_select]:w-full">
                  <CategorySelect
                    transactionId={tx.id}
                    categoryId={tx.category_id}
                    categorySource={tx.category_source}
                    hideWhenCategorized={activeFilter === "uncategorized"}
                    categories={categories.filter((c) =>
                      tx.amount > 0 ? c.kind === "income" : c.kind === "expense"
                    )}
                  />
                </div>
                {tx.raw_description && (
                  <p className="whitespace-pre-wrap break-words text-sm text-gray-500">
                    {tx.raw_description}
                  </p>
                )}
                <TransactionNote transactionId={tx.id} note={tx.note} />
                {tx.amount < 0 && (
                  <ExpenseContribution
                    transactionId={tx.id}
                    contributions={(contributionsByTx.get(tx.id) ?? []).map((c) => ({
                      id: c.id,
                      amount: c.amount,
                      label: c.label,
                      source_transaction: Array.isArray(c.source_transaction)
                        ? (c.source_transaction[0] ?? null)
                        : c.source_transaction,
                    }))}
                    incomeSources={incomeSources}
                  />
                )}
                <ReviewActions
                  transactionId={tx.id}
                  reviewed={tx.reviewed}
                  flaggedForReclaim={tx.flagged_for_reclaim}
                  isTransfer={tx.is_transfer}
                  isExpense={tx.amount < 0}
                  hasReclaim={txWithReclaim.has(tx.id)}
                  loanLabel={
                    loanData.entryByTransaction[tx.id]
                      ? `${loanData.entryByTransaction[tx.id].kind === "borrow" ? "Lening van" : "Aflossing aan"} ${loanData.entryByTransaction[tx.id].personName} — bekijk`
                      : null
                  }
                  people={loanData.people}
                  openLoans={loanData.openLoans}
                  hideWhenHandled={activeFilter === "unreviewed"}
                  settledBy={settledBy.get(tx.id) ?? null}
                />
              </li>
            );
          })}
        </ul>
      ) : activeQuery ? (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Niks gevonden voor &quot;{activeQuery}&quot;.
        </p>
      ) : activeFilter === "unreviewed" ? (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Alles is afgehandeld. Bekijk{" "}
          <Link href="/transactions?type=all" className="text-teal-700 underline">
            alle transacties
          </Link>
          .
        </p>
      ) : activeFilter === "uncategorized" ? (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Niks te categoriseren — alles heeft al een categorie.
        </p>
      ) : (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Nog geen transacties. Koppel eerst een bank en klik op &quot;Sync
          now&quot; bij{" "}
          <a href="/settings/bank-connections" className="text-teal-700 underline">
            Bankkoppelingen
          </a>
          .
        </p>
      )}
      {transactions && transactions.length >= limit && (
        <Link
          href={buildHref({ l: String(limit + PAGE_SIZE) }, current)}
          className="flex min-h-[56px] items-center justify-center rounded-2xl bg-white text-base text-teal-700 ring-1 ring-gray-200 active:bg-gray-50"
        >
          Toon meer
        </Link>
      )}
    </div>
  );
}
