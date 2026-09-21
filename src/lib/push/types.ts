export const PUSH_TYPES = [
  { key: "mail_order", label: "Nieuwe bestelling uit een doorgestuurde mail" },
  { key: "mail_return", label: "Retour verwerkt of retourmail die je moet controleren" },
  { key: "price_adjustment", label: "Prijsverschil of vergoeding achteraf" },
  { key: "deadline", label: "Retourtermijn bijna afgelopen" },
  { key: "bunq_paid", label: "Betaalverzoek betaald via bunq" },
  { key: "transactions", label: "Nieuwe banktransacties" },
  { key: "debt_rate", label: "Rente van een lening wordt opnieuw vastgezet" },
] as const;

export type PushType = (typeof PUSH_TYPES)[number]["key"];
