import type { HouseInputs } from "@/lib/house/calc";
import type { AppData, Extra, Source } from "./types";

// One place that knows every number of the plan: what it is called, where it comes
// from and what it means. The screens render from this, and so does the page
// that lists all variables with their sources.

export type Value = number | string | boolean;
export type Group =
  | "Doel en woning"
  | "Personen"
  | "Inkomen"
  | "Kosten koper"
  | "Woonlasten"
  | "Hypotheek"
  | "Studielening"
  | "Sparen en beleggen"
  | "Box 3";

export interface FieldDef {
  id: string;
  group: Group;
  label: string;
  kind: "num" | "bool" | "select" | "date";
  unit?: "€" | "%" | "jaar" | "mnd" | "";
  step?: number;
  options?: { value: string; label: string }[];
  src: Source;
  why: string | ((a: AppData) => string);
  get: (b: HouseInputs, x: Extra) => Value;
  set: (b: HouseInputs, x: Extra, v: Value) => [HouseInputs, Extra];
  // What the app itself would fill in, so a changed value can say so.
  appValue?: (a: AppData) => number;
}

type Rec = Record<string, unknown>;

const B = (k: keyof HouseInputs) => ({
  get: (b: HouseInputs) => b[k] as Value,
  set: (b: HouseInputs, x: Extra, v: Value): [HouseInputs, Extra] => [{ ...b, [k]: v } as HouseInputs, x],
});
const E = (k: keyof Extra) => ({
  get: (_b: HouseInputs, x: Extra) => x[k] as Value,
  set: (b: HouseInputs, x: Extra, v: Value): [HouseInputs, Extra] => [b, { ...x, [k]: v } as Extra],
});
const EN = (g: "costs" | "running" | "box3", k: string) => ({
  get: (_b: HouseInputs, x: Extra) => (x[g] as unknown as Rec)[k] as Value,
  set: (b: HouseInputs, x: Extra, v: Value): [HouseInputs, Extra] => [b, { ...x, [g]: { ...(x[g] as unknown as Rec), [k]: v } } as Extra],
});

const contractOptions = [
  { value: "vast", label: "Vast contract" },
  { value: "tijdelijk", label: "Tijdelijk contract" },
  { value: "zzp", label: "Zelfstandige (zzp)" },
];

