import Link from "next/link";
import { headers } from "next/headers";
import { getCalendarToken } from "@/lib/settings";
import { CalendarForm } from "./calendar-form";

export default async function CalendarSettingsPage() {
  const token = await getCalendarToken();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const url = token ? `https://${host}/api/calendar/${token}.ics` : null;

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
        <h1 className="text-2xl font-semibold text-gray-900">Agenda</h1>
      </div>

      <p className="px-1 text-base text-gray-600">
        Abonneer je agenda (Apple, Google of Outlook) op deze link, dan komt de uiterste retourdatum van elke open
        bestelling vanzelf in je agenda, met een herinnering 3 dagen en 1 dag van tevoren. Bestellingen die je
        hebt afgehandeld of waar je alles van terugstuurt, verdwijnen er weer uit.
      </p>

      <CalendarForm url={url} />

      <p className="px-1 text-sm text-gray-500">
        Een agenda ververst abonnementen zelf, meestal elke paar uur tot een dag (Google kan tot 24 uur duren). Houd
        de link geheim: wie hem heeft, ziet je retourtermijnen.
      </p>
    </div>
  );
}
