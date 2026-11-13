"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavKey } from "@/lib/nav";
import { NavIcon } from "./nav-icon";

const SHORT: Partial<Record<NavKey, string>> = { reclaims: "Terugvorderen", plan: "Plan", notifications: "Meldingen" };

// The bottom bar: the places the person picked, then "Meer" with everything else.
export function TabBar({ tabs }: { tabs: NavKey[] }) {
  const pathname = usePathname();
  // The new-reclaim wizard is a full-screen flow with its own bottom buttons.
  if (pathname.startsWith("/terugvorderen/nieuw")) return null;

  const items = tabs.map((k) => NAV_ITEMS.find((i) => i.key === k)!).filter(Boolean);
  const inBar = items.some((i) => i.match(pathname));
  // "Meer" lights up on its own page, and on any page that is not in the bar.
  const moreActive = pathname.startsWith("/meer") || (!inBar && NAV_ITEMS.some((i) => i.match(pathname)));

  const cls = (active: boolean) =>
    `flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-teal-700" : "text-gray-500"}`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 print:hidden border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-4xl">
        {items.map((item) => (
          <li key={item.key} className="flex-1">
            <Link href={item.href} prefetch className={cls(item.match(pathname))}>
              <NavIcon name={item.key} />
              {SHORT[item.key] ?? item.label}
            </Link>
          </li>
        ))}
        <li className="flex-1">
          <Link href="/meer" prefetch className={cls(moreActive)}>
            <NavIcon name="more" />
            Meer
          </Link>
        </li>
      </ul>
    </nav>
  );
}
