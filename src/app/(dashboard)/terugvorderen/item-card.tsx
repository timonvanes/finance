"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteReclaim,
  linkReclaimToTransaction,
  markReclaimPaid,
  writeOffReclaim,
} from "@/actions/reclaims";
import {
  linkPaymentRequestToTransaction,
  markPaymentRequestPaid,
  uncombinePaymentRequest,
  writeOffPaymentRequest,
} from "@/actions/payment-requests";

interface IncomingTransaction {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
}

export interface OpenItem {
  kind: "reclaim" | "request";
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  sourceTotal: number | null;
  method: "bank" | "external_app";
  referenceCode: string | null;
  lines?: {
    title: string;
    date: string | null;
    description: string | null;
    transactionAmount: number | null;
    amount: number;
    sourceTotal: number | null;
  }[];
}

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export function ItemCard({
  item,
  personName,
  incoming,
}: {
  item: OpenItem;
  personName: string;
  incoming: IncomingTransaction[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Er ging iets mis");
      }
    });
  }

  const sorted = [...incoming].sort(
    (a, b) => Math.abs(a.amount - item.amount) - Math.abs(b.amount - item.amount)
  );
  const isWbw = item.method === "external_app";

  return (
    <li className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-medium text-gray-900">{item.title}</p>
          <p className="text-sm text-gray-500">{item.subtitle}</p>
        </div>
        <p className="shrink-0 text-lg font-semibold text-gray-900">{euro(item.amount)}</p>
      </div>

      {item.sourceTotal != null && (isWbw || Math.abs(item.sourceTotal - item.amount) > 0.01) && (
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-base text-gray-700">
          {isWbw ? "Voer in bij WBW: " : "Totaal: "}
          <span className="font-semibold text-gray-900">{euro(item.sourceTotal)}</span>
        </p>
      )}

      {item.lines && (
        <ul className="space-y-2">
          {item.lines.map((l, i) => (
            <li key={i} className="rounded-xl bg-gray-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-gray-900">{l.title}</p>
                  {l.date && (
                    <p className="text-sm text-gray-500">
                      {new Date(l.date).toLocaleDateString("nl-NL")}
                      {l.transactionAmount != null && ` · afschrijving ${euro(Math.abs(l.transactionAmount))}`}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-base font-semibold text-gray-900">{euro(l.amount)}</p>
              </div>
              {l.description && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-500">{l.description}</p>
              )}
              {l.sourceTotal != null && Math.abs(l.sourceTotal - l.amount) > 0.01 && (
                <p className="mt-1 text-sm text-gray-500">van {euro(l.sourceTotal)} totaal</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {item.referenceCode && (
        <p className="text-sm text-gray-500">
          Code: <span className="font-mono text-gray-900">{item.referenceCode}</span>
        </p>
      )}

      {isWbw ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => markReclaimPaid(item.id))}
          className="min-h-[52px] w-full rounded-xl bg-gray-900 text-base font-medium text-white active:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? "Bezig…" : "Gezet in WieBetaaltWat"}
        </button>
      ) : (
        <div className="space-y-2">
          <select
            disabled={isPending}
            defaultValue=""
            onChange={(e) => {
              const txId = e.target.value;
              if (!txId) return;
              run(() =>
                item.kind === "reclaim"
                  ? linkReclaimToTransaction(item.id, txId)
                  : linkPaymentRequestToTransaction(item.id, txId)
              );
            }}
            className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 disabled:opacity-50"
          >
            <option value="" disabled>
              Koppel binnengekomen betaling…
            </option>
            {sorted.map((tx) => (
              <option key={tx.id} value={tx.id}>
                {Math.abs(tx.amount - item.amount) < 0.01 ? "✓ " : ""}
                {new Date(tx.booking_date).toLocaleDateString("nl-NL")} ·{" "}
                {tx.counterparty_name ?? "Onbekend"} · {euro(tx.amount)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(() =>
                item.kind === "reclaim" ? markReclaimPaid(item.id) : markPaymentRequestPaid(item.id)
              )
            }
            className="min-h-[52px] w-full rounded-xl border border-gray-300 text-base font-medium text-gray-900 active:bg-gray-50 disabled:opacity-50"
          >
            Handmatig als ontvangen markeren
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <details className="text-sm">
        <summary className="flex min-h-[44px] cursor-pointer items-center text-gray-500">
          Meer opties
        </summary>
        <div className="flex flex-wrap gap-2 pb-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirm(`"${personName}" niet meer proberen te innen? Dit wordt dan als eigen kosten beschouwd.`)) return;
              run(() =>
                item.kind === "reclaim" ? writeOffReclaim(item.id) : writeOffPaymentRequest(item.id)
              );
            }}
            className="min-h-[44px] rounded-xl border border-gray-300 px-4 text-gray-700 disabled:opacity-50"
          >
            Niet inbaar
          </button>
          {item.kind === "request" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (!confirm("Deze combinatie ontbinden? De terugvorderingen blijven los bestaan.")) return;
                run(() => uncombinePaymentRequest(item.id));
              }}
              className="min-h-[44px] rounded-xl border border-gray-300 px-4 text-gray-700 disabled:opacity-50"
            >
              Ontbinden
            </button>
          )}
          {item.kind === "reclaim" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (!confirm("Deze terugvordering verwijderen?")) return;
                run(() => deleteReclaim(item.id));
              }}
              className="min-h-[44px] rounded-xl border border-red-200 px-4 text-red-600 disabled:opacity-50"
            >
              Verwijderen
            </button>
          )}
        </div>
      </details>
    </li>
  );
}
