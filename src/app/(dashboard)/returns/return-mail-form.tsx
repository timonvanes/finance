"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyReturnToOrder, processReturnEmail } from "@/actions/returns";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

type Extraction = Awaited<ReturnType<typeof processReturnEmail>>["extraction"];
type Applied = Awaited<ReturnType<typeof applyReturnToOrder>>;
type Candidate = { id: string; merchant_name: string; order_date: string | null };

export function ReturnMailForm() {
  const [text, setText] = useState("");
  const [applied, setApplied] = useState<Applied | null>(null);
  const [choose, setChoose] = useState<{ extraction: Extraction; candidates: Candidate[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const reset = () => {
    setApplied(null);
    setChoose(null);
    setMessage(null);
    setError(null);
  };

  return (
    <div className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Plak hier de retourmail of creditnota…"
        className="w-full rounded-xl border border-gray-300 p-4 text-base"
      />
      <button
        type="button"
        disabled={isPending || text.trim().length < 20}
        onClick={() => {
          reset();
          startTransition(async () => {
            try {
              const result = await processReturnEmail(text);
              if (result.status === "applied") {
                setApplied(result.result);
                setText("");
              } else if (result.status === "choose") {
                setChoose({ extraction: result.extraction, candidates: result.candidates });
              } else {
                setMessage(
                  `Geen bestelling van ${result.extraction.merchant_name} gevonden die hierbij past. Voeg eerst de bestelling toe.`
                );
              }
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Verwerken mislukt");
            }
          });
        }}
        className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
      >
        {isPending ? "Bezig…" : "Verwerk retourmail"}
      </button>

      {choose && (
        <div className="space-y-2 rounded-xl bg-amber-50 p-4">
          <p className="text-base text-amber-950">
            Bij welke bestelling hoort dit ({choose.extraction.merchant_name})?
          </p>
          {choose.candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    setApplied(await applyReturnToOrder(c.id, choose.extraction));
                    setChoose(null);
                    setText("");
                    router.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Verwerken mislukt");
                  }
                })
              }
              className="min-h-[48px] w-full rounded-xl border border-amber-200 bg-white px-4 text-left text-base text-gray-900 active:bg-gray-50 disabled:opacity-50"
            >
              {c.merchant_name}
              {c.order_date && ` · ${new Date(c.order_date).toLocaleDateString("nl-NL")}`}
            </button>
          ))}
        </div>
      )}

      {applied && (
        <div className="space-y-1 rounded-xl bg-teal-50 p-4 text-base text-teal-950">
          <p className="font-medium">Verwerkt bij {applied.merchant}</p>
          <p>
            {applied.itemsMatched} van {applied.itemsInMail} artikel{applied.itemsInMail === 1 ? "" : "en"} als retour gemarkeerd
            {applied.shipping > 0 && ` · ${euro(applied.shipping)} verzendkosten terug`}
            {applied.fee > 0 && ` · ${euro(applied.fee)} retourkosten ingehouden`}
          </p>
          <p>
            Verwacht terug: <span className="font-semibold">{euro(applied.expected)}</span>
            {applied.mailTotal != null && Math.abs(applied.mailTotal - applied.expected) >= 0.01 && (
              <span className="text-amber-800"> (de mail noemt {euro(applied.mailTotal)} — controleer de bestelling)</span>
            )}
          </p>
          {applied.linked && <p>De restitutie is al binnen en automatisch gekoppeld.</p>}
        </div>
      )}
      {message && <p className="text-base text-gray-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
