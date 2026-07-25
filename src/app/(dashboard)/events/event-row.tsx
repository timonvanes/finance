"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteSharedExpenseEvent,
  linkSettlementTransaction,
  setSettlement,
  tagTransactionToEvent,
  unlinkSettlementTransaction,
  untagTransaction,
} from "@/actions/shared-expense-events";

interface TaggedTransaction {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
}

interface Candidate {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
}

const DIRECTION_LABEL: Record<string, string> = {
  owed_to_me: "Ik krijg nog terug",
  owed_by_me: "Ik ben nog schuldig",
};

export function EventRow({
  event,
  taggableTransactions,
  settlementCandidates,
}: {
  event: {
    id: string;
    name: string;
    settlementAmount: number | null;
    settlementDirection: string | null;
    settlementTransactionId: string | null;
    settledTransaction: { booking_date: string; counterparty_name: string | null; amount: number } | null;
    taggedTransactions: TaggedTransaction[];
  };
  taggableTransactions: Candidate[];
  settlementCandidates: Candidate[];
}) {
  const [isPending, startTransition] = useTransition();
  const [settlementAmount, setSettlementAmount] = useState(
    event.settlementAmount != null ? String(event.settlementAmount) : ""
  );
  const [settlementDirection, setSettlementDirection] = useState(event.settlementDirection ?? "owed_to_me");
  const router = useRouter();

  const gross = event.taggedTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const settlement = event.settlementAmount ?? 0;
  const net =
    event.settlementDirection === "owed_to_me"
      ? gross - settlement
      : event.settlementDirection === "owed_by_me"
        ? gross + settlement
        : gross;

  function saveSettlement() {
    startTransition(async () => {
      await setSettlement(
        event.id,
        settlementAmount ? Number(settlementAmount) : null,
        settlementDirection as "owed_to_me" | "owed_by_me"
      );
      router.refresh();
    });
  }

  const matchingCandidates = settlementCandidates.filter((c) =>
    event.settlementDirection === "owed_to_me" ? c.amount > 0 : c.amount < 0
  );

  return (
    <li className="flex flex-col gap-3 px-4 py-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{event.name}</p>
          <p className="text-gray-500">
            Bruto: €{gross.toFixed(2)}
            {event.settlementAmount != null && (
              <>
                {" · "}
                {DIRECTION_LABEL[event.settlementDirection ?? ""]}: €{event.settlementAmount.toFixed(2)}
              </>
            )}
            {" · "}
            <span className="font-medium text-gray-900">Netto: €{net.toFixed(2)}</span>
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirm(`"${event.name}" verwijderen? De gekoppelde transacties blijven bestaan, maar worden losgekoppeld.`)) return;
            startTransition(async () => {
              await deleteSharedExpenseEvent(event.id);
              router.refresh();
            });
          }}
          className="shrink-0 text-xs text-red-400 underline hover:text-red-600 disabled:opacity-50"
        >
          Verwijderen
        </button>
      </div>

      <div className="rounded-md border border-gray-100 bg-gray-50 p-2">
        <p className="mb-1 text-xs font-medium text-gray-700">
          Eigen transacties ({event.taggedTransactions.length})
        </p>
        {event.taggedTransactions.length > 0 && (
          <ul className="mb-2 space-y-1">
            {event.taggedTransactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                <span>
                  {new Date(tx.booking_date).toLocaleDateString("nl-NL")} ·{" "}
                  {tx.counterparty_name ?? "Onbekend"} · €{Math.abs(tx.amount).toFixed(2)}
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await untagTransaction(tx.id);
                      router.refresh();
                    });
                  }}
                  className="text-gray-400 underline hover:text-red-500 disabled:opacity-50"
                >
                  loskoppelen
                </button>
              </li>
            ))}
          </ul>
        )}
        <select
          disabled={isPending}
          defaultValue=""
          onChange={(e) => {
            const transactionId = e.target.value;
            if (!transactionId) return;
            startTransition(async () => {
              await tagTransactionToEvent(event.id, transactionId);
              router.refresh();
            });
          }}
          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
        >
          <option value="" disabled>
            + Transactie koppelen…
          </option>
          {taggableTransactions.map((tx) => (
            <option key={tx.id} value={tx.id}>
              {new Date(tx.booking_date).toLocaleDateString("nl-NL")} · {tx.counterparty_name ?? "Onbekend"} · €
              {Math.abs(tx.amount).toFixed(2)}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-md border border-gray-100 bg-gray-50 p-2">
        <p className="mb-1 text-xs font-medium text-gray-700">Eindafrekening</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400">€</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={settlementAmount}
            disabled={isPending}
            onChange={(e) => setSettlementAmount(e.target.value)}
            placeholder="Bedrag"
            className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
          />
          <select
            value={settlementDirection}
            disabled={isPending}
            onChange={(e) => setSettlementDirection(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs disabled:opacity-50"
          >
            <option value="owed_to_me">Ik krijg nog terug</option>
            <option value="owed_by_me">Ik ben nog schuldig</option>
          </select>
          <button
            type="button"
            disabled={isPending}
            onClick={saveSettlement}
            className="text-xs font-medium text-gray-900 underline disabled:opacity-50"
          >
            Opslaan
          </button>
        </div>

        {event.settlementAmount != null && (
          <div className="mt-2">
            {event.settledTransaction ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>
                  Gekoppeld aan {event.settledTransaction.counterparty_name ?? "onbekend"} op{" "}
                  {new Date(event.settledTransaction.booking_date).toLocaleDateString("nl-NL")} (€
                  {event.settledTransaction.amount.toFixed(2)})
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await unlinkSettlementTransaction(event.id);
                      router.refresh();
                    });
                  }}
                  className="text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
                >
                  ontkoppelen
                </button>
              </div>
            ) : (
              <select
                disabled={isPending}
                defaultValue=""
                onChange={(e) => {
                  const transactionId = e.target.value;
                  if (!transactionId) return;
                  startTransition(async () => {
                    await linkSettlementTransaction(event.id, transactionId);
                    router.refresh();
                  });
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
              >
                <option value="" disabled>
                  Koppel de daadwerkelijke betaling…
                </option>
                {matchingCandidates.map((tx) => {
                  const isCloseMatch = Math.abs(Math.abs(tx.amount) - settlement) < 0.01;
                  return (
                    <option key={tx.id} value={tx.id}>
                      {isCloseMatch ? "✓ " : ""}
                      {new Date(tx.booking_date).toLocaleDateString("nl-NL")} ·{" "}
                      {tx.counterparty_name ?? "Onbekend"} · €{tx.amount.toFixed(2)}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
