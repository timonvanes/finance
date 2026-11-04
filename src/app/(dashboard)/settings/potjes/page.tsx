import Link from "next/link";
import { getPotGraceDays } from "@/lib/settings";
import { PotGraceForm } from "./pot-grace-form";

export default async function PotSettingsPage() {
  const days = await getPotGraceDays();

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
        <h1 className="text-2xl font-semibold text-gray-900">Potjes</h1>
      </div>

      <p className="px-1 text-base text-gray-600">
        Elk potje met een doel en een doeldatum heeft een schema: elke maand hoort er een gelijk deel bij te komen op de
        stortingsdag. Rond die dag is er speling. Stort je binnen die dagen eerder of later, dan staat het potje
        gewoon op schema.
      </p>

      <PotGraceForm initialDays={days} />
    </div>
  );
}
