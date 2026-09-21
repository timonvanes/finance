import Link from "next/link";
import { getHiddenDashboardModules } from "@/lib/settings";
import { ModuleToggles } from "./module-toggles";

export default async function OverzichtInstellingenPage() {
  const hidden = await getHiddenDashboardModules();

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
        <h1 className="text-2xl font-semibold text-gray-900">Overzichtspagina</h1>
      </div>
      <p className="px-1 text-base text-gray-600">Kies welke onderdelen je op het overzicht wilt zien.</p>
      <ModuleToggles hidden={hidden} />
    </div>
  );
}
