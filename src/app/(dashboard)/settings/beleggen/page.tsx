import Link from "next/link";
import { getInvestReminderDay } from "@/lib/settings";
import { InvestReminderForm } from "./invest-reminder-form";

export default async function InvestReminderSettingsPage() {
  const day = await getInvestReminderDay();

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
        <h1 className="text-2xl font-semibold text-gray-900">Beleggen</h1>
      </div>

      <p className="px-1 text-base text-gray-600">
        Kies een vaste dag in de maand waarop je een melding krijgt om aandelen of beleggingen te
        kopen. Zet uit als je geen herinnering wilt.
      </p>

      <InvestReminderForm initialDay={day} />
    </div>
  );
}
