"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Banner, Grid, Section } from "../ui";
import { usePlan } from "../plan-provider";
import { ContribEditor, EventsEditor, LawEditor, SalaryEditor } from "../plan-editors";
import { missingInputs } from "@/lib/plan/completeness";
import { FIELDS, type Group } from "@/lib/plan/fields";

interface Block {
  anchor: string;
  title: string;
  hint: string;
  group: Group;
  extra?: { title: string; node: ReactNode }[];
}

// The order a person thinks in: who and what, then income, the home, the loan, saving, the rules.
const BLOCKS: Block[] = [
  { anchor: "doel", title: "1. Doel en woning", hint: "Wat je wilt kopen en wanneer", group: "Doel en woning" },
  { anchor: "personen", title: "2. Personen", hint: "Jij, je partner en je contract", group: "Personen" },
  {
    anchor: "inkomen",
    title: "3. Inkomen",
    hint: "Salaris nu en per jaar",
    group: "Inkomen",
    extra: [{ title: "Salaris per jaar", node: <SalaryEditor /> }],
  },
  { anchor: "kosten", title: "4. Kosten koper", hint: "Notaris, taxatie, advies en meer", group: "Kosten koper" },
  { anchor: "wonen", title: "5. Woonlasten", hint: "Wat wonen per maand kost", group: "Woonlasten" },
  { anchor: "hypotheek", title: "6. Hypotheek", hint: "Rente, NHG en je verplichtingen", group: "Hypotheek" },
  { anchor: "studie", title: "7. Studielening", hint: "Hoe de bank je studieschuld telt", group: "Studielening" },
  {
    anchor: "sparen",
    title: "8. Sparen en beleggen",
    hint: "Wat je hebt, wat je inlegt en wat het oplevert",
    group: "Sparen en beleggen",
    extra: [
      { title: "Inleg per jaar", node: <ContribEditor /> },
      { title: "Eenmalige gebeurtenissen", node: <EventsEditor /> },
    ],
  },
  {
    anchor: "wet",
    title: "9. Belasting en regels",
    hint: "Box 3 en de wetsparameters per jaar",
    group: "Box 3",
    extra: [{ title: "Wetsparameters per jaar", node: <LawEditor /> }],
  },
];

export default function VariablesPage() {
  const { b, x } = usePlan();
  const missing = missingInputs(b, x);
  const missingGroups = new Set(missing.map((m) => m.group));

  return (
    <div className="space-y-4">
      <Banner level={missing.length === 0 ? "ok" : "warn"} title={missing.length === 0 ? "Alles wat het plan nodig heeft is ingevuld" : `Nog ${missing.length} ${missing.length === 1 ? "gegeven" : "gegevens"} in te vullen`}>
        {missing.length === 0 ? (
          "De rest zijn aannames met een standaardwaarde. Loop ze langs en pas aan wat niet klopt. Bij elk getal staat waar het vandaan komt."
        ) : (
          <>
            {missing.map((m) => m.label).join(", ")}. De bijbehorende groepen staan hieronder open.
          </>
        )}
      </Banner>

      <nav className="-mx-4 overflow-x-auto px-4 pb-1">
        <ul className="flex gap-2">
          {BLOCKS.map((blk) => (
            <li key={blk.anchor} className="shrink-0">
              <a href={`#${blk.anchor}`} className="flex min-h-[40px] items-center rounded-full bg-white px-4 text-sm text-gray-700 ring-1 ring-gray-200 active:bg-gray-100">
                {blk.title.replace(/^\d+\. /, "")}
                {missingGroups.has(blk.group) && <span className="ml-2 h-2 w-2 rounded-full bg-amber-500" />}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {BLOCKS.map((blk) => {
        const ids = FIELDS.filter((f) => f.group === blk.group).map((f) => f.id);
        return (
          <div key={blk.anchor} id={blk.anchor} className="scroll-mt-4">
            <Section title={blk.title} hint={blk.hint} open={missingGroups.has(blk.group)}>
              <Grid ids={ids} />
              {blk.extra?.map((e) => (
                <div key={e.title} className="space-y-2 border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-900">{e.title}</p>
                  {e.node}
                </div>
              ))}
            </Section>
          </div>
        );
      })}

      <p className="px-1 text-xs text-gray-500">
        Wil je weten waar elk getal vandaan komt en wanneer het is gecontroleerd? Kijk bij <Link href="/plan/bronnen" className="text-teal-700 underline">Bronnen</Link>.
      </p>
    </div>
  );
}
