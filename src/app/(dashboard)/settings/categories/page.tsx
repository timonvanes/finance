import { createCategory, getCategories } from "@/actions/transactions";
import { CategoryRow } from "./category-row";

export default async function CategoriesPage() {
  const categories = await getCategories();
  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const incomeCategories = categories.filter((c) => c.kind === "income");

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-gray-900">Categorieën</h1>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Nieuwe categorie
        </h2>
        <form
          action={createCategory}
          className="flex items-end gap-3 rounded-md border border-gray-200 bg-white p-4"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Naam
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="bv. Sportschool"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Type
            </label>
            <select
              name="kind"
              defaultValue="expense"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="expense">Uitgave</option>
              <option value="income">Inkomen</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Toevoegen
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Uitgaven</h2>
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {expenseCategories.map((c) => (
            <li key={c.id} className="flex items-center px-4 py-2 text-sm text-gray-900">
              <CategoryRow categoryId={c.id} name={c.name} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Inkomen</h2>
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {incomeCategories.map((c) => (
            <li key={c.id} className="flex items-center px-4 py-2 text-sm text-gray-900">
              <CategoryRow categoryId={c.id} name={c.name} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
