import { createPot, getPots } from "@/actions/pots";
import { PotRow } from "./pot-row";

export default async function PotsPage() {
  const pots = await getPots();

  const totalBalance = pots.reduce(
    (sum, pot) => sum + pot.pot_entries.reduce((s, e) => s + e.amount, 0),
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Potjes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Virtuele potjes voor vakantie, spaar- en beleggingsdoelen. Totaal opzij gezet:{" "}
          <span className="font-medium text-gray-900">€{totalBalance.toFixed(2)}</span>
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Spaar- en beleggingsrekeningen zijn via de bankkoppeling niet zichtbaar (PSD2
          geeft alleen toegang tot betaalrekeningen), dus inleg en opnames registreer je
          hier zelf.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Nieuw potje</h2>
        <form
          action={createPot}
          className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-4"
        >
          <div className="flex-1 basis-40">
            <label className="mb-1 block text-xs font-medium text-gray-700">Naam</label>
            <input
              type="text"
              name="name"
              required
              placeholder="bv. Vakantie Italië"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Soort</label>
            <select
              name="kind"
              defaultValue="savings"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="savings">Sparen</option>
              <option value="investment">Beleggen</option>
              <option value="vacation">Vakantie</option>
              <option value="other">Overig</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Doelbedrag (optioneel)
            </label>
            <input
              type="number"
              name="targetAmount"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="€"
              className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Aanmaken
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Mijn potjes ({pots.length})
        </h2>
        {pots.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {pots.map((pot) => (
              <PotRow key={pot.id} pot={pot} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Nog geen potjes aangemaakt.</p>
        )}
      </section>
    </div>
  );
}
