import Link from "next/link";
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
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Personen</h1>
      </div>

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">Groepen</h2>
        <form
          action={createPersonGroup}
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
              placeholder="bv. Vrienden, Familie, Sportclub"
              className="min-h-[52px] w-full rounded-xl border border-gray-300 px-4 text-base"
            />
          </div>
          <button
            type="submit"
            className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800"
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
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">
          Nieuw persoon
        </h2>
        <form
          action={createPerson}
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
              placeholder="bv. Sanne"
              className="min-h-[52px] w-full rounded-xl border border-gray-300 px-4 text-base"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">
              Groep
            </label>
            <select
              name="personGroupId"
              defaultValue=""
              className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-4 text-base"
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
            className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800"
          >
            Toevoegen
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">Overzicht</h2>
        {people.length > 0 ? (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {people.map((p) => (
              <li key={p.id} className="flex min-h-[60px] items-center gap-3 px-5 py-2 text-base">
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
          <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
            Nog niemand toegevoegd. Voeg hierboven iemand toe zodat je 'm bij
            terugvorderingen kunt aanvinken.
          </p>
        )}
      </section>
    </div>
  );
}
