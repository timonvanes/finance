import Link from "next/link";
import { logout } from "@/actions/auth";

const NAV_ITEMS = [
  { href: "/", label: "Overzicht" },
  { href: "/transactions", label: "Transacties" },
  { href: "/reclaims", label: "Terugvorderingen" },
  { href: "/returns", label: "Retouren" },
  { href: "/settings", label: "Instellingen" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-2 py-2">
          <div className="flex items-center justify-between gap-2">
            <nav className="flex flex-1 gap-1 overflow-x-auto text-sm">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-md px-3 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <form action={logout} className="shrink-0">
              <button
                type="submit"
                className="flex min-h-[44px] items-center whitespace-nowrap rounded-md px-3 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                Uitloggen
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-3 py-6 sm:px-4">
        {children}
      </main>
    </div>
  );
}
