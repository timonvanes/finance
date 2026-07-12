"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTransactionCategory } from "@/actions/transactions";

interface Category {
  id: string;
  name: string;
}

export function CategorySelect({
  transactionId,
  categoryId,
  categories,
}: {
  transactionId: string;
  categoryId: string | null;
  categories: Category[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <select
      defaultValue={categoryId ?? ""}
      disabled={isPending}
      onChange={(e) => {
        const newCategoryId = e.target.value;
        if (!newCategoryId) return;
        startTransition(async () => {
          await updateTransactionCategory(transactionId, newCategoryId);
          router.refresh();
        });
      }}
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
    >
      <option value="" disabled>
        Categorie…
      </option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}
