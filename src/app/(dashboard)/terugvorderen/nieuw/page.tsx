import Link from "next/link";
import { getQueuedTransactions, getRecentExpenseTransactions, getTransactionForReclaim } from "@/actions/reclaims";
import { getActiveGuests, getPeopleWithGroups } from "@/actions/people";
import { getWbwListChoices } from "@/actions/wbw-push";
import { Wizard } from "./wizard";

export default async function NieuwPage({
  searchParams,
}: {
  searchParams: Promise<{ transactionId?: string }>;
}) {
  const { transactionId } = await searchParams;
  const [recent, queued, peopleRaw, activeGuests, wbw] = await Promise.all([
    getRecentExpenseTransactions(),
    getQueuedTransactions(),
    getPeopleWithGroups(),
    getActiveGuests(),
    getWbwListChoices(),
  ]);

  const listed = [...queued, ...recent.filter((t) => !queued.some((q) => q.id === t.id))];
  // A transaction opened from elsewhere may be older than the 50 most recent: add it, so it
  // is found (and has its amount) instead of showing 0 euro.
  const requested =
    transactionId && !listed.some((t) => t.id === transactionId) ? await getTransactionForReclaim(transactionId) : null;
  const transactions = [...(requested ? [requested] : []), ...listed].map((t) => ({
    id: t.id,
    booking_date: t.booking_date,
    amount: t.amount,
    counterparty_name: t.counterparty_name,
    raw_description: t.raw_description ?? null,
    counterparty_iban: t.counterparty_iban ?? null,
  }));

  const people = [
    ...peopleRaw.map((p) => {
      const group = Array.isArray(p.person_groups) ? p.person_groups[0] : p.person_groups;
      return { id: p.id, name: p.name, isSelf: p.is_self as boolean, groupName: (group?.name ?? null) as string | null };
    }),
    // Guests with an open reclaim can be chosen again, under "Gast".
    ...activeGuests.map((g) => ({ id: g.id as string, name: g.name as string, isSelf: false, groupName: "Gast" as string | null })),
  ];

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
      <Wizard
        transactions={transactions}
        people={people}
        initialTransactionId={transactionId && transactions.some((t) => t.id === transactionId) ? transactionId : undefined}
        wbwLists={wbw.lists}
        wbwConfigured={wbw.configured}
      />
    </div>
  );
}
