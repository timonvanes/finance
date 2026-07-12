import {
  createPerson,
  createPersonGroup,
  getPeopleWithGroups,
  getPersonGroups,
} from "@/actions/people";
import { PersonRow } from "./person-row";

export default async function PeoplePage() {
  const [people, groups] = await Promise.all([getPeopleWithGroups(), getPersonGroups()]);

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-gray-900">Personen</h1>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Groepen</h2>
        <form
          action={createPersonGroup}
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
              placeholder="bv. Vrienden, Familie, Sportclub"
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
        {groups.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            Bestaande groepen: {groups.map((g) => g.name).join(", ")}
          </p>
        )}
      </section>

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
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Groep
            </label>
            <select
              name="personGroupId"
              defaultValue=""
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Geen groep</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
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
        <h2 className="mb-2 text-sm font-medium text-gray-700">Overzicht</h2>
        {people.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <PersonRow
                  personId={p.id}
                  name={p.name}
                  personGroupId={p.person_group_id}
                  isSelf={p.is_self}
                  groups={groups}
                />
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
