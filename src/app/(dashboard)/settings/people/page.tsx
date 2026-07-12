import { createPerson, getPeople } from "@/actions/people";

export default async function PeoplePage() {
  const people = await getPeople();

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-gray-900">Personen</h1>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Nieuw persoon
        </h2>
        <form
          action={createPerson}
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
              placeholder="bv. Sanne"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
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
        <h2 className="mb-2 text-sm font-medium text-gray-700">Overzicht</h2>
        {people.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {people.map((p) => (
              <li key={p.id} className="px-4 py-2 text-sm text-gray-900">
                {p.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            Nog niemand toegevoegd. Voeg hierboven iemand toe zodat je 'm bij
            terugvorderingen kunt aanvinken.
          </p>
        )}
      </section>
    </div>
  );
}
