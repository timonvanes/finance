"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSplitReclaim } from "@/actions/reclaims";
import { createGuest } from "@/actions/people";
import { getWbwMembersForList, pushStoredWbw } from "@/actions/wbw-push";
import type { WbwMemberChoice } from "@/actions/wbw-push";
import { normName } from "@/lib/wbw/match";
import { TxDetails } from "../tx-details";

interface Tx {
  id: string;
  booking_date: string;
  amount: number;
  counterparty_name: string | null;
  raw_description: string | null;
  counterparty_iban: string | null;
}
interface Person {
  id: string;
  name: string;
  isSelf: boolean;
  groupName: string | null;
}

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export function Wizard({
  transactions,
  people: savedPeople,
  initialTransactionId,
  wbwLists,
  wbwConfigured,
}: {
  transactions: Tx[];
  people: Person[];
  initialTransactionId?: string;
  wbwLists: { id: string; name: string }[];
  wbwConfigured: boolean;
}) {
  const [guests, setGuests] = useState<Person[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestError, setGuestError] = useState<string | null>(null);
  const knownPeople = [...savedPeople, ...guests.filter((g) => !savedPeople.some((p) => p.id === g.id))];
  const [step, setStep] = useState(initialTransactionId ? 2 : 1);
  const [selectedTx, setSelectedTx] = useState<Record<string, boolean>>(
    initialTransactionId ? { [initialTransactionId]: true } : {}
  );
  const [filter, setFilter] = useState("");
  const [shares, setShares] = useState<Record<string, number>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<"bank" | "external_app">("bank");
  const [note, setNote] = useState("");
  const [sharedCode, setSharedCode] = useState(false);
  // WieBetaaltWat: pick the list up front and split over its members right away,
  // so nothing has to be entered twice. Needs the link with WieBetaaltWat.
  const wbwActive = method === "external_app" && wbwConfigured && wbwLists.length > 0;
  const [wbwListId, setWbwListId] = useState("");
  const [wbwMembers, setWbwMembers] = useState<WbwMemberChoice[] | null>(null);
  const [wbwLoading, setWbwLoading] = useState(false);
  const [wbwError, setWbwError] = useState<string | null>(null);
  const [pushNow, setPushNow] = useState(true);
  const [combine, setCombine] = useState(true);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const total = transactions
    .filter((t) => selectedTx[t.id])
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const txCount = Object.values(selectedTx).filter(Boolean).length;

  // With WieBetaaltWat the people are the members of the chosen list; a member
  // you already have as a person (same full name or nickname) is that person,
  // anyone else becomes a one-off guest when the reclaim is made.
  const wbwListName = wbwLists.find((l) => l.id === wbwListId)?.name ?? null;
  const selfPerson = savedPeople.find((p) => p.isSelf);
  const memberByKey = new Map<string, WbwMemberChoice>();
  const wbwPeople: Person[] = (wbwMembers ?? []).map((m) => {
    const known = knownPeople.find(
      (p) => !p.isSelf && [normName(m.name), normName(m.nickname)].includes(normName(p.name))
    );
    const key = known?.id ?? `m:${m.id}`;
    memberByKey.set(key, m);
    return { id: key, name: m.name, isSelf: false, groupName: wbwListName };
  });
  const people: Person[] = wbwActive ? [...(selfPerson ? [selfPerson] : []), ...wbwPeople] : knownPeople;

  const checkedIds = people.filter((p) => (shares[p.id] ?? 0) > 0).map((p) => p.id);
  // Amounts typed by hand stay fixed; the rest is divided over the remaining
  // people by their number of shares (WBW-style "Aandelen").
  const fixedIds = checkedIds.filter((id) => typed[id] !== undefined);
  const flexIds = checkedIds.filter((id) => typed[id] === undefined);
  const fixedSum = fixedIds.reduce((s, id) => s + (Number(typed[id]) || 0), 0);
  const flexShares = flexIds.reduce((s, id) => s + (shares[id] ?? 0), 0);
  const rest = Math.max(total - fixedSum, 0);
  const amountFor = (id: string) => {
    if ((shares[id] ?? 0) <= 0) return 0;
    if (typed[id] !== undefined) return Number(typed[id]) || 0;
    return flexShares > 0 ? (rest * (shares[id] ?? 0)) / flexShares : 0;
  };
  const entered = checkedIds.reduce((s, id) => s + amountFor(id), 0);
  const othersEntered = checkedIds
    .filter((id) => !people.find((p) => p.id === id)?.isSelf)
    .reduce((s, id) => s + amountFor(id), 0);
  const othersChecked = people.some((p) => (shares[p.id] ?? 0) > 0 && !p.isSelf);
  const selectedTransactions = transactions.filter((t) => selectedTx[t.id]);

  const filtered = filter
    ? transactions.filter((t) =>
        (t.counterparty_name ?? "").toLowerCase().includes(filter.toLowerCase())
      )
    : transactions;

  function changeShares(id: string, delta: number) {
    const next = Math.max((shares[id] ?? 0) + delta, 0);
    setShares((prev) => ({ ...prev, [id]: next }));
    if (next === 0) {
      setTyped((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  }

  function addGuest() {
    setGuestError(null);
    startTransition(async () => {
      const r = await createGuest(guestName);
      if ("error" in r) {
        setGuestError(r.error);
        return;
      }
      setGuests((prev) => (prev.some((g) => g.id === r.id) ? prev : [...prev, { id: r.id, name: r.name, isSelf: false, groupName: "Gast" }]));
      setShares((prev) => ({ ...prev, [r.id]: 1 }));
      setGuestName("");
    });
  }

  // What the WieBetaaltWat expense will be called: the note, or else the shop.
  const defaultDescription = (() => {
    const names = [...new Set(selectedTransactions.map((t) => t.counterparty_name?.trim()).filter(Boolean) as string[])];
    return names.slice(0, 3).join(" + ");
  })();

  function chooseMethod(next: "bank" | "external_app") {
    setMethod(next);
    setShares({});
    setTyped({});
    setError(null);
  }

  async function chooseList(id: string) {
    setWbwListId(id);
    setWbwMembers(null);
    setShares({});
    setTyped({});
    setWbwError(null);
    if (!id) return;
    setWbwLoading(true);
    try {
      const r = await getWbwMembersForList(id);
      if ("error" in r) {
        setWbwError(r.error);
        return;
      }
      setWbwMembers(r.members);
    } catch {
      setWbwError("Deelnemers ophalen mislukt. Probeer het opnieuw.");
    } finally {
      setWbwLoading(false);
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        transactions.filter((t) => selectedTx[t.id]).forEach((t) => fd.append("transactionId", t.id));
        for (const key of checkedIds) {
          let personId = key;
          const member = wbwActive ? memberByKey.get(key) : undefined;
          if (member && key.startsWith("m:")) {
            // Someone from the list who is not one of your people yet: a one-off guest.
            const g = await createGuest(member.name);
            if ("error" in g) {
              setError(g.error);
              return;
            }
            personId = g.id;
          }
          fd.append("personId", personId);
          fd.set(`amount_${personId}`, amountFor(key).toFixed(2));
          if (member) fd.set(`wbwMember_${personId}`, member.id);
        }
        fd.set("settlementMethod", method);
        fd.set("tikkieLink", wbwActive ? note.trim() || defaultDescription : note);
        if (sharedCode && checkedIds.length > 1) fd.set("sharedCode", "on");
        if (wbwActive) {
          fd.set("wbwListId", wbwListId);
          if (txCount > 1 && combine) fd.set("wbwGroup", "on");
        }

        const result = await createSplitReclaim(fd);
        if (wbwActive && pushNow && result.reclaimIds.length > 0) {
          const pushed = await pushStoredWbw(result.reclaimIds);
          if ("error" in pushed) {
            setCreated(true);
            setError(`De terugvordering staat klaar, maar doorvoeren naar WieBetaaltWat lukte niet: ${pushed.error} Je kunt het later doorvoeren.`);
            return;
          }
        }
        router.push("/terugvorderen");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
      }
    });
  }

  // You first, then people per group (with a "hele groep" shortcut each).
  const sections = (() => {
    const result: { name: string | null; people: Person[] }[] = [];
    const self = people.filter((p) => p.isSelf);
    if (self.length > 0) result.push({ name: null, people: self });
    const byGroup = new Map<string, Person[]>();
    for (const p of people.filter((x) => !x.isSelf)) {
      const key = p.groupName ?? "Overig";
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(p);
    }
    [...byGroup.entries()]
      .sort(([a], [b]) => (a === "Overig" ? 1 : b === "Overig" ? -1 : a.localeCompare(b)))
      .forEach(([name, list]) => result.push({ name, people: list }));
    return result;
  })();

  function setGroupShares(list: Person[], count: number) {
    setShares((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.id, count])) }));
    if (count === 0) {
      setTyped((prev) => {
        const copy = { ...prev };
        list.forEach((p) => delete copy[p.id]);
        return copy;
      });
    }
  }

  const renderPerson = (p: Person) => {
      const count = shares[p.id] ?? 0;
      const active = count > 0;
      return (
        <li key={p.id} className="flex min-h-[60px] items-center gap-2">
          <span
            className={`min-w-0 flex-1 truncate text-base ${active ? "font-medium text-gray-900" : "text-gray-400"}`}
          >
            {p.isSelf ? "Jij" : p.name}
          </span>
          <div className="flex shrink-0 items-center overflow-hidden rounded-xl bg-gray-100">
            <button
              type="button"
              aria-label={`Minder aandelen voor ${p.name}`}
              disabled={!active}
              onClick={() => changeShares(p.id, -1)}
              className="flex h-12 w-11 items-center justify-center text-xl text-gray-700 disabled:opacity-30"
            >
              −
            </button>
            <span className={`w-10 text-center text-base ${active ? "text-gray-900" : "text-gray-400"}`}>
              {count}x
            </span>
            <button
              type="button"
              aria-label={`Meer aandelen voor ${p.name}`}
              onClick={() => changeShares(p.id, 1)}
              className="flex h-12 w-11 items-center justify-center text-xl text-blue-600"
            >
              +
            </button>
          </div>
          <div className="flex h-12 w-28 shrink-0 items-center gap-1 rounded-xl bg-gray-100 px-3">
            <span className="text-gray-400">€</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              disabled={!active}
              value={active ? (typed[p.id] ?? amountFor(p.id).toFixed(2)) : ""}
              placeholder="0,00"
              onChange={(e) => setTyped((prev) => ({ ...prev, [p.id]: e.target.value }))}
              className="w-full bg-transparent text-right text-base text-gray-900 outline-none disabled:text-gray-400"
            />
          </div>
        </li>
      );
  };

  const primary =
    "min-h-[56px] w-full rounded-2xl bg-gray-900 text-lg font-medium text-white active:bg-gray-700 disabled:opacity-40";
  const secondary =
    "min-h-[52px] w-full rounded-2xl text-base text-gray-600 active:bg-gray-100";

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Stap {step} van 3</p>

      {step === 1 && (
        <>
          <h2 className="text-xl font-semibold text-gray-900">Welke afschrijvingen?</h2>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Zoek op naam…"
            className="min-h-[52px] w-full rounded-2xl border border-gray-300 px-4 text-base"
          />
          <ul className="space-y-2">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedTx((p) => ({ ...p, [t.id]: !p[t.id] }))}
                  className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 ${
                    selectedTx[t.id] ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-900 ring-gray-200"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium">
                      {t.counterparty_name ?? "Onbekend"}
                    </span>
                    <span className={`block text-sm ${selectedTx[t.id] ? "text-gray-300" : "text-gray-500"}`}>
                      {new Date(t.booking_date).toLocaleDateString("nl-NL")}
                    </span>
                  </span>
                  <span className="text-base font-semibold">{euro(Math.abs(t.amount))}</span>
                </button>
                <TxDetails
                  label="Details"
                  tx={{
                    name: t.counterparty_name,
                    date: t.booking_date,
                    amount: t.amount,
                    description: t.raw_description,
                    iban: t.counterparty_iban,
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="sticky bottom-0 space-y-2 bg-gray-50 pb-3 pt-2">
            {txCount > 0 && (
              <p className="text-center text-base text-gray-700">
                {txCount} geselecteerd · totaal <span className="font-semibold">{euro(total)}</span>
              </p>
            )}
            <button type="button" disabled={txCount === 0} onClick={() => setStep(2)} className={primary}>
              Verder
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <ul className="space-y-2">
            {selectedTransactions.map((t) => (
              <li key={t.id} className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-gray-900">
                      {t.counterparty_name ?? "Onbekend"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(t.booking_date).toLocaleDateString("nl-NL")}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-semibold text-gray-900">{euro(Math.abs(t.amount))}</p>
                </div>
                <TxDetails
                  tx={{
                    name: t.counterparty_name,
                    date: t.booking_date,
                    amount: t.amount,
                    description: t.raw_description,
                    iban: t.counterparty_iban,
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between rounded-2xl bg-white px-5 py-4 ring-1 ring-gray-200">
            <span className="text-sm text-gray-500">Totaal</span>
            <span className="text-3xl font-semibold text-gray-900">{euro(total)}</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">Hoe komt dit terug?</h2>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["bank", "Bank of Tikkie"],
                  ["external_app", "WieBetaaltWat"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseMethod(value)}
                  className={`min-h-[52px] rounded-2xl px-3 text-base font-medium ring-1 ${
                    method === value ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-900 ring-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {method === "bank" && (
              <p className="px-1 text-sm text-gray-500">Wordt automatisch herkend als de betaling binnenkomt.</p>
            )}
            {method === "external_app" && !wbwActive && (
              <p className="px-1 text-sm text-gray-500">
                Je vinkt het zelf af als het in WieBetaaltWat staat. Lees eerst je saldo in (Terugvorderen, kaart
                WieBetaaltWat) om hier een lijst te kunnen kiezen.
              </p>
            )}
            {wbwActive && (
              <>
                <select
                  value={wbwListId}
                  disabled={wbwLoading || isPending}
                  onChange={(e) => void chooseList(e.target.value)}
                  className="min-h-[52px] w-full rounded-2xl border border-gray-300 bg-white px-4 text-base text-gray-900 disabled:opacity-50"
                >
                  <option value="">Kies een WieBetaaltWat-lijst…</option>
                  {wbwLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                {wbwLoading && <p className="px-1 text-sm text-gray-500">Deelnemers ophalen…</p>}
                {wbwError && <p className="px-1 text-sm text-red-600">{wbwError}</p>}
                {!wbwListId && <p className="px-1 text-sm text-gray-500">Kies eerst de lijst, dan verdeel je over de mensen daarin.</p>}
              </>
            )}
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Verdeel ({checkedIds.length})</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShares(Object.fromEntries(people.map((p) => [p.id, 1])))}
                className="min-h-[44px] rounded-xl bg-gray-100 px-4 text-sm font-medium text-gray-700"
              >
                Iedereen
              </button>
              <button
                type="button"
                onClick={() => {
                  setShares({});
                  setTyped({});
                }}
                className="min-h-[44px] rounded-xl bg-gray-100 px-4 text-sm font-medium text-blue-600"
              >
                Wissen
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {sections.map((section) => (
              <section key={section.name ?? "self"} className="space-y-1">
                {section.name && (
                  <div className="flex items-center justify-between pt-1">
                    <h3 className="text-sm font-medium text-gray-500">{section.name}</h3>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setGroupShares(section.people, 1)}
                        className="min-h-[44px] rounded-xl bg-gray-100 px-3 text-sm font-medium text-gray-700 active:bg-gray-200"
                      >
                        Hele groep
                      </button>
                      <button
                        type="button"
                        onClick={() => setGroupShares(section.people, 0)}
                        className="min-h-[44px] px-3 text-sm text-blue-600"
                      >
                        Wissen
                      </button>
                    </div>
                  </div>
                )}
                <ul className="space-y-2">{section.people.map(renderPerson)}</ul>
              </section>
            ))}
          </div>

          {!wbwActive && (
          <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-700">Gast (eenmalig, komt niet in je mensen)</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Naam"
                className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-base"
              />
              <button
                type="button"
                disabled={isPending || !guestName.trim()}
                onClick={addGuest}
                className="min-h-[48px] rounded-xl bg-gray-900 px-4 text-base font-medium text-white active:bg-gray-700 disabled:opacity-40"
              >
                Toevoegen
              </button>
            </div>
            {guestError && <p className="text-sm text-red-600">{guestError}</p>}
          </div>
          )}

          {checkedIds.length > 0 && Math.abs(total - entered) > 0.01 && (
            <p className="text-center text-sm text-amber-700">
              {total > entered ? `Nog ${euro(total - entered)} te verdelen` : `${euro(entered - total)} te veel verdeeld`}
            </p>
          )}

          <div className="sticky bottom-0 space-y-1 bg-gray-50 pb-3 pt-2">
            <button type="button" disabled={!othersChecked} onClick={() => setStep(3)} className={primary}>
              Verder
            </button>
            <button type="button" onClick={() => setStep(1)} className={secondary}>
              Terug
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="text-xl font-semibold text-gray-900">Afronden</h2>

          {wbwActive ? (
            <>
              <div className="space-y-1 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
                <p className="text-sm text-gray-500">In WieBetaaltWat, lijst {wbwListName}</p>
                <p className="text-base text-gray-900">Totaal {euro(total)} door jou betaald</p>
                <ul className="text-base text-gray-700">
                  {checkedIds
                    .filter((id) => !people.find((p) => p.id === id)?.isSelf)
                    .map((id) => (
                      <li key={id} className="flex justify-between gap-3">
                        <span className="truncate">{people.find((p) => p.id === id)?.name}</span>
                        <span className="shrink-0 font-medium">{euro(amountFor(id))}</span>
                      </li>
                    ))}
                </ul>
                <p className="text-sm text-gray-500">Rest voor jou: {euro(Math.max(0, total - othersEntered))}</p>
              </div>

              <label className="block space-y-1">
                <span className="text-sm text-gray-500">Omschrijving in WieBetaaltWat</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={defaultDescription || "Omschrijving"}
                  className="min-h-[52px] w-full rounded-2xl border border-gray-300 px-4 text-base"
                />
              </label>

              {txCount > 1 && (
                <label className="flex min-h-[52px] items-center gap-3 text-base text-gray-700">
                  <input type="checkbox" checked={combine} onChange={(e) => setCombine(e.target.checked)} className="h-6 w-6" />
                  Combineer tot één uitgave in WieBetaaltWat
                </label>
              )}

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    [true, "Nu doorvoeren"],
                    [false, "Later doorvoeren"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setPushNow(value)}
                    className={`min-h-[52px] rounded-2xl px-3 text-base font-medium ring-1 ${
                      pushNow === value ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-900 ring-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="px-1 text-sm text-gray-500">
                {pushNow
                  ? "De uitgave komt direct in WieBetaaltWat en de terugvordering wordt afgevinkt."
                  : "De lijst en deelnemers worden onthouden. Je voert het later met één tik door."}
              </p>
            </>
          ) : (
            <>
              {method === "external_app" && (
                <p className="rounded-2xl bg-amber-50 p-4 text-base text-amber-900 ring-1 ring-amber-200">
                  Voer {euro(total)} in bij WieBetaaltWat.
                </p>
              )}

              {method === "bank" && checkedIds.filter((id) => !people.find((p) => p.id === id)?.isSelf).length > 1 && (
                <label className="flex min-h-[52px] items-center gap-3 text-base text-gray-700">
                  <input type="checkbox" checked={sharedCode} onChange={(e) => setSharedCode(e.target.checked)} className="h-6 w-6" />
                  Zelfde code voor iedereen
                </label>
              )}

              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Notitie (optioneel)"
                className="min-h-[52px] w-full rounded-2xl border border-gray-300 px-4 text-base"
              />
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="sticky bottom-0 space-y-1 bg-gray-50 pb-3 pt-2">
            {created ? (
              <button type="button" onClick={() => router.push("/terugvorderen")} className={primary}>
                Naar terugvorderen
              </button>
            ) : (
              <button type="button" disabled={isPending} onClick={submit} className={primary}>
                {isPending ? "Bezig…" : wbwActive && pushNow ? "Toevoegen en doorvoeren" : "Toevoegen"}
              </button>
            )}
            {!created && (
              <button type="button" onClick={() => setStep(2)} className={secondary}>
                Terug
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
