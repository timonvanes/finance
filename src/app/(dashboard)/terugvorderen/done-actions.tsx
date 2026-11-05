"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReclaim, undoWriteOffReclaim, unlinkReclaim } from "@/actions/reclaims";
import {
  undoWriteOffPaymentRequest,
  unlinkPaymentRequest,
} from "@/actions/payment-requests";

// For an already finished reclaim: take the payment link away (back to
// "openstaand", the incoming transaction returns to the to-do list) or, for
// one written off as "niet inbaar", make it outstanding again.
export function DoneActions({
  kind,
  id,
  status,
  inWieBetaaltWat = false,
}: {
  kind: "reclaim" | "request";
  id: string;
  status: string;
  // True when this reclaim was put into WieBetaaltWat from here.
  inWieBetaaltWat?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const writtenOff = status === "written_off";

  // Put into WieBetaaltWat from here: unlinking would leave the expense there while
  // this opens again, so the only way back is deleting, which removes both.
  if (kind === "reclaim" && inWieBetaaltWat) {
    return (
      <div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (
              !confirm(
                "Deze terugvordering verwijderen? De uitgave in WieBetaaltWat wordt dan ook verwijderd. Staan er andere personen in diezelfde uitgave, dan worden hun terugvorderingen weer openstaand."
              )
            )
              return;
            setError(null);
            startTransition(async () => {
              try {
                const r = await deleteReclaim(id);
                if (r.error) {
                  setError(r.error);
                  return;
                }
                router.refresh();
              } catch {
                setError("Verwijderen mislukt. Probeer het opnieuw.");
              }
            });
          }}
          className="min-h-[44px] rounded-xl border border-red-200 px-4 text-sm font-medium text-red-600 active:bg-red-50 disabled:opacity-50"
        >
          {isPending ? "Bezig…" : "Verwijderen (ook in WieBetaaltWat)"}
        </button>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (
            !confirm(
              writtenOff
                ? "Weer als openstaand markeren?"
                : "Ontkoppelen? De terugvordering staat dan weer open en de betaling komt terug in Te doen."
            )
          )
            return;
          setError(null);
          startTransition(async () => {
            try {
              if (writtenOff) {
                await (kind === "reclaim" ? undoWriteOffReclaim(id) : undoWriteOffPaymentRequest(id));
              } else {
                await (kind === "reclaim" ? unlinkReclaim(id) : unlinkPaymentRequest(id));
              }
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Mislukt");
            }
          });
        }}
        className="min-h-[44px] rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 active:bg-gray-50 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : writtenOff ? "Weer openstaand maken" : "Ontkoppelen"}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
