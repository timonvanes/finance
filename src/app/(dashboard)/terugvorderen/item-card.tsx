"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteReclaim,
  linkReclaimToTransaction,
  markReclaimPaid,
  writeOffReclaim,
} from "@/actions/reclaims";
import {
  addReclaimToPaymentRequest,
  combineReclaims,
  linkPaymentRequestToTransaction,
  markPaymentRequestPaid,
  uncombinePaymentRequest,
  writeOffPaymentRequest,
} from "@/actions/payment-requests";
import { TxDetails, type TxInfo } from "./tx-details";
import { ReferenceCode } from "../reclaims/reference-code";

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
  tx?: TxInfo | null;
  lines?: {
    title: string;
    date: string | null;
    description: string | null;
    transactionAmount: number | null;
    iban: string | null;
    amount: number;
    sourceTotal: number | null;
  }[];
}

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export function ItemCard({
  item,
  personName,
  incoming,
  openRequests = [],
  otherReclaims = [],
}: {
  item: OpenItem;
  personName: string;
  incoming: IncomingTransaction[];
  openRequests?: { id: string; referenceCode: string; total: number }[];
  otherReclaims?: { id: string; label: string; amount: number }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLLIElement>(null);
  const router = useRouter();

  // hide = the card should disappear from this list once the action succeeds;
  // it goes away immediately and comes back only if the action fails.
  function run(fn: () => Promise<unknown>, hide = false) {
    setError(null);
    if (hide) cardRef.current?.classList.add("hidden");
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        cardRef.current?.classList.remove("hidden");
        setError(e instanceof Error ? e.message : "Er ging iets mis");
      }
    });
  }

  const sorted = [...incoming].sort(
    (a, b) => Math.abs(a.amount - item.amount) - Math.abs(b.amount - item.amount)
  );
  const isWbw = item.method === "external_app";

  return (
    <li ref={cardRef} className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
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
              {l.sourceTotal != null && Math.abs(l.sourceTotal - l.amount) > 0.01 && (
                <p className="mt-1 text-sm text-gray-500">van {euro(l.sourceTotal)} totaal</p>
              )}
              <TxDetails
                tx={{
                  name: l.title,
                  date: l.date,
                  amount: l.transactionAmount,
                  description: l.description,
                  iban: l.iban,
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {item.tx && <TxDetails tx={item.tx} />}

      {item.referenceCode && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          Referentiecode <ReferenceCode code={item.referenceCode} />
        </div>
      )}

      {isWbw ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => markReclaimPaid(item.id), true)}
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
                  : linkPaymentRequestToTransaction(item.id, txId),
                true
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
                item.kind === "reclaim" ? markReclaimPaid(item.id) : markPaymentRequestPaid(item.id),
                true
              )
            }
            className="min-h-[52px] w-full rounded-xl border border-gray-300 text-base font-medium text-gray-900 active:bg-gray-50 disabled:opacity-50"
          >
            Handmatig als ontvangen markeren
          </button>
        </div>
      )}

      {item.kind === "reclaim" && item.method === "bank" && (openRequests.length > 0 || otherReclaims.length > 0) && (
        <div className="space-y-2">
          {openRequests.length > 0 && (
            <select
              disabled={isPending}
              defaultValue=""
              onChange={(e) => {
                const requestId = e.target.value;
                if (requestId) run(() => addReclaimToPaymentRequest(item.id, requestId));
              }}
              className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 disabled:opacity-50"
            >
              <option value="" disabled>
                Toevoegen aan gecombineerd betaalverzoek…
              </option>
              {openRequests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.referenceCode} · {euro(r.total)}
                </option>
              ))}
            </select>
          )}
          {otherReclaims.length > 0 && (
            <select
              disabled={isPending}
              defaultValue=""
              onChange={(e) => {
                const otherId = e.target.value;
                if (otherId) run(() => combineReclaims([item.id, otherId]));
              }}
              className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 disabled:opacity-50"
            >
              <option value="" disabled>
                Combineren met andere terugvordering…
              </option>
              {otherReclaims.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} · {euro(r.amount)}
                </option>
              ))}
            </select>
          )}
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
                item.kind === "reclaim" ? writeOffReclaim(item.id) : writeOffPaymentRequest(item.id),
                true
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
                run(() => deleteReclaim(item.id), true);
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
