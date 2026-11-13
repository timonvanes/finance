"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setNavTabs } from "@/actions/settings";
import { MAX_TABS, NAV_ITEMS, type NavKey } from "@/lib/nav";
import { NavIcon } from "../../nav-icon";

export function MenuForm({ initial, returnsOn }: { initial: NavKey[]; returnsOn: boolean }) {
  const router = useRouter();
  const [bar, setBar] = useState<NavKey[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const items = NAV_ITEMS.filter((i) => returnsOn || i.key !== "returns");
  const rest = items.filter((i) => !bar.includes(i.key));
  const label = (k: NavKey) => NAV_ITEMS.find((i) => i.key === k)!.label;

  async function save(next: NavKey[]) {
    setBar(next);
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await setNavTabs(next);
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt.");
      setBar(initial);
    } finally {
      setBusy(false);
    }
  }

  const add = (k: NavKey) => {
    if (bar.length >= MAX_TABS) {
      setError(`Er passen ${MAX_TABS} onderdelen in de balk. Haal er eerst een weg.`);
      return;
    }
    void save([...bar, k]);
  };
  const remove = (k: NavKey) => {
    if (bar.length <= 1) {
      setError("Er moet minstens één onderdeel in de balk staan.");
      return;
    }
    void save(bar.filter((b) => b !== k));
  };
  const move = (k: NavKey, dir: -1 | 1) => {
    const i = bar.indexOf(k);
    const j = i + dir;
    if (j < 0 || j >= bar.length) return;
    const next = [...bar];
    [next[i], next[j]] = [next[j], next[i]];
    void save(next);
  };

  const row = "flex min-h-[60px] items-center gap-3 px-4 py-2";
  const icon = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700";
  const small = "flex h-11 w-11 items-center justify-center rounded-full text-lg text-gray-600 active:bg-gray-100 disabled:opacity-30";

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-gray-500">
          Onderin de balk ({bar.length} van {MAX_TABS})
        </h2>
        <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
          {bar.map((k, i) => (
            <li key={k} className="border-b border-gray-100 last:border-b-0">
              <div className={row}>
                <span className={icon}>
                  <NavIcon name={k} size={22} />
                </span>
                <span className="min-w-0 flex-1 text-base text-gray-900">{label(k)}</span>
                <button type="button" aria-label="Omhoog" disabled={busy || i === 0} onClick={() => move(k, -1)} className={small}>
                  ↑
                </button>
                <button type="button" aria-label="Omlaag" disabled={busy || i === bar.length - 1} onClick={() => move(k, 1)} className={small}>
                  ↓
                </button>
                <button type="button" disabled={busy} onClick={() => remove(k)} className="min-h-[44px] px-2 text-sm text-red-600 disabled:opacity-40">
                  Weg
                </button>
              </div>
            </li>
          ))}
          <li className="bg-gray-50 px-4 py-3 text-sm text-gray-500">Daarna komt altijd Meer.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-gray-500">Onder Meer</h2>
        <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
          {rest.length === 0 && <li className="px-4 py-4 text-sm text-gray-500">Alles staat onderin.</li>}
          {rest.map((i) => (
            <li key={i.key} className="border-b border-gray-100 last:border-b-0">
              <div className={row}>
                <span className={icon}>
                  <NavIcon name={i.key} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base text-gray-900">{i.label}</span>
                  <span className="block text-xs text-gray-500">{i.hint}</span>
                </span>
                <button type="button" disabled={busy} onClick={() => add(i.key)} className="min-h-[44px] px-2 text-sm font-medium text-teal-700 disabled:opacity-40">
                  Onderin zetten
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {saved && !error && <p className="px-1 text-sm text-green-700">Opgeslagen. De balk onderin is aangepast.</p>}
    </div>
  );
}
