"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = (d: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);

const TABS: {
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: ReactNode;
}[] = [
  {
    href: "/",
    label: "Overzicht",
    match: (p) => p === "/",
    icon: icon(
      <>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </>
    ),
  },
  {
    href: "/transactions",
    label: "Transacties",
    match: (p) => p.startsWith("/transactions"),
    icon: icon(
      <>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" />
      </>
    ),
  },
  {
    href: "/terugvorderen",
    label: "Terugvorderen",
    match: (p) => p.startsWith("/terugvorderen") || p.startsWith("/reclaims"),
    icon: icon(
      <>
        <path d="M7 7h11l-3-3" />
        <path d="M17 17H6l3 3" />
      </>
    ),
  },
  {
    href: "/returns",
    label: "Retouren",
    match: (p) => p.startsWith("/returns"),
    icon: icon(
      <>
        <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
        <path d="M3 8l9 5 9-5" />
        <path d="M12 13v8" />
      </>
    ),
  },
  {
    href: "/meer",
    label: "Meer",
    match: (p) => p.startsWith("/meer") || p.startsWith("/pots") || p.startsWith("/settings"),
    icon: icon(
      <>
        <circle cx="5" cy="12" r="1.2" />
        <circle cx="12" cy="12" r="1.2" />
        <circle cx="19" cy="12" r="1.2" />
      </>
    ),
  },
];

export function TabBar() {
  const pathname = usePathname();
  // The new-reclaim wizard is a full-screen flow with its own bottom buttons.
  if (pathname.startsWith("/terugvorderen/nieuw")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-4xl">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                prefetch
                className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? "text-teal-700" : "text-gray-500"
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
