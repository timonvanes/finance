import Link from "next/link";
import { getMonthStartDay } from "@/lib/settings";
import { MonthStartForm } from "./month-start-form";

export default async function MonthSettingsPage() {
  const startDay = await getMonthStartDay();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/meer"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Begin van de maand</h1>
      </div>

      <p className="px-1 text-base text-gray-600">
        Kies op welke dag je maand begint, bijvoorbeeld de dag dat je salaris binnenkomt. Het
        overzicht, je budgetten, de maandvergelijking en de vrije ruimte rekenen dan van die dag tot
        de dag ervoor.
      </p>

      <MonthStartForm initialDay={startDay} />
    </div>
  );
}
