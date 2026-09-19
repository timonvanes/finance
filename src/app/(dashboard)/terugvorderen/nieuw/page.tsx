import Link from "next/link";
import { getQueuedTransactions, getRecentExpenseTransactions } from "@/actions/reclaims";
import { getPeopleWithGroups } from "@/actions/people";
import { Wizard } from "./wizard";

export default async function NieuwPage({
  searchParams,
}: {
  searchParams: Promise<{ transactionId?: string }>;
}) {
  const { transactionId } = await searchParams;
  const [recent, queued, peopleRaw] = await Promise.all([
    getRecentExpenseTransactions(),
    getQueuedTransactions(),
    getPeopleWithGroups(),
  ]);

  const transactions = [
    ...queued,
    ...recent.filter((t) => !queued.some((q) => q.id === t.id)),
  ].map((t) => ({
    id: t.id,
    booking_date: t.booking_date,
    amount: t.amount,
    counterparty_name: t.counterparty_name,
  }));

  const people = peopleRaw.map((p) => ({ id: p.id, name: p.name, isSelf: p.is_self as boolean }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/terugvorderen"
          aria-label="Sluiten"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ×
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Nieuwe terugvordering</h1>
      </div>
      <Wizard transactions={transactions} people={people} initialTransactionId={transactionId} />
    </div>
  );
}
