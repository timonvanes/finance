import Link from "next/link";
import { logout } from "@/actions/auth";
import { NAV_ITEMS } from "@/lib/nav";
import { getNavTabs } from "@/lib/settings";
import { NavIcon } from "../nav-icon";

// Everything that is not in the bottom bar. The person decides what that is under
// Instellingen, Onderbalk.
export default async function MeerPage() {
  const tabs = new Set(await getNavTabs());
  const items = NAV_ITEMS.filter((i) => !tabs.has(i.key));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Meer</h1>

      {items.length > 0 && (
        <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
          {items.map((item) => (
            <li key={item.key} className="border-b border-gray-100 last:border-b-0">
              <Link href={item.href} prefetch className="flex min-h-[64px] items-center gap-4 px-5 py-3 active:bg-gray-50">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <NavIcon name={item.key} size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg text-gray-900">{item.label}</span>
                  <span className="block text-sm text-gray-500">{item.hint}</span>
                </span>
                <span className="text-2xl text-gray-300">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form action={logout}>
        <button
          type="submit"
          className="min-h-[56px] w-full rounded-2xl bg-white text-lg text-red-600 ring-1 ring-gray-200 active:bg-gray-50"
        >
          Uitloggen
        </button>
      </form>
    </div>
  );
}
