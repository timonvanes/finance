"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { combineReclaims } from "@/actions/payment-requests";
import { writeOffReclaim } from "@/actions/reclaims";
import { LinkTransaction, DeleteButton } from "./link-transaction";
import { ReferenceCode } from "./reference-code";
import { ReclaimNoteReceipt } from "./reclaim-note-receipt";

interface IncomingTransaction {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
}

interface OpenReclaim {
  id: string;
  person_id: string;
  computed_amount: number;
  reference_code: string | null;
  tikkie_link: string | null;
  settlement_method: string;
  person_name: string;
  counterparty_name: string | null;
  booking_date: string | null;
  note: string | null;
  receipt_path: string | null;
}

export function OpenReclaimsList({
  reclaims,
  incomingTransactions,
}: {
  reclaims: OpenReclaim[];
  incomingTransactions: IncomingTransaction[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(id: string) {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedItems = reclaims.filter((r) => selected.has(r.id));
  const distinctPeople = new Set(selectedItems.map((r) => r.person_id));
  const canCombine = selectedItems.length >= 2 && distinctPeople.size === 1;
  const combinedTotal = selectedItems.reduce((sum, r) => sum + r.computed_amount, 0);

  function handleCombine() {
    if (!canCombine) {
      setError("Selecteer 2 of meer terugvorderingen van dezelfde persoon.");
      return;
    }
    startTransition(async () => {
      try {
        await combineReclaims([...selected]);
        setSelected(new Set());
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Combineren mislukt");
      }
    });
  }

  if (reclaims.length === 0) {
    return <p className="text-sm text-gray-500">Niks openstaand.</p>;
  }

  return (
    <div className="space-y-2">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
          <span className="text-gray-600">
            {selectedItems.length} geselecteerd
            {selectedItems.length > 0 && ` · €${combinedTotal.toFixed(2)}`}
          </span>
          <button
            type="button"
            disabled={!canCombine || isPending}
            onClick={handleCombine}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {isPending ? "Bezig…" : "Combineer in één betaalverzoek"}
          </button>
          {error && <span className="text-red-600">{error}</span>}
        </div>
      )}

      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
        {reclaims.map((r) => (
          <li key={r.id} className="flex gap-3 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
              className="mt-1"
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 truncate font-medium text-gray-900">
                    {r.person_name} · €{r.computed_amount.toFixed(2)}
                    {r.reference_code && <ReferenceCode code={r.reference_code} />}
                  </p>
                  <p className="truncate text-gray-500">
                    {r.counterparty_name ?? "Onbekend"} ·{" "}
                    {r.booking_date && new Date(r.booking_date).toLocaleDateString("nl-NL")}
                    {r.tikkie_link && (
                      <>
                        {" · "}
                        <span className="italic">{r.tikkie_link}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/api/export/reclaim/${r.id}`}
                    className="whitespace-nowrap text-xs text-gray-400 underline hover:text-gray-600"
                  >
                    Exporteren
                  </a>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (!confirm(`"${r.person_name}" niet meer proberen te innen? Dit wordt dan als eigen kosten beschouwd.`)) return;
                      startTransition(async () => {
                        await writeOffReclaim(r.id);
                        router.refresh();
                      });
                    }}
                    className="whitespace-nowrap text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
                  >
                    Niet inbaar
                  </button>
                  <DeleteButton reclaimId={r.id} />
                </div>
              </div>
              <ReclaimNoteReceipt reclaimId={r.id} note={r.note} receiptPath={r.receipt_path} />
              <LinkTransaction
                reclaimId={r.id}
                computedAmount={r.computed_amount}
                incomingTransactions={incomingTransactions}
                showAutoMatch={r.settlement_method === "bank"}
              />
              {r.settlement_method === "external_app" && (
                <p className="text-xs text-gray-400">
                  Via WieBetaaltWat/andere app — wordt niet automatisch herkend.
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
