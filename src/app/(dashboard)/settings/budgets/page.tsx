import { getCategories } from "@/actions/transactions";
import { getBudgets } from "@/actions/budgets";
import { BudgetRow } from "./budget-row";

export default async function BudgetsPage() {
  const [categories, budgets] = await Promise.all([getCategories(), getBudgets()]);

  const limitByCategory = new Map(budgets.map((b) => [b.category_id, b.monthly_limit]));
  const expenseCategories = categories.filter((c) => c.kind !== "income");
  const totalBudget = budgets.reduce((sum, b) => sum + b.monthly_limit, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Budgetdoelen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Stel per categorie een maandbudget in — op het overzicht zie je hoe je ervoor
          staat, met een waarschuwing als je sneller uitgeeft dan de maand vordert.
        </p>
        {budgets.length > 0 && (
          <p className="mt-2 text-sm text-gray-700">
            Totaal ingesteld:{" "}
            <span className="font-semibold text-gray-900">€{totalBudget.toFixed(2)}</span>
            <span className="text-gray-400"> / maand</span>{" "}
            <span className="text-xs text-gray-400">
              (over {budgets.length} {budgets.length === 1 ? "categorie" : "categorieën"})
            </span>
          </p>
        )}
      </div>

      {expenseCategories.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {expenseCategories.map((c) => (
            <li key={c.id} className="flex items-center px-4 py-2">
              <BudgetRow
                categoryId={c.id}
                categoryName={c.name}
                monthlyLimit={limitByCategory.get(c.id) ?? null}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">
          Nog geen categorieën — die worden aangemaakt zodra je de transactiepagina bezoekt.
        </p>
      )}
    </div>
  );
}
