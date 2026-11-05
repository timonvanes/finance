"use client";

import { Block, Note, Section, SrcBadge } from "../ui";
import { usePlan } from "../plan-provider";
import { FIELDS, whyText, type FieldDef, type Group } from "@/lib/plan/fields";
import { LAW_ITEMS, LAW_YEAR } from "@/lib/plan/tax";
import { SOURCE_LABEL, type Source } from "@/lib/plan/types";

const GROUPS: Group[] = [
  "Doel en woning",
  "Personen",
  "Inkomen",
  "Kosten koper",
  "Woonlasten",
  "Hypotheek",
  "Studielening",
  "Sparen en beleggen",
  "Box 3",
];

const nl = (n: number, d = 2) => n.toLocaleString("nl-NL", { maximumFractionDigits: d });

export default function SourcesPage() {
  const { b, x, app } = usePlan();

  const show = (f: FieldDef) => {
    const v = f.get(b, x);
    if (f.kind === "bool") return v ? "Ja" : "Nee";
    if (f.kind === "select") return f.options?.find((o) => o.value === v)?.label ?? String(v);
    if (f.kind === "date") return new Date(String(v)).toLocaleDateString("nl-NL");
    const n = Number(v);
    if (f.unit === "€") return n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
    if (f.unit === "%") return `${nl(n)}%`;
    if (f.unit === "jaar") return `${nl(n, 0)} jaar`;
    if (f.unit === "mnd") return `${nl(n, 0)} mnd`;
    return nl(n);
  };

  const counts = (["user", "app", "law", "assume"] as Source[]).map((s) => ({ s, n: FIELDS.filter((f) => f.src === s).length }));

  return (
    <div className="space-y-4">
      <Block title="Waar komen de getallen vandaan?" sub="Elk getal in het plan heeft een van deze herkomsten.">
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex gap-2"><SrcBadge src="user" /><span>Jouw invoer: wat jij zelf weet of kiest.</span></li>
          <li className="flex gap-2"><SrcBadge src="app" /><span>Uit je app: je potjes, je studielening en je inkomsten en uitgaven van de laatste maanden.</span></li>
          <li className="flex gap-2"><SrcBadge src="law" /><span>Wet of regel: belasting, NHG, overdrachtsbelasting en de normen van het Nibud.</span></li>
          <li className="flex gap-2"><SrcBadge src="assume" /><span>Aanname: een schatting van de toekomst of van iets wat je niet vooraf weet (rente, rendement, prijsstijging, kosten).</span></li>
          <li className="flex gap-2"><SrcBadge src="calc" /><span>Berekend: het plan rekent het uit. Tik erop voor de berekening.</span></li>
        </ul>
        <p className="text-xs text-gray-500">
          {counts.map((c) => `${c.n} ${SOURCE_LABEL[c.s].toLowerCase()}`).join(" · ")}
        </p>
      </Block>

      <Block title={`Regels van ${LAW_YEAR}`} sub="Waar een bron twijfel liet of bronnen elkaar tegenspraken staat het erbij.">
        <ul className="divide-y divide-gray-100">
          {LAW_ITEMS.map((l) => (
            <li key={l.key} className="space-y-1 py-3">
              <p className="text-sm font-medium text-gray-900">{l.label}</p>
              <p className="text-sm text-gray-700">{l.value}</p>
              <p className="text-xs text-gray-500">{l.note}</p>
              <p className="text-xs text-gray-500">
                Bron: {l.url ? <a href={l.url} target="_blank" rel="noreferrer" className="text-teal-700 underline">{l.source}</a> : l.source}
              </p>
            </li>
          ))}
        </ul>
      </Block>

      {GROUPS.map((g) => (
        <Section key={g} title={g} hint={`${FIELDS.filter((f) => f.group === g).length} variabelen`}>
          <ul className="divide-y divide-gray-100">
            {FIELDS.filter((f) => f.group === g).map((f) => (
              <li key={f.id} className="space-y-1 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-gray-900">{f.label}</span>
                  <span className="shrink-0 text-sm font-semibold text-gray-900">{show(f)}</span>
                </div>
                <SrcBadge src={f.src} />
                <p className="text-xs leading-relaxed text-gray-600">{whyText(f, app)}</p>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Block title="Wat het plan niet meeneemt" sub="Zodat je weet wat je zelf nog moet controleren.">
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>Toeslagen (huur-, zorg-, kindgebonden budget) en de zorgverzekering.</li>
          <li>AOW, pensioenopbouw en lijfrente.</li>
          <li>Kinderen, kinderopvang, studie van kinderen.</li>
          <li>Schenkings- en erfbelasting.</li>
          <li>Wijzigingen in de wet na {LAW_YEAR}, zoals belasting over werkelijk rendement in box 3.</li>
          <li>Kosten van beleggingsfondsen en transacties.</li>
          <li>Een eventuele verhuisregeling, dubbele woonlasten tijdens de verhuizing en overbruggingsfinanciering.</li>
          <li>Hypotheeknormen van een specifieke geldverstrekker. Het plan gebruikt de normen van het Nibud als schatting.</li>
        </ul>
        <Note>Dit is een rekenhulp met eigen aannames en geen financieel advies. Een hypotheekadviseur kan het echte leenbedrag en de beste aanpak voor jouw situatie vaststellen.</Note>
      </Block>
    </div>
  );
}
