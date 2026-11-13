import Link from "next/link";
import { getNavTabs } from "@/lib/settings";
import { getReturnsEnabled } from "@/lib/settings";
import { MenuForm } from "./menu-form";

export default async function MenuSettingsPage() {
  const [tabs, returnsOn] = await Promise.all([getNavTabs(), getReturnsEnabled()]);

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
        <h1 className="text-2xl font-semibold text-gray-900">Menu</h1>
      </div>

      <p className="px-1 text-base text-gray-600">
        Kies maximaal vier onderdelen voor de balk onderin. Alles wat je niet kiest staat onder Meer, met een icoon erbij. Met de pijltjes bepaal je de volgorde.
      </p>

      <MenuForm initial={tabs} returnsOn={returnsOn} />
    </div>
  );
}
