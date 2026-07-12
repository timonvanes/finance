"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePerson, updatePersonGroup } from "@/actions/people";

interface Group {
  id: string;
  name: string;
}

export function PersonRow({
  personId,
  personGroupId,
  groups,
}: {
  personId: string;
  personGroupId: string | null;
  groups: Group[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
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
  );
}
