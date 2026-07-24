"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReceipt, getReceiptUrl, updateReclaimNote, uploadReceipt } from "@/actions/reclaims";

export function ReclaimNoteReceipt({
  reclaimId,
  note,
  receiptPath,
}: {
  reclaimId: string;
  note: string | null;
  receiptPath: string | null;
}) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(note ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function saveNote() {
    startTransition(async () => {
      await updateReclaimNote(reclaimId, noteValue);
      setIsEditingNote(false);
      router.refresh();
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      await uploadReceipt(reclaimId, formData);
      router.refresh();
    });
  }

  function viewReceipt() {
    startTransition(async () => {
      const url = await getReceiptUrl(receiptPath!);
      window.open(url, "_blank");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {isEditingNote ? (
        <>
          <input
            type="text"
            autoFocus
            value={noteValue}
            disabled={isPending}
            onChange={(e) => setNoteValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveNote();
            }}
            placeholder="Notitie"
            className="w-48 rounded-md border border-gray-300 px-2 py-1 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={saveNote}
            className="font-medium text-gray-900 underline disabled:opacity-50"
          >
            Opslaan
          </button>
        </>
      ) : note ? (
        <button
          type="button"
          onClick={() => setIsEditingNote(true)}
          className="italic text-gray-500 underline decoration-dotted hover:text-gray-700"
        >
          {note}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsEditingNote(true)}
          className="text-gray-400 underline hover:text-gray-600"
        >
          + Notitie
        </button>
      )}

      {receiptPath ? (
        <span className="flex items-center gap-1">
          <button
            type="button"
            disabled={isPending}
            onClick={viewReceipt}
            className="text-blue-700 underline hover:text-blue-900 disabled:opacity-50"
          >
            Bonnetje bekijken
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await deleteReceipt(reclaimId);
                router.refresh();
              });
            }}
            className="text-red-400 underline hover:text-red-600 disabled:opacity-50"
          >
            verwijderen
          </button>
        </span>
      ) : (
        <label className="cursor-pointer text-gray-400 underline hover:text-gray-600">
          + Bonnetje
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            disabled={isPending}
            onChange={handleFileChange}
          />
        </label>
      )}
    </div>
  );
}
