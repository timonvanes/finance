import Link from "next/link";
import { getCategories } from "@/actions/transactions";
import { getBudgets, type BudgetPeriod } from "@/actions/budgets";
import { BudgetRow } from "./budget-row";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export default async function BudgetsPage() {
  const [categories, budgets] = await Promise.all([getCategories(), getBudgets()]);

  const limitByCategory = new Map(budgets.map((b) => [b.category_id, { limit: b.monthly_limit, period: b.period as BudgetPeriod }]));
  const expenseCategories = categories.filter((c) => c.kind !== "income");
  // Everything expressed per month so quarter and year budgets add up.
  const perMonth = { month: 1, quarter: 3, year: 12 } as const;
  const totalBudget = budgets.reduce((sum, b) => sum + b.monthly_limit / perMonth[b.period as BudgetPeriod], 0);

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
        <h1 className="text-2xl font-semibold text-gray-900">Budgetdoelen</h1>
      </div>

      <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        <p className="text-sm text-gray-500">Totaal per maand (kwartaal en jaar omgerekend)</p>
        <p className="mt-1 text-4xl font-semibold text-gray-900">{euro(totalBudget)}</p>
        <p className="mt-1 text-sm text-gray-400">
          {budgets.length === 0
            ? "Nog geen budgetten"
            : `over ${budgets.length} ${budgets.length === 1 ? "categorie" : "categorieën"}`}
        </p>
      </div>

      <p className="px-1 text-sm text-gray-500">
        Stel per categorie een budget in, per maand, kwartaal of jaar. Op het overzicht zie je hoe je ervoor staat.
      </p>

      {expenseCategories.length > 0 ? (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
          {expenseCategories.map((c) => (
            <li key={c.id}>
              <BudgetRow
                categoryId={c.id}
                categoryName={c.name}
                monthlyLimit={limitByCategory.get(c.id)?.limit ?? null}
                period={limitByCategory.get(c.id)?.period ?? "month"}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Nog geen categorieën — die worden aangemaakt zodra je de transactiepagina bezoekt.
        </p>
      )}
    </div>
  );
}
