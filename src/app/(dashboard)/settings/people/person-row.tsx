"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePerson, updatePersonGroup, updatePersonName } from "@/actions/people";

interface Group {
  id: string;
  name: string;
}

export function PersonRow({
  personId,
  name,
  personGroupId,
  groups,
}: {
  personId: string;
  name: string;
  personGroupId: string | null;
  groups: Group[];
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(name);
  const router = useRouter();

  if (isEditing) {
    return (
      <div className="flex flex-1 items-center gap-2">
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          autoFocus
        />
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await updatePersonName(personId, nameInput);
              setIsEditing(false);
              router.refresh();
            });
          }}
          className="text-xs font-medium text-gray-900 underline"
        >
          Opslaan
        </button>
        <button
          type="button"
          onClick={() => {
            setNameInput(name);
            setIsEditing(false);
          }}
          className="text-xs text-gray-400 underline"
        >
          Annuleren
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-between gap-2">
      <span className="text-gray-900">{name}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          Naam wijzigen
        </button>
        <select
          disabled={isPending}
          defaultValue={personGroupId ?? ""}
          onChange={(e) => {
            startTransition(async () => {
              await updatePersonGroup(personId, e.target.value || null);
              router.refresh();
            });
          }}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
        >
          <option value="">Geen groep</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Deze persoon verwijderen?")) return;
            startTransition(async () => {
              try {
                await deletePerson(personId);
                router.refresh();
              } catch (e) {
                alert(e instanceof Error ? e.message : "Verwijderen mislukt");
              }
            });
          }}
          className="text-xs text-red-400 underline hover:text-red-600 disabled:opacity-50"
        >
          Verwijderen
        </button>
      </div>
    </div>
  );
}
