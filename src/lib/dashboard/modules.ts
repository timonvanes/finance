export const DASHBOARD_MODULES = [
  { key: "accounts", label: "Saldo op je rekeningen" },
  { key: "freeToSpend", label: "Vrije ruimte per maand" },
  { key: "reservations", label: "Reserveren van je volgende loon" },
  { key: "loans", label: "Leningen" },
  { key: "alerts", label: "Waarschuwingen over uitgaven en budget" },
  { key: "todo", label: "Te doen" },
  { key: "month", label: "Binnengekomen en uitgegeven" },
  { key: "budgets", label: "Budgetten" },
  { key: "profitLoss", label: "Baten en lasten" },
  { key: "fixed", label: "Vaste lasten" },
] as const;

export type DashboardModuleKey = (typeof DASHBOARD_MODULES)[number]["key"];
