"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Four places, in the order of use: how am I doing, fill in, look deeper, keep it up to date.
const TABS: { href: string; label: string; paths: string[] }[] = [
  { href: "/plan", label: "Overzicht", paths: [] },
  { href: "/plan/variabelen", label: "Variabelen", paths: ["/plan/variabelen"] },
  {
    href: "/plan/analyse",
    label: "Analyse",
    paths: ["/plan/analyse", "/plan/schuiven", "/plan/scenarios", "/plan/hypotheek", "/plan/huis", "/plan/inkomen", "/plan/belasting", "/plan/studielening", "/plan/beleggen"],
  },
  { href: "/plan/update", label: "Bijwerken", paths: ["/plan/update", "/plan/bronnen"] },
];

export function SubNav() {
  const pathname = usePathname();
  const active = (t: (typeof TABS)[number]) => (t.href === "/plan" ? pathname === "/plan" : t.paths.some((p) => pathname.startsWith(p)));
  const detail = TABS[2].paths.slice(1).some((p) => pathname.startsWith(p));
  const sources = pathname.startsWith("/plan/bronnen");

  return (
    <div className="space-y-2 print:hidden">
      <nav>
        <ul className="grid grid-cols-4 gap-1 rounded-2xl bg-gray-100 p-1">
          {TABS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                prefetch
                className={
                  active(t)
                    ? "flex min-h-[44px] items-center justify-center rounded-xl bg-white text-sm font-medium text-teal-800 shadow-sm"
                    : "flex min-h-[44px] items-center justify-center rounded-xl text-sm text-gray-600 active:bg-gray-200"
                }
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {detail && (
        <Link href="/plan/analyse" className="flex min-h-[40px] items-center text-sm text-teal-700">
          ‹ Terug naar Analyse
        </Link>
      )}
      {sources && (
        <Link href="/plan/update" className="flex min-h-[40px] items-center text-sm text-teal-700">
          ‹ Terug naar Bijwerken
        </Link>
      )}
    </div>
  );
}
