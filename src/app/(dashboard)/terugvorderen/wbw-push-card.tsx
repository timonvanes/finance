"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadWbwListMembers, pushStoredWbw, pushWbwExpense } from "@/actions/wbw-push";
import type { WbwAssignment, WbwMemberChoice } from "@/actions/wbw-push";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

// Puts the open WieBetaaltWat reclaims of ONE payment into WieBetaaltWat as one
// expense. When the list and the people were chosen while making the reclaim it
// is one tap; otherwise pick the list and check who is who here. You paid the
// whole bill, each chosen person gets their share, the rest stays yours.
export function WbwPushCard({
  reclaims,
  total,
  defaultName,
  lists,
  storedListId,
}: {
  reclaims: { id: string; personName: string; amount: number }[];
  total: number | null;
  defaultName: string;
  lists: { id: string; name: string }[];
  // Set when every reclaim already has its list and member.
  storedListId: string | null;
}) {
  const router = useRouter();
  const [listId, setListId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [members, setMembers] = useState<WbwMemberChoice[] | null>(null);
  const [rows, setRows] = useState<(WbwAssignment & { memberId: string })[]>([]);
  const [desc, setDesc] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function chooseList(id: string) {
    setListId(id);
    setMembers(null);
    setRows([]);
    setError(null);
    if (!id) return;
    setLoading(true);
    try {
      const r = await loadWbwListMembers(
        id,
        reclaims.map((x) => x.id)
      );
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setMembers(r.members);
      setRows(r.assignments.map((a) => ({ ...a, memberId: a.suggestedMemberId ?? "" })));
    } catch {
      setError("Deelnemers ophalen mislukt. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  const stored = storedListId != null;
  const effectiveListId = stored ? storedListId : listId;
  const listName = lists.find((l) => l.id === effectiveListId)?.name ?? "";
  const chosen = stored ? reclaims.map((r) => ({ reclaimId: r.id, personName: r.personName, cents: Math.round(r.amount * 100) })) : rows.filter((r) => r.memberId);
  const othersTotal = chosen.reduce((s, r) => s + r.cents, 0) / 100;
  const mine = total != null ? Math.max(0, total - othersTotal) : null;

  async function push() {
    if (chosen.length === 0) return;
    const text =
      `Dit maakt in WieBetaaltWat (lijst "${listName}") een uitgave aan "${desc.trim() || defaultName}", door jou betaald, met ` +
      `${chosen.map((r) => `${r.personName} ${euro(r.cents / 100)}`).join(", ")}. ` +
      `Je kunt dit niet vanaf hier ongedaan maken. Doorgaan?`;
    if (!confirm(text)) return;
    setPushing(true);
    setError(null);
    try {
      const r = stored
        ? await pushStoredWbw(
            reclaims.map((x) => x.id),
            desc.trim() || undefined
          )
        : await pushWbwExpense(
            listId,
            rows.filter((x) => x.memberId).map((c) => ({ reclaimId: c.reclaimId, memberId: c.memberId })),
            desc.trim() || undefined
          );
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setDone(`Staat nu in WieBetaaltWat (lijst ${r.listName}). De terugvorderingen zijn afgevinkt.`);
      setTimeout(() => router.refresh(), 2500);
    } catch {
      setError("Aanmaken mislukt. Controleer in WieBetaaltWat of de uitgave er al staat voordat je het opnieuw probeert.");
    } finally {
      setPushing(false);
    }
  }

  if (lists.length === 0 && !stored) return null;

  const descriptionField = (
    <label className="block space-y-1">
      <span className="text-sm text-gray-500">Omschrijving in WieBetaaltWat</span>
      <input
        type="text"
        value={desc}
        disabled={pushing}
        onChange={(e) => setDesc(e.target.value)}
        placeholder={defaultName || "Omschrijving"}
        className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base disabled:opacity-50"
      />
    </label>
  );

  return (
    <div className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div>
        <p className="text-base font-medium text-gray-900">Zet in WieBetaaltWat</p>
        <p className="text-sm text-gray-500">
          {stored
            ? `Staat klaar voor lijst ${listName || "…"}. De deelnemers zijn al gekozen.`
            : "Maakt één uitgave aan in een lijst naar keuze en zet de verdeling erin."}
        </p>
      </div>

      {done ? (
        <p className="text-base text-teal-700">{done}</p>
      ) : stored ? (
        <div className="space-y-3">
          <ul className="space-y-1">
            {chosen.map((r) => (
              <li key={r.reclaimId} className="flex items-center justify-between gap-3 text-base text-gray-900">
                <span className="min-w-0 truncate">{r.personName}</span>
                <span className="shrink-0 font-medium">{euro(r.cents / 100)}</span>
              </li>
            ))}
          </ul>
          {descriptionField}
          <button
            type="button"
            disabled={pushing}
            onClick={() => void push()}
            className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
          >
            {pushing ? "Bezig…" : "Zet in WieBetaaltWat"}
          </button>
        </div>
      ) : (
        <>
          <select
            value={listId}
            disabled={loading || pushing}
            onChange={(e) => void chooseList(e.target.value)}
            className="min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 disabled:opacity-50"
          >
            <option value="">Kies een lijst…</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          {loading && <p className="text-sm text-gray-500">Deelnemers ophalen…</p>}

          {members && (
            <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={r.reclaimId} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-base text-gray-900">
                    <span className="min-w-0 truncate">{r.personName}</span>
                    <span className="shrink-0 font-medium">{euro(r.cents / 100)}</span>
                  </div>
                  <select
                    value={r.memberId}
                    disabled={pushing}
                    onChange={(e) =>
                      setRows((prev) => prev.map((x, j) => (j === i ? { ...x, memberId: e.target.value } : x)))
                    }
                    className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 disabled:opacity-50"
                  >
                    <option value="">Niet aanslaan</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {!r.memberId && r.suggestedMemberId === null && (
                    <p className="text-sm text-gray-500">Geen deelnemer met deze naam gevonden: kies er een, of laat leeg.</p>
                  )}
                </div>
              ))}

              {descriptionField}

              <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {total != null && <>Totaal {euro(total)} · </>}
                aangeslagen {euro(othersTotal)}
                {mine != null && <> · jouw deel {euro(mine)}</>}
              </p>

              <button
                type="button"
                disabled={pushing || chosen.length === 0}
                onClick={() => void push()}
                className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
              >
                {pushing ? "Bezig…" : "Zet in WieBetaaltWat"}
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