export const FIELDS: FieldDef[] = [
  // ---------------------------------------------------------- doel en woning
  { id: "targetDate", group: "Doel en woning", label: "Streefdatum aankoop", kind: "date", src: "user", why: "De datum waarop je de woning wilt kopen (levering bij de notaris). Het plan rekent tot dan en vergelijkt ook andere jaren.", ...B("targetDate") },
  { id: "targetPrice", group: "Doel en woning", label: "Prijs woning (nu)", kind: "num", unit: "€", src: "user", why: "De prijs van de woning die je zoekt, in euro's van vandaag. Het plan laat die prijs meestijgen met de prijsstijging hieronder.", ...B("targetPrice") },
  { id: "priceGrowthPct", group: "Doel en woning", label: "Prijsstijging woningen per jaar", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Aanname. Huizenprijzen stegen de afgelopen jaren vaak 3% tot 8% per jaar, maar dat kan veranderen. Dit getal heeft veel invloed op wat je nodig hebt.", ...E("priceGrowthPct") },
  { id: "inflationPct", group: "Doel en woning", label: "Inflatie per jaar", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Aanname. Kosten koper, woonlasten en je uitgaven stijgen hiermee mee. De ECB streeft naar 2%.", ...E("inflationPct") },
  { id: "newBuild", group: "Doel en woning", label: "Nieuwbouw (geen overdrachtsbelasting)", kind: "bool", src: "user", why: "Bij nieuwbouw van een ontwikkelaar betaal je btw in plaats van overdrachtsbelasting. De prijs die je invult moet dan inclusief btw zijn.", ...E("newBuild") },
  { id: "renovation", group: "Doel en woning", label: "Verbouwing of renovatie", kind: "num", unit: "€", src: "user", why: "Wat je na aankoop wilt verbouwen, in euro's van vandaag. Dit kan meegefinancierd worden als je er een offerte voor hebt.", ...E("renovation") },
  { id: "energyLoan", group: "Doel en woning", label: "Extra lening voor verduurzaming", kind: "num", unit: "€", src: "user", why: "Met een NHG-hypotheek mag je extra lenen voor energiebesparende maatregelen, tot ongeveer 6% van de kostengrens.", ...E("energyLoan") },
  { id: "wozPct", group: "Doel en woning", label: "WOZ-waarde als % van de prijs", kind: "num", unit: "%", step: 1, src: "assume", why: "Aanname. De gemeente stelt de WOZ-waarde vast, vaak iets onder of gelijk aan de koopprijs. De WOZ bepaalt het eigenwoningforfait en de OZB.", ...E("wozPct") },
  { id: "ewfPct", group: "Doel en woning", label: "Eigenwoningforfait", kind: "num", unit: "%", step: 0.01, src: "law", why: "Het bedrag dat je als huurwaarde bij je inkomen moet tellen, een percentage van de WOZ-waarde. 0,35% is het percentage van 2025. Controleer het voor het jaar van aankoop.", ...E("ewfPct") },
  { id: "bufferMonths", group: "Doel en woning", label: "Buffer na aankoop", kind: "num", unit: "mnd", step: 1, src: "assume", why: "Hoeveel maanden aan vaste lasten je na aankoop nog op je rekening wilt hebben. Dat telt mee bij wat je nodig hebt. 3 tot 6 maanden is gebruikelijk.", ...E("bufferMonths") },
  { id: "limitGrowthPct", group: "Doel en woning", label: "Stijging van de wettelijke grenzen per jaar", kind: "num", unit: "%", step: 0.5, src: "assume", why: "Aanname voor de NHG-grens en de grens van de startersvrijstelling na 2027. In 2026 zijn dat €470.000 en €555.000; voor 2027 is €615.000 aangekondigd.", ...E("limitGrowthPct") },

  // ------------------------------------------------------------------ personen
  { id: "birthYear", group: "Personen", label: "Jouw geboortejaar", kind: "num", unit: "", step: 1, src: "user", why: "Voor de startersvrijstelling: je moet bij de levering 18 tot en met 34 jaar zijn.", ...E("birthYear") },
  { id: "buyingTogether", group: "Personen", label: "Je koopt samen met een partner", kind: "bool", src: "user", why: "Dan telt het inkomen van je partner mee voor de hypotheek en de woonlasten.", ...E("buyingTogether") },
  { id: "partnerBirthYear", group: "Personen", label: "Geboortejaar partner", kind: "num", unit: "", step: 1, src: "user", why: "De startersvrijstelling geldt per koper.", ...E("partnerBirthYear") },
  { id: "sharePctYou", group: "Personen", label: "Jouw aandeel in de woning", kind: "num", unit: "%", step: 1, src: "user", why: "Hoe de woning verdeeld wordt. Bepaalt wie hoeveel overdrachtsbelasting betaalt.", ...E("sharePctYou") },
  { id: "contractYou", group: "Personen", label: "Jouw contract", kind: "select", options: contractOptions, src: "user", why: "Banken kijken anders naar een vast contract, een tijdelijk contract (met werkgeversverklaring) en een zelfstandige (gemiddelde van drie jaar).", ...E("contractYou") },
  { id: "contractPartner", group: "Personen", label: "Contract partner", kind: "select", options: contractOptions, src: "user", why: "Zie hierboven.", ...E("contractPartner") },

  // ------------------------------------------------------------------- inkomen
  { id: "incomeGrossYear", group: "Inkomen", label: "Jouw bruto jaarinkomen nu", kind: "num", unit: "€", src: "user", why: "Inclusief vakantiegeld en eventuele vaste 13e maand, zoals op je loonstrook per jaar. De jaren erna volgen uit de groei hieronder of uit wat je per jaar invult.", ...B("incomeGrossYear") },
  { id: "partnerIncomeGrossYear", group: "Inkomen", label: "Bruto jaarinkomen partner nu", kind: "num", unit: "€", src: "user", why: "Zie hierboven. Telt alleen mee als je samen koopt.", ...B("partnerIncomeGrossYear") },
  { id: "salaryGrowthPct", group: "Inkomen", label: "Salarisgroei per jaar (jij)", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Aanname voor jaren waarin je geen salaris invult. Denk aan cao-verhoging plus periodieken. Een eerste baan groeit vaak sneller dan 3%.", ...E("salaryGrowthPct") },
  { id: "partnerGrowthPct", group: "Inkomen", label: "Salarisgroei per jaar (partner)", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Zie hierboven.", ...E("partnerGrowthPct") },
  { id: "pensionPct", group: "Inkomen", label: "Pensioenpremie (jij, % van bruto)", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Het deel van je salaris dat je zelf aan pensioen betaalt. Het staat op je loonstrook. Dit is belastingvrij en verlaagt je netto.", ...E("pensionPct") },
  { id: "partnerPensionPct", group: "Inkomen", label: "Pensioenpremie (partner)", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Zie hierboven.", ...E("partnerPensionPct") },
  { id: "taxIndexPct", group: "Inkomen", label: "Indexatie belastingschijven per jaar", kind: "num", unit: "%", step: 0.1, src: "assume", why: "De schijfgrenzen en heffingskortingen stijgen na 2026 meestal mee met de inflatie. Zo stijgt je belastingdruk niet alleen doordat je salaris meestijgt met prijzen.", ...E("taxIndexPct") },

  // -------------------------------------------------------------- kosten koper
  ...(
    [
      ["notary", "Notaris", 1800, "Levering en hypotheekakte samen. Meestal €1.500 tot €2.500."],
      ["valuation", "Taxatie", 700, "Taxatierapport voor de bank. Meestal €600 tot €900."],
      ["advice", "Hypotheekadvies", 3000, "Adviseur of bemiddelaar. Meestal €2.500 tot €4.500, soms ook een provisie van de bank."],
      ["bankFee", "Afsluitprovisie bank", 0, "Alleen als jouw adviseur of bank er een rekent."],
      ["buyerAgent", "Aankoopmakelaar", 0, "Optioneel. Vaak ongeveer 1% van de prijs of een vast bedrag van €3.000 tot €5.000."],
      ["inspection", "Bouwkundige keuring", 500, "Optioneel maar verstandig. Meestal €400 tot €800."],
      ["bankGuarantee", "Bankgarantie", 250, "Zekerheid voor de verkoper. Meestal €150 tot €350, of een waarborgsom."],
      ["moving", "Verhuizing", 1500, "Verhuizer of verhuiswagen en klusjes."],
      ["furnishing", "Inrichting en meubels", 5000, "Vloeren, gordijnen, keuken-apparatuur, meubels."],
      ["other", "Overige kosten", 1000, "Verrassingen: aansluitingen, sleutels, rommel."],
    ] as [string, string, number, string][]
  ).map(
    ([k, label, , why]): FieldDef => ({
      id: `cost.${k}`,
      group: "Kosten koper",
      label,
      kind: "num",
      unit: "€",
      src: "assume",
      why: `Aanname, in euro's van vandaag (stijgt met inflatie). ${why}`,
      ...EN("costs", k),
    })
  ),

  // ---------------------------------------------------------------- woonlasten
  { id: "rentNow", group: "Woonlasten", label: "Je huidige woonkosten per maand", kind: "num", unit: "€", src: "user", why: "Huur inclusief servicekosten, zonder energie. Het plan vergelijkt je toekomstige woonlast hiermee.", ...E("rentNow") },
  { id: "otherSpendingMonth", group: "Woonlasten", label: "Je uitgaven per maand, zonder wonen en sparen", kind: "num", unit: "€", src: "app", why: (a) => `Gemiddelde van de laatste ${a.months.length} perioden uit je transacties (${a.months.map((m) => m.label).join(", ")}): uitgaven min wat je spaarde. Je woonkosten staan daar nog in; vul die hierboven in en trek ze er zelf van af.`, appValue: (a) => a.avgSpentExSaving, ...E("otherSpendingMonth") },
  { id: "run.maintenancePct", group: "Woonlasten", label: "Onderhoud per jaar (% van de prijs)", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Vuistregel: 1% van de woningwaarde per jaar. Oudere woningen vragen meer, nieuwbouw minder.", ...EN("running", "maintenancePct") },
  { id: "run.ozbPct", group: "Woonlasten", label: "OZB (% van de WOZ per jaar)", kind: "num", unit: "%", step: 0.01, src: "assume", why: "Onroerendezaakbelasting van de gemeente. Het tarief verschilt per gemeente, rond 0,05% tot 0,15%.", ...EN("running", "ozbPct") },
  { id: "run.waterYear", group: "Woonlasten", label: "Waterschap, riool en afval per jaar", kind: "num", unit: "€", src: "assume", why: "Gemeentelijke en waterschapsheffingen. Verschilt sterk per plek.", ...EN("running", "waterYear") },
  { id: "run.insuranceMonth", group: "Woonlasten", label: "Opstal- en inboedelverzekering per maand", kind: "num", unit: "€", src: "assume", why: "Opstalverzekering is verplicht bij een hypotheek; inboedel is verstandig.", ...EN("running", "insuranceMonth") },
  { id: "run.energyMonth", group: "Woonlasten", label: "Energie en water per maand", kind: "num", unit: "€", src: "assume", why: "Hangt af van het energielabel en het aantal bewoners.", ...EN("running", "energyMonth") },
  { id: "run.vveMonth", group: "Woonlasten", label: "VvE-bijdrage per maand", kind: "num", unit: "€", src: "user", why: "Alleen bij een appartement. Staat in het VvE-overzicht van de woning.", ...EN("running", "vveMonth") },
  { id: "run.groundRentMonth", group: "Woonlasten", label: "Erfpachtcanon per maand", kind: "num", unit: "€", src: "user", why: "Alleen bij erfpacht. Staat in de verkoopstukken.", ...EN("running", "groundRentMonth") },

  // ---------------------------------------------------------------- hypotheek
  { id: "rate", group: "Hypotheek", label: "Hypotheekrente", kind: "num", unit: "%", step: 0.05, src: "assume", why: "Aanname voor de rente bij aankoop (bijvoorbeeld 10 jaar vast). Dit verandert tot dan. Het gemiddelde eind augustus 2026 was ongeveer 4,1% (10 jaar vast met NHG).", ...B("rate") },
  { id: "termYears", group: "Hypotheek", label: "Looptijd", kind: "num", unit: "jaar", step: 1, src: "law", why: "Maximaal 30 jaar voor hypotheekrenteaftrek, annuïtair of lineair.", ...B("termYears") },
  { id: "nhgMode", group: "Hypotheek", label: "Nationale Hypotheek Garantie", kind: "select", options: [{ value: "auto", label: "Automatisch (onder de grens)" }, { value: "yes", label: "Ja" }, { value: "no", label: "Nee" }], src: "law", why: "NHG kan als de koopsom onder de kostengrens ligt (€470.000 in 2026). Je betaalt eenmalig 0,4% van de hypotheek en krijgt vaak een lagere rente.", ...E("nhgMode") },
  { id: "nhgRateDiscount", group: "Hypotheek", label: "Rentekorting met NHG", kind: "num", unit: "%", step: 0.05, src: "assume", why: "Aanname. Banken geven vaak 0,1 tot 0,3 procentpunt korting met NHG. Vraag je adviseur om de echte korting.", ...E("nhgRateDiscount") },
  { id: "borrowMode", group: "Hypotheek", label: "Hoeveel wil je lenen?", kind: "select", options: [{ value: "max", label: "Zoveel als de bank geeft" }, { value: "comfort", label: "Wat past binnen mijn woonquote" }, { value: "fixed", label: "Een vast bedrag" }], src: "user", why: "Lenen tot het maximum is niet hetzelfde als lenen wat je comfortabel kunt dragen.", ...E("borrowMode") },
  { id: "comfortPct", group: "Hypotheek", label: "Eigen grens vaste woonlasten", kind: "num", unit: "%", step: 1, src: "assume", why: "Het deel van je netto inkomen dat je maximaal aan vaste woonlasten wilt uitgeven. Rond 30% is voorzichtig.", ...E("comfortPct") },
  { id: "borrowFixed", group: "Hypotheek", label: "Vast bedrag om te lenen", kind: "num", unit: "€", src: "user", why: "Alleen bij 'een vast bedrag'. Het plan neemt nooit meer dan de bank geeft.", ...E("borrowFixed") },
  { id: "finPctOverride", group: "Hypotheek", label: "Financieringslast (0 = automatisch)", kind: "num", unit: "%", step: 0.1, src: "law", why: "Het deel van je bruto inkomen dat de bank aan hypotheeklasten toestaat (Nibud). Het plan schat dit vanuit drie bekende punten. Weet je het percentage van je adviseur, vul het hier in.", ...E("finPctOverride") },
  { id: "testRate", group: "Hypotheek", label: "Toetsrente (0 = gelijk aan hypotheekrente)", kind: "num", unit: "%", step: 0.05, src: "law", why: "Bij een rentevaste periode korter dan 10 jaar rekent de bank met een hogere toetsrente. Bij 10 jaar of langer is het de echte rente.", ...E("testRate") },
  { id: "rateShock", group: "Hypotheek", label: "Rentestijging voor de stresstest", kind: "num", unit: "%", step: 0.25, src: "assume", why: "Hoeveel procentpunt hogere rente het plan test om te laten zien hoeveel hypotheek je dan verliest.", ...E("rateShock") },
  { id: "otherLoanMonth", group: "Hypotheek", label: "Andere leningen per maand", kind: "num", unit: "€", src: "user", why: "Persoonlijke lening, autolening, afbetalingen. Banken tellen de maandlast volledig mee.", ...E("otherLoanMonth") },
  { id: "creditLimit", group: "Hypotheek", label: "Totale kredietlimieten (creditcard, rood staan)", kind: "num", unit: "€", src: "user", why: "Banken tellen 2% van de limiet per maand mee, ook als je er niets van gebruikt.", ...E("creditLimit") },
  { id: "leaseMonth", group: "Hypotheek", label: "Autolease per maand", kind: "num", unit: "€", src: "user", why: "Wordt als verplichting meegeteld.", ...E("leaseMonth") },
  { id: "alimonyMonth", group: "Hypotheek", label: "Alimentatie per maand", kind: "num", unit: "€", src: "user", why: "Wordt als verplichting meegeteld.", ...E("alimonyMonth") },

  // -------------------------------------------------------------- studielening
  { id: "studyFactorPct", group: "Studielening", label: "Factor die de bank meetelt (% van de schuld per maand)", kind: "num", unit: "%", step: 0.05, src: "assume", why: "Bronnen verschillen: 0,35% tot 0,75% van de schuld per maand, of de echte DUO-maandlast. Het plan neemt de hoogste van beide. Vraag je adviseur welke factor zijn geldverstrekker gebruikt.", ...E("studyFactorPct") },
  { id: "studyExtraRepay", group: "Studielening", label: "Extra aflossen op je studielening", kind: "num", unit: "€", src: "user", why: "Een bedrag dat je eenmalig extra aflost. Het komt uit je spaargeld en verlaagt je schuld. Probeer wat dit voor je hypotheek doet.", ...E("studyExtraRepay") },
  { id: "studyRepayYear", group: "Studielening", label: "Jaar van het extra aflossen", kind: "num", unit: "", step: 1, src: "user", why: "Het jaar waarin je dat bedrag aflost.", ...E("studyRepayYear") },
  { id: "studyOriginal", group: "Studielening", label: "Oorspronkelijke schuld (0 = uit je schulden)", kind: "num", unit: "€", src: "app", why: (a) => `Som van de delen van je studieschuld op hun peildatum (${a.study.hasLoan ? "nu €" + Math.round(a.study.originalDebt).toLocaleString("nl-NL") : "geen studielening"}). Vul zelf in als je het oorspronkelijke bedrag kent.`, ...E("studyOriginal") },

  // ------------------------------------------------------ sparen en beleggen
  { id: "startSavings", group: "Sparen en beleggen", label: "Nu gespaard", kind: "num", unit: "€", src: "app", why: (a) => `Som van je spaarpotjes (${a.potNames.saving.join(", ") || "geen"}). Daarna kun je het aanpassen, of een jaarlijkse update doen.`, appValue: (a) => a.savingsNow, ...B("startSavings") },
  { id: "startBonds", group: "Sparen en beleggen", label: "Nu in obligaties", kind: "num", unit: "€", src: "user", why: "Waarde van je obligaties of obligatiefondsen. Niet uit je potjes: vul het zelf in.", ...E("startBonds") },
  { id: "startInvest", group: "Sparen en beleggen", label: "Nu in aandelen of beleggingen", kind: "num", unit: "€", src: "app", why: (a) => `Som van je beleggingspotjes (${a.potNames.investing.join(", ") || "geen"}).`, appValue: (a) => a.investNow, ...B("startInvest") },
  { id: "monthlySave", group: "Sparen en beleggen", label: "Sparen per maand", kind: "num", unit: "€", src: "app", why: "Het maandplan van je spaarpotjes voor de volgende periode.", appValue: (a) => a.monthlySave, ...B("monthlySave") },
  { id: "monthlyBonds", group: "Sparen en beleggen", label: "Obligaties kopen per maand", kind: "num", unit: "€", src: "user", why: "Hoeveel je per maand in obligaties wilt stoppen.", ...E("monthlyBonds") },
  { id: "monthlyInvest", group: "Sparen en beleggen", label: "Beleggen per maand", kind: "num", unit: "€", src: "app", why: "Het maandplan van je beleggingspotjes voor de volgende periode.", appValue: (a) => a.monthlyInvest, ...B("monthlyInvest") },
  { id: "contribGrowthPct", group: "Sparen en beleggen", label: "Stijging van je inleg per jaar", kind: "num", unit: "%", step: 0.5, src: "assume", why: "Als je salaris stijgt, kun je meer inleggen. 0% laat de inleg gelijk.", ...E("contribGrowthPct") },
  { id: "savingsRate", group: "Sparen en beleggen", label: "Spaarrente", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Aanname voor de rente op een spaarrekening. Die schommelt met de marktrente.", ...B("savingsRate") },
  { id: "bondsLow", group: "Sparen en beleggen", label: "Obligaties, laag rendement", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Aanname. Obligatiefondsen gaven historisch ruwweg 2% tot 4%, maar kunnen bij rentestijging negatief zijn.", ...E("bondsLow") },
  { id: "bondsMid", group: "Sparen en beleggen", label: "Obligaties, verwacht rendement", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Aanname. Dit is waar de simulatie omheen rekent.", ...E("bondsMid") },
  { id: "bondsHigh", group: "Sparen en beleggen", label: "Obligaties, hoog rendement", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Aanname.", ...E("bondsHigh") },
  { id: "returnLow", group: "Sparen en beleggen", label: "Aandelen, laag rendement", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Aanname. Een tegenvallend scenario, geen voorspelling.", ...B("returnLow") },
  { id: "returnMid", group: "Sparen en beleggen", label: "Aandelen, verwacht rendement", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Aanname. Wereldwijd gespreide aandelen gaven historisch ruwweg 5% tot 8% per jaar, na inflatie minder. Niet gegarandeerd.", ...B("returnMid") },
  { id: "returnHigh", group: "Sparen en beleggen", label: "Aandelen, hoog rendement", kind: "num", unit: "%", step: 0.1, src: "assume", why: "Aanname. Een meevallend scenario.", ...B("returnHigh") },
  { id: "volStocks", group: "Sparen en beleggen", label: "Schommeling aandelen (per jaar)", kind: "num", unit: "%", step: 0.5, src: "assume", why: "Standaarddeviatie van het jaarrendement. Gespreide aandelen schommelen historisch ongeveer 15% tot 18%. Hiermee simuleert het plan duizenden mogelijke verlopen.", ...E("volStocks") },
  { id: "volBonds", group: "Sparen en beleggen", label: "Schommeling obligaties (per jaar)", kind: "num", unit: "%", step: 0.5, src: "assume", why: "Standaarddeviatie van het jaarrendement. Ruwweg 4% tot 7%.", ...E("volBonds") },
  { id: "correlation", group: "Sparen en beleggen", label: "Samenhang aandelen en obligaties", kind: "num", unit: "", step: 0.05, src: "assume", why: "Getal van -1 tot 1. 0 betekent dat ze los van elkaar bewegen, 1 dat ze gelijk bewegen.", ...E("correlation") },
  { id: "glide", group: "Sparen en beleggen", label: "Afbouwen naar sparen vlak voor de aankoop", kind: "bool", src: "user", why: "Dan wordt in de laatste jaren stap voor stap alles naar spaarrekening verplaatst, zodat een beurscrash vlak voor de koop minder doet.", ...E("glide") },
  { id: "glideYears", group: "Sparen en beleggen", label: "Afbouwen in de laatste", kind: "num", unit: "jaar", step: 1, src: "user", why: "Hoeveel jaar voor de aankoop je begint met afbouwen.", ...E("glideYears") },
  { id: "confidencePct", group: "Sparen en beleggen", label: "Zekerheid waarmee het moet lukken", kind: "num", unit: "%", step: 5, src: "user", why: "Met 80% rekent het plan met het resultaat dat in 80% van de gesimuleerde verlopen gehaald wordt. Hoger is voorzichtiger.", ...E("confidencePct") },

  // ------------------------------------------------------------------- box 3
  { id: "box3.savingsReturnPct", group: "Box 3", label: "Fictief rendement spaargeld", kind: "num", unit: "%", step: 0.01, src: "law", why: "Voorlopig percentage voor 2026. Controleer het op belastingdienst.nl, het wordt definitief vastgesteld.", ...EN("box3", "savingsReturnPct") },
  { id: "box3.otherReturnPct", group: "Box 3", label: "Fictief rendement beleggingen", kind: "num", unit: "%", step: 0.01, src: "law", why: "Voorlopig percentage voor 2026 over overige bezittingen.", ...EN("box3", "otherReturnPct") },
  { id: "box3.debtReturnPct", group: "Box 3", label: "Fictieve rente op schulden", kind: "num", unit: "%", step: 0.01, src: "law", why: "Voorlopig percentage voor 2026. Een studielening telt hier als schuld, boven de drempel.", ...EN("box3", "debtReturnPct") },
  { id: "box3.exemptPerPerson", group: "Box 3", label: "Heffingsvrij vermogen per persoon", kind: "num", unit: "€", src: "law", why: "€59.357 in 2026 (SRA).", ...EN("box3", "exemptPerPerson") },
  { id: "box3.debtThresholdPerPerson", group: "Box 3", label: "Drempel schulden per persoon", kind: "num", unit: "€", src: "law", why: "€3.800 in 2026 (SRA).", ...EN("box3", "debtThresholdPerPerson") },
  { id: "box3.ratePct", group: "Box 3", label: "Tarief box 3", kind: "num", unit: "%", step: 0.5, src: "law", why: "36% in 2026.", ...EN("box3", "ratePct") },
  { id: "box3Persons", group: "Box 3", label: "Aantal personen voor box 3", kind: "num", unit: "", step: 1, src: "user", why: "1 als alleen jouw vermogen in dit plan zit, 2 als jullie het samen opbouwen en samen aangifte doen (dan verdubbelt het heffingsvrije bedrag).", ...E("box3Persons") },
];

export const FIELD_BY_ID = new Map(FIELDS.map((f) => [f.id, f]));

export function whyText(f: FieldDef, a: AppData) {
  return typeof f.why === "function" ? f.why(a) : f.why;
}
