"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markReclaimsPaid } from "@/actions/reclaims";

export interface WbwGroup {
  id: string;
  title: string;
  date: string | null;
  total: number;
  ownShare: number;
  people: { name: string; amount: number }[];
  reclaimIds: string[];
}

const dutch = (n: number) => n.toFixed(2).replace(".", ",");
const dateNl = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("nl-NL") : "");

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

function CopyRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="truncate text-lg text-gray-900">{value}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          if (await copyText(copyValue ?? value)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
        className={`min-h-[44px] shrink-0 rounded-xl px-4 text-base font-medium ${
          copied ? "bg-teal-50 text-teal-700" : "border border-gray-300 bg-white text-gray-800 active:bg-gray-50"
        }`}
      >
        {copied ? "Gekopieerd" : "Kopieer"}
      </button>
    </div>
  );
}

export function WbwCard({ group }: { group: WbwGroup }) {
  const router = useRouter();
  const cardRef = useRef<HTMLLIElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const allText = [
    `Omschrijving: ${group.title}`,
    `Bedrag: ${dutch(group.total)}`,
    `Datum: ${dateNl(group.date)}`,
    "Betaald door: ik",
    ...(group.ownShare > 0.005 ? [`Ik: ${dutch(group.ownShare)}`] : []),
    ...group.people.map((p) => `${p.name}: ${dutch(p.amount)}`),
  ].join("\n");

  function done() {
    setError(null);
    cardRef.current?.classList.add("hidden");
    startTransition(async () => {
      try {
        await markReclaimsPaid(group.reclaimIds);
        router.refresh();
      } catch (e) {
        cardRef.current?.classList.remove("hidden");
        setError(e instanceof Error ? e.message : "Er ging iets mis");
      }
    });
  }

  return (
    <li ref={cardRef} className="space-y-2 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-gray-900">{group.title}</p>
          <p className="text-sm text-gray-500">{dateNl(group.date)}</p>
        </div>
        <p className="shrink-0 text-lg font-semibold text-gray-900">{dutch(group.total)}</p>
      </div>

      <div className="divide-y divide-gray-100 border-t border-gray-100">
        <CopyRow label="Omschrijving" value={group.title} />
        <CopyRow label="Bedrag" value={`€ ${dutch(group.total)}`} copyValue={dutch(group.total)} />
        <CopyRow label="Datum" value={dateNl(group.date)} />
        <div className="py-3">
          <p className="text-sm text-gray-500">Betaald door</p>
          <p className="text-lg text-gray-900">Jij</p>
        </div>
        {group.ownShare > 0.005 && (
          <CopyRow label="Jij" value={`€ ${dutch(group.ownShare)}`} copyValue={dutch(group.ownShare)} />
        )}
        {group.people.map((p) => (
          <CopyRow key={p.name} label={p.name} value={`€ ${dutch(p.amount)}`} copyValue={dutch(p.amount)} />
        ))}
      </div>

      <button
        type="button"
        onClick={async () => {
          if (await copyText(allText)) {
            setCopiedAll(true);
            setTimeout(() => setCopiedAll(false), 1500);
          }
        }}
        className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white text-base font-medium text-gray-900 active:bg-gray-50"
      >
        {copiedAll ? "Gekopieerd" : "Kopieer alles als tekst"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={done}
        className="min-h-[52px] w-full rounded-xl bg-gray-900 text-base font-medium text-white active:bg-gray-700 disabled:opacity-50"
      >
        Gezet in WieBetaaltWat
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </li>
  );
}
