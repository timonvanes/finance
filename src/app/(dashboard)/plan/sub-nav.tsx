"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/plan", label: "Overzicht" },
  { href: "/plan/huis", label: "Huis en kosten" },
  { href: "/plan/inkomen", label: "Inkomen" },
  { href: "/plan/belasting", label: "Belasting" },
  { href: "/plan/studielening", label: "Studielening" },
  { href: "/plan/hypotheek", label: "Hypotheek" },
  { href: "/plan/beleggen", label: "Sparen en beleggen" },
  { href: "/plan/update", label: "Jaarlijkse update" },
  { href: "/plan/bronnen", label: "Bronnen" },
];

export function SubNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto px-4 pb-1 print:hidden">
      <ul className="flex gap-2">
        {TABS.map((t) => {
          const active = t.href === "/plan" ? pathname === "/plan" : pathname.startsWith(t.href);
          return (
            <li key={t.href} className="shrink-0">
              <Link
                href={t.href}
                prefetch
                className={
                  active
                    ? "flex min-h-[44px] items-center rounded-full bg-teal-700 px-4 text-sm font-medium text-white"
                    : "flex min-h-[44px] items-center rounded-full bg-white px-4 text-sm text-gray-700 ring-1 ring-gray-200 active:bg-gray-100"
                }
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
