"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTransactionNote } from "@/actions/transactions";

export function TransactionNote({
  transactionId,
  note,
}: {
  transactionId: string;
  note: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      await updateTransactionNote(transactionId, value);
      setIsEditing(false);
      router.refresh();
    });
  }

  if (!isEditing) {
    return note ? (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="text-left text-xs italic text-gray-500 underline decoration-dotted hover:text-gray-700"
      >
        {note}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="text-xs text-gray-400 underline hover:text-gray-600"
      >
        + Notitie toevoegen
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        autoFocus
        value={value}
        disabled={isPending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        placeholder="Waar ging dit over?"
        className="w-56 rounded-md border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
      />
      <button
        type="button"
        disabled={isPending}
        onClick={save}
        className="text-xs font-medium text-gray-900 underline disabled:opacity-50"
      >
        Opslaan
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(note ?? "");
          setIsEditing(false);
        }}
        className="text-xs text-gray-400 underline"
      >
        Annuleren
      </button>
    </div>
  );
}
