import Link from "next/link";
import {
  getQueuedTransactions,
  getRecentExpenseTransactions,
  getReclaims,
  getUnlinkedIncomingTransactions,
  undoWriteOffReclaim,
  unflagTransactionForReclaim,
} from "@/actions/reclaims";
import { getPaymentRequests } from "@/actions/payment-requests";
import { getPeopleWithGroups } from "@/actions/people";
import { LinkTransaction, UnlinkButton, DeleteButton } from "./link-transaction";
import { ReferenceCode } from "./reference-code";
import { SplitReclaimForm } from "./split-form";
import { OpenReclaimsList } from "./open-reclaims-list";
import { PaymentRequestRow } from "./payment-request-row";

type Reclaim = Awaited<ReturnType<typeof getReclaims>>[number];

function ReclaimRow({
  r,
  incomingTransactions,
}: {
  r: Reclaim;
  incomingTransactions: Awaited<ReturnType<typeof getUnlinkedIncomingTransactions>>;
}) {
  const relatedTx = Array.isArray(r.transactions) ? r.transactions[0] : r.transactions;
  const settledTx = Array.isArray(r.settled_transaction)
    ? r.settled_transaction[0]
    : r.settled_transaction;
  const person = Array.isArray(r.people) ? r.people[0] : r.people;

  return (
    <li className="flex flex-col gap-2 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 truncate font-medium text-gray-900">
            {person?.name ?? "Onbekend"} · €{r.computed_amount.toFixed(2)}
            {r.status === "requested" && r.reference_code && <ReferenceCode code={r.reference_code} />}
            {r.status === "written_off" && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                Niet inbaar
              </span>
            )}
          </p>
          <p className="truncate text-gray-500">
            {relatedTx?.counterparty_name ?? "Onbekend"} ·{" "}
            {relatedTx?.booking_date &&
              new Date(relatedTx.booking_date).toLocaleDateString("nl-NL")}
            {r.tikkie_link && (
              <>
                {" · "}
                <span className="italic">{r.tikkie_link}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {r.status === "paid" && <UnlinkButton reclaimId={r.id} />}
          {r.status === "written_off" && (
            <form action={undoWriteOffReclaim.bind(null, r.id)}>
              <button type="submit" className="text-xs text-gray-400 underline hover:text-gray-600">
                Ongedaan maken
              </button>
            </form>
          )}
          <DeleteButton reclaimId={r.id} />
        </div>
      </div>
      {r.status === "paid" && settledTx && (
        <p className="text-xs text-gray-400">
          Gekoppeld aan betaling van {settledTx.counterparty_name ?? "onbekend"} op{" "}
          {new Date(settledTx.booking_date).toLocaleDateString("nl-NL")} (€
          {settledTx.amount.toFixed(2)})
        </p>
      )}
      {r.status === "requested" && (
        <LinkTransaction
          reclaimId={r.id}
          computedAmount={r.computed_amount}
          incomingTransactions={incomingTransactions}
          showAutoMatch={r.settlement_method === "bank"}
        />
      )}
      {r.status === "requested" && r.settlement_method === "external_app" && (
        <p className="text-xs text-gray-400">
          Via WieBetaaltWat/andere app — wordt niet automatisch herkend.
        </p>
      )}
    </li>
  );
}

export default async function ReclaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ transactionId?: string }>;
}) {
  const { transactionId } = await searchParams;
  const [transactions, reclaims, paymentRequests, incomingTransactions, peopleWithGroups, queuedTransactions] =
    await Promise.all([
      getRecentExpenseTransactions(),
      getReclaims(),
      getPaymentRequests(),
      getUnlinkedIncomingTransactions(),
      getPeopleWithGroups(),
      getQueuedTransactions(),
    ]);

  // A flagged transaction may be older than the 50 most recent expenses
  // shown in the picker — make sure it's always selectable regardless.
  const transactionOptions = [
    ...queuedTransactions,
    ...transactions.filter((t) => !queuedTransactions.some((q) => q.id === t.id)),
  ];

  const people = peopleWithGroups.map((p) => {
    const group = Array.isArray(p.person_groups) ? p.person_groups[0] : p.person_groups;
    return { id: p.id, name: p.name, groupName: group?.name ?? null, isSelf: p.is_self };
  });

  const openReclaims = reclaims.filter((r) => r.status === "requested");
  const paidReclaims = reclaims.filter((r) => r.status === "paid");
  const writtenOffReclaims = reclaims.filter((r) => r.status === "written_off");

  const normalizedPaymentRequests = paymentRequests.map((pr) => {
    const person = Array.isArray(pr.people) ? pr.people[0] : pr.people;
    const settledTx = Array.isArray(pr.settled_transaction)
      ? pr.settled_transaction[0]
      : pr.settled_transaction;
    const reclaimLines = (Array.isArray(pr.reclaims) ? pr.reclaims : []).map((r) => {
      const tx = Array.isArray(r.transactions) ? r.transactions[0] : r.transactions;
      return {
        id: r.id,
        computed_amount: r.computed_amount,
        booking_date: tx?.booking_date ?? null,
        counterparty_name: tx?.counterparty_name ?? null,
      };
    });
    return {
      id: pr.id,
      personName: person?.name ?? "Onbekend",
      status: pr.status,
      referenceCode: pr.reference_code,
      tikkieLink: pr.tikkie_link,
      reclaims: reclaimLines,
      settledTransaction: settledTx ?? null,
      total: reclaimLines.reduce((sum, r) => sum + r.computed_amount, 0),
    };
  });
  const openPaymentRequests = normalizedPaymentRequests.filter((pr) => pr.status === "requested");
  const paidPaymentRequests = normalizedPaymentRequests.filter((pr) => pr.status === "paid");
  const writtenOffPaymentRequests = normalizedPaymentRequests.filter((pr) => pr.status === "written_off");

  const outstandingTotal =
    openReclaims.reduce((sum, r) => sum + r.computed_amount, 0) +
    openPaymentRequests.reduce((sum, pr) => sum + pr.total, 0);

  const perPersonTotals = new Map<string, number>();
  for (const r of openReclaims) {
    const person = Array.isArray(r.people) ? r.people[0] : r.people;
    const name = person?.name ?? "Onbekend";
    perPersonTotals.set(name, (perPersonTotals.get(name) ?? 0) + r.computed_amount);
  }
  for (const pr of openPaymentRequests) {
    perPersonTotals.set(pr.personName, (perPersonTotals.get(pr.personName) ?? 0) + pr.total);
  }
  const perPersonList = [...perPersonTotals.entries()].sort((a, b) => b[1] - a[1]);

  const openReclaimItems = openReclaims.map((r) => {
    const person = Array.isArray(r.people) ? r.people[0] : r.people;
    const tx = Array.isArray(r.transactions) ? r.transactions[0] : r.transactions;
    return {
      id: r.id,
      person_id: r.person_id,
      computed_amount: r.computed_amount,
      reference_code: r.reference_code,
      tikkie_link: r.tikkie_link,
      settlement_method: r.settlement_method,
      person_name: person?.name ?? "Onbekend",
      counterparty_name: tx?.counterparty_name ?? null,
      booking_date: tx?.booking_date ?? null,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Terugvorderingen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Nog openstaand: <span className="font-medium text-gray-900">€{outstandingTotal.toFixed(2)}</span>
        </p>
        {perPersonList.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {perPersonList.map(([name, total]) => (
              <li
                key={name}
                className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
              >
                {name}: €{total.toFixed(2)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {queuedTransactions.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-700">
            Te verdelen ({queuedTransactions.length})
          </h2>
          <ul className="divide-y divide-gray-200 rounded-md border border-amber-200 bg-amber-50">
            {queuedTransactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">
                    {tx.counterparty_name ?? "Onbekend"} · €{Math.abs(tx.amount).toFixed(2)}
                  </p>
                  <p className="truncate text-gray-500">
                    {new Date(tx.booking_date).toLocaleDateString("nl-NL")}
                    {tx.raw_description ? ` · ${tx.raw_description}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/reclaims?transactionId=${tx.id}#split-form`}
                    className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    Verdelen
                  </Link>
                  <form action={unflagTransactionForReclaim.bind(null, tx.id)}>
                    <button
                      type="submit"
                      className="text-xs text-gray-400 underline hover:text-gray-600"
                    >
                      Verwijderen uit wachtrij
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="split-form">
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Nieuwe terugvordering
        </h2>
        <SplitReclaimForm
          key={transactionId ?? "default"}
          transactions={transactionOptions}
          people={people}
          initialTransactionId={transactionId}
        />
      </section>

      {openPaymentRequests.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-700">
            Gecombineerde betaalverzoeken ({openPaymentRequests.length})
          </h2>
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {openPaymentRequests.map((pr) => (
              <PaymentRequestRow
                key={pr.id}
                id={pr.id}
                personName={pr.personName}
                status={pr.status}
                referenceCode={pr.referenceCode}
                tikkieLink={pr.tikkieLink}
                reclaims={pr.reclaims}
                settledTransaction={pr.settledTransaction}
                incomingTransactions={incomingTransactions}
              />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-1 text-sm font-medium text-gray-700">
          Openstaand ({openReclaims.length})
        </h2>
        <p className="mb-2 text-xs text-gray-500">
          Klik op de code om 'm te kopiëren, en zet 'm in de omschrijving van je
          Tikkie/betaalverzoek — dan koppelt de betaling straks vanzelf. Vink meerdere
          terugvorderingen van dezelfde persoon aan om ze in één betaalverzoek te combineren.
        </p>
        <OpenReclaimsList reclaims={openReclaimItems} incomingTransactions={incomingTransactions} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Ontvangen ({paidReclaims.length + paidPaymentRequests.length})
        </h2>
        {paidReclaims.length > 0 || paidPaymentRequests.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white opacity-75">
            {paidPaymentRequests.map((pr) => (
              <PaymentRequestRow
                key={pr.id}
                id={pr.id}
                personName={pr.personName}
                status={pr.status}
                referenceCode={pr.referenceCode}
                tikkieLink={pr.tikkieLink}
                reclaims={pr.reclaims}
                settledTransaction={pr.settledTransaction}
                incomingTransactions={incomingTransactions}
              />
            ))}
            {paidReclaims.map((r) => (
              <ReclaimRow key={r.id} r={r} incomingTransactions={incomingTransactions} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Nog niks ontvangen.</p>
        )}
      </section>

      {(writtenOffReclaims.length > 0 || writtenOffPaymentRequests.length > 0) && (
        <section>
          <h2 className="mb-1 text-sm font-medium text-gray-700">
            Niet inbaar ({writtenOffReclaims.length + writtenOffPaymentRequests.length})
          </h2>
          <p className="mb-2 text-xs text-gray-500">
            Niet meer opgevolgd — telt niet mee als openstaand en wordt beschouwd als eigen kosten.
          </p>
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white opacity-75">
            {writtenOffPaymentRequests.map((pr) => (
              <PaymentRequestRow
                key={pr.id}
                id={pr.id}
                personName={pr.personName}
                status={pr.status}
                referenceCode={pr.referenceCode}
                tikkieLink={pr.tikkieLink}
                reclaims={pr.reclaims}
                settledTransaction={pr.settledTransaction}
                incomingTransactions={incomingTransactions}
              />
            ))}
            {writtenOffReclaims.map((r) => (
              <ReclaimRow key={r.id} r={r} incomingTransactions={incomingTransactions} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
