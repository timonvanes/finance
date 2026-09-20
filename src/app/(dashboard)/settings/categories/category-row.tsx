"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCategory, updateCategoryName } from "@/actions/transactions";

export function CategoryRow({ categoryId, name }: { categoryId: string; name: string }) {
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
          className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-base"
          autoFocus
        />
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await updateCategoryName(categoryId, nameInput);
              setIsEditing(false);
              router.refresh();
            });
          }}
          className="min-h-[44px] px-2 text-sm font-medium text-teal-700"
        >
          Opslaan
        </button>
        <button
          type="button"
          onClick={() => {
            setNameInput(name);
            setIsEditing(false);
          }}
          className="min-h-[44px] px-2 text-sm text-gray-500"
        >
          Annuleren
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-between gap-2">
      <span className="text-gray-900">{name}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="min-h-[44px] px-2 text-sm text-teal-700"
        >
          Wijzigen
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (
              !confirm(
                "Deze categorie verwijderen? Transacties met deze categorie worden weer 'ongecategoriseerd'."
              )
            )
              return;
            startTransition(async () => {
              await deleteCategory(categoryId);
              router.refresh();
            });
          }}
          className="min-h-[44px] px-2 text-sm text-red-500 disabled:opacity-50"
        >
          Verwijderen
        </button>
      </div>
    </div>
  );
}
