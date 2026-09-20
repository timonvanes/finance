import Link from "next/link";
import { createCategory, getCategories } from "@/actions/transactions";
import { CategoryRow } from "./category-row";

export default async function CategoriesPage() {
  const categories = await getCategories();
  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const incomeCategories = categories.filter((c) => c.kind === "income");

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
        <h1 className="text-2xl font-semibold text-gray-900">Categorieën</h1>
      </div>

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">
          Nieuwe categorie
        </h2>
        <form
          action={createCategory}
          className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200"
        >
          <div className="flex-1">
            <label className="mb-1 block text-sm text-gray-500">
              Naam
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="bv. Sportschool"
              className="min-h-[52px] w-full rounded-xl border border-gray-300 px-4 text-base"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">
              Type
            </label>
            <select
              name="kind"
              defaultValue="expense"
              className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-4 text-base"
            >
              <option value="expense">Uitgave</option>
              <option value="income">Inkomen</option>
            </select>
          </div>
          <button
            type="submit"
            className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800"
          >
            Toevoegen
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">Uitgaven</h2>
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
          {expenseCategories.map((c) => (
            <li key={c.id} className="flex min-h-[60px] items-center px-5 py-2 text-base text-gray-900">
              <CategoryRow categoryId={c.id} name={c.name} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">Inkomen</h2>
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
          {incomeCategories.map((c) => (
            <li key={c.id} className="flex min-h-[60px] items-center px-5 py-2 text-base text-gray-900">
              <CategoryRow categoryId={c.id} name={c.name} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
