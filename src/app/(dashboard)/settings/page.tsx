import Link from "next/link";
import { getMonthStartDay } from "@/lib/settings";

const GROUPS: {
  title: string;
  items: { href: string; label: string; description: string; value?: (ctx: { startDay: number }) => string }[];
}[] = [
  {
    title: "Geld",
    items: [
      {
        href: "/settings/month",
        label: "Begin van de maand",
        description: "Laat je maand beginnen op je salarisdag",
        value: ({ startDay }) => (startDay === 1 ? "1e" : `${startDay}e`),
      },
      {
        href: "/settings/rapport",
        label: "Baten en lasten",
        description: "Rapport per maand, periode of jaar om af te drukken",
      },
      {
        href: "/settings/budgets",
        label: "Budgetdoelen",
        description: "Maandbudget per categorie",
      },
      {
        href: "/settings/categories",
        label: "Categorieën",
        description: "Uitgaven- en inkomenscategorieën",
      },
    ],
  },
  {
    title: "Rekeningen",
    items: [
      {
        href: "/settings/bank-connections",
        label: "Bankkoppelingen",
        description: "Banken koppelen en synchroniseren",
      },
      {
        href: "/settings/own-ibans",
        label: "Eigen IBAN's",
        description: "Extra eigen rekeningen, zoals Revolut",
      },
    ],
  },
  {
    title: "Mensen",
    items: [
      {
        href: "/settings/people",
        label: "Personen en groepen",
        description: "Voor terugvorderingen en leningen",
      },
    ],
  },
];

export default async function SettingsPage() {
  const startDay = await getMonthStartDay();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/meer"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Instellingen</h1>
      </div>

      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-2">
          <h2 className="px-1 text-sm font-medium text-gray-500">{group.title}</h2>
          <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {group.items.map((item) => (
              <li key={item.href} className="border-b border-gray-100 last:border-b-0">
                <Link
                  href={item.href}
                  prefetch
                  className="flex min-h-[68px] items-center gap-3 px-5 py-3 active:bg-gray-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg text-gray-900">{item.label}</span>
                    <span className="block text-sm text-gray-500">{item.description}</span>
                  </span>
                  {item.value && (
                    <span className="shrink-0 text-base text-gray-500">{item.value({ startDay })}</span>
                  )}
                  <span className="text-2xl text-gray-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
