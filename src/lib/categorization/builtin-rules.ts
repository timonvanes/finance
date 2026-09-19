// Built-in knowledge of common Dutch merchants. `brands` are specific enough
// to match in the counterparty name OR the free-text description; `generic`
// words (café, hotel, taxi…) are only trusted in the counterparty name.
// Category names refer to the default categories — they're looked up by name
// in the user's own categories, so a rule is skipped if the user has removed
// or renamed that category.
export interface BuiltinRule {
  category: string;
  brands: string[];
  generic?: string[];
}

export const BUILTIN_RULES: BuiltinRule[] = [
  {
    category: "Boodschappen",
    brands: [
      "albert heijn", "ah to go", "jumbo", "lidl", "aldi", "plus", "dirk", "coop", "spar",
      "vomar", "hoogvliet", "deen", "dekamarkt", "poiesz", "jan linders", "ekoplaza", "marqt",
      "picnic", "crisp", "sligro", "makro", "gall & gall", "gall en gall", "boon", "nettorama",
      "mcd supermarkt", "jumbo foodmarkt", "odin", "bakkerij", "vishandel", "slagerij",
    ],
    generic: ["bakker", "slager", "supermarkt", "groenteboer", "kaashandel", "slijterij"],
  },
  {
    category: "Restaurant & uit eten",
    brands: [
      "thuisbezorgd", "uber eats", "deliveroo", "mcdonald", "burger king", "kfc", "subway",
      "domino", "new york pizza", "starbucks", "coffee company", "bagels & beans", "febo",
      "la place", "smullers", "wagamama", "loetje", "hema restaurant", "vapiano", "five guys",
      "dunkin", "pizza hut", "wok to walk", "sumup", "ccv*", "eetcafe", "grand cafe",
    ],
    generic: [
      "restaurant", "cafe", "café", "brasserie", "sushi", "pizzeria", "snackbar", "lunchroom",
      "bistro", "grill", "kroeg", "bar", "eethuis", "cafetaria", "ijssalon", "koffie",
    ],
  },
  {
    category: "Vervoer",
    brands: [
      "ns groep", "ns reizigers", "ns-", "gvb", "htm", "qbuzz", "arriva", "connexxion", "ov-chipkaart",
      "ov chipkaart", "ovpay", "translink", "shell", "esso", "bp", "texaco", "tinq", "tango",
      "argos", "q8", "total", "parkmobile", "q-park", "qpark", "yellowbrick", "easypark", "anwb",
      "uber", "bolt", "transavia", "klm", "ryanair", "easyjet", "flixbus", "greenwheels",
      "felyx", "swapfiets", "sixt", "hertz", "europcar", "avis", "wegenbelasting", "rdw",
      "belastingdienst motorrijtuigen", "cambio", "mywheels",
    ],
    generic: ["parkeren", "taxi", "tankstation", "autowas", "garage", "parking"],
  },
  {
    category: "Wonen",
    brands: [
      "vattenfall", "eneco", "essent", "greenchoice", "engie", "vitens", "evides", "pwn",
      "waternet", "dunea", "ikea", "gamma", "praxis", "karwei", "hornbach", "kwantum",
      "leen bakker", "jysk", "action", "blokker", "xenos", "hema", "woonstad", "vve",
      "gemeente", "waterschap", "belastingsamenwerking", "bsgr", "coolblue", "mediamarkt",
      "bcc", "wehkamp",
    ],
    generic: ["huur", "hypotheek", "servicekosten", "energie"],
  },
  {
    category: "Verzekeringen",
    brands: [
      "zilveren kruis", "cz groep", "vgz", "menzis", "ohra", "ditzo", "nationale-nederlanden",
      "nationale nederlanden", "centraal beheer", "univé", "unive", "a.s.r.", "asr", "allianz",
      "interpolis", "fbto", "aegon", "achmea", "ing verzekeren", "reaal", "turien", "anwb verzekeringen",
      "de goudse", "goudse", "movir", "monuta", "dela",
    ],
    generic: ["verzekering", "zorgverzekering", "premie"],
  },
  {
    category: "Abonnementen",
    brands: [
      "netflix", "spotify", "videoland", "disney", "hbo", "max.com", "apple.com/bill", "itunes",
      "google one", "youtube", "amazon prime", "prime video", "ziggo", "kpn", "vodafone",
      "t-mobile", "odido", "simyo", "lebara", "tele2", "xs4all", "icloud", "dropbox",
      "microsoft", "adobe", "openai", "anthropic", "chatgpt", "claude.ai", "nrc", "volkskrant",
      "telegraaf", "storytel", "audible", "kindle", "canva", "notion", "1password", "nordvpn",
      "dazn", "viaplay", "npo plus", "sky", "ing zakelijk", "yoursurprise",
    ],
    generic: ["abonnement", "lidmaatschap", "contributie"],
  },
  {
    category: "Vrije tijd & uitjes",
    brands: [
      "pathe", "pathé", "kinepolis", "vue cinema", "ticketmaster", "eventim", "ticketswap",
      "efteling", "walibi", "artis", "dierenpark", "bowling", "steam", "playstation", "nintendo",
      "xbox", "airbnb", "booking.com", "expedia", "tripadvisor", "basic-fit", "basic fit",
      "fit for free", "sportcity", "sport city", "decathlon", "bol.com", "bol com", "amazon",
      "intertoys", "bruna", "libris", "boekenvoordeel", "van der valk", "center parcs",
      "roompot", "landal", "hotelchef",
    ],
    generic: [
      "bioscoop", "theater", "museum", "concert", "festival", "sportschool", "hotel", "camping",
      "vakantie", "pretpark", "zwembad", "kaartje", "tickets",
    ],
  },
  {
    category: "Kleding",
    brands: [
      "zalando", "h&m", "h en m", "hennes", "zara", "c&a", "primark", "we fashion", "scotch",
      "nike", "adidas", "the sting", "suitsupply", "van haren", "shoeby", "vero moda", "bijenkorf",
      "asos", "pull&bear", "bershka", "mango", "uniqlo", "tk maxx", "sissy-boy", "score",
      "invito", "zeeman", "omoda", "sacha", "rituals", "footlocker", "foot locker",
    ],
    generic: ["kleding", "schoenen", "mode"],
  },
  {
    category: "Zorg & persoonlijke verzorging",
    brands: [
      "kruidvat", "etos", "da drogist", "holland & barrett", "holland and barrett", "douglas",
      "ici paris", "the body shop", "specsavers", "pearle", "hans anders", "eye wish",
      "mediq", "benu", "brocacef", "tandartspraktijk", "fysiotherapie", "huisartsenpraktijk",
    ],
    generic: ["apotheek", "huisarts", "tandarts", "fysio", "ziekenhuis", "opticien", "kapper", "barber", "kapsalon", "nagelsalon", "massage"],
  },
  {
    category: "Cadeaus & giften",
    brands: [
      "fleurop", "bloemenbezorgen", "unicef", "wnf", "rode kruis", "oxfam", "greenpeace",
      "giro555", "kwf", "hartstichting", "artsen zonder grenzen", "amnesty", "dierenbescherming",
      "gifts", "cadeaubon", "vvv cadeau", "bol cadeau", "wish",
    ],
    generic: ["cadeau", "bloemen", "donatie", "gift", "kado"],
  },
  {
    category: "Sparen & beleggen",
    brands: [
      "degiro", "bux", "trading 212", "saxo", "binck", "meesman", "brand new day", "coinbase",
      "bitvavo", "scalable", "lightyear", "ing beleggen", "abn amro beleggen", "knab sparen",
      "oranje spaarrekening", "spaarrekening", "moneyou",
    ],
    generic: ["sparen", "beleggen", "spaarpot"],
  },
  {
    category: "Salaris",
    brands: ["salaris", "loon ", "payroll", "loonstrook", "nmbrs", "afas", "ADP"],
    generic: ["salaris", "loon"],
  },
  {
    category: "Terugbetalingen",
    brands: ["terugbetaling", "restitutie", "refund", "retour"],
    generic: ["terug"],
  },
  {
    category: "Overig inkomen",
    brands: [
      "toeslagen", "dienst toeslagen", "belastingdienst", "uwv", "svb", "duo", "rente ", "dividend",
      "vakantiegeld", "declaratie", "reiskosten",
    ],
    generic: ["toeslag", "uitkering", "dividend"],
  },
];
