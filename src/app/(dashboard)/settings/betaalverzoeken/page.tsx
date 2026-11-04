import Link from "next/link";
import { getBunqPaymentLinksEnabled } from "@/lib/settings";
import { isBunqConfigured } from "@/lib/bunq/client";
import { BunqLinksForm } from "./bunq-links-form";

export default async function PaymentRequestSettingsPage() {
  const [enabled, configured] = await Promise.all([getBunqPaymentLinksEnabled(), Promise.resolve(isBunqConfigured())]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Betaalverzoeken</h1>
      </div>

      <p className="px-1 text-base text-gray-600">
        Een betaalverzoek maak je standaard met Tikkie: de app opent met het bedrag en je omschrijving al ingevuld.
        Heb je bunq Premium, dan kun je hier ook de bunq-betaallink weer aanzetten. Die verschijnt dan als extra knop.
      </p>

      <BunqLinksForm initialEnabled={enabled} />

      {!configured && (
        <p className="px-1 text-sm text-gray-500">
          Let op: voor bunq-betaallinks moet ook BUNQ_API_KEY in Vercel staan. Die staat er nu niet.
        </p>
      )}
    </div>
  );
}
