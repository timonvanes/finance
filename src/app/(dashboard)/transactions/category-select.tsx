"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTransactionCategory } from "@/actions/transactions";

interface Category {
  id: string;
  name: string;
}

// Rood = geen categorie, geel = automatisch toegekend (rule), groen = zelf
// gecontroleerd/toegekend (manual) — zo zie je in één oogopslag wat nog
// aandacht nodig heeft en wat al vertrouwd is.
const SOURCE_STYLE: Record<string, string> = {
  none: "border-red-300 bg-red-50",
  rule: "border-amber-300 bg-amber-50",
  manual: "border-green-300 bg-green-50",
};

export function CategorySelect({
  transactionId,
  categoryId,
  categorySource,
  categories,
}: {
  transactionId: string;
  categoryId: string | null;
  categorySource: string;
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
      className={`rounded-md border px-2 py-1 text-xs text-gray-700 disabled:opacity-50 ${SOURCE_STYLE[categorySource] ?? SOURCE_STYLE.none}`}
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
