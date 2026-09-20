"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { autoDetectPots } from "@/actions/pots";

const KEY = "pots-auto-detect-at";

// Looks for savings account numbers in past transactions and creates/links
// pots for them — at most every 10 minutes, and only refreshes the page when
// something new was found.
export function AutoDetect() {
  const router = useRouter();

  useEffect(() => {
    try {
      const last = Number(localStorage.getItem(KEY) ?? 0);
      if (Date.now() - last < 10 * 60 * 1000) return;
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // storage unavailable: just run
    }
    autoDetectPots()
      .then((r) => {
        if (r.created > 0) router.refresh();
      })
      .catch(() => {});
  }, [router]);

  return null;
}
