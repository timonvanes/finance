export const DEFAULT_WINDOW_DAYS = 14;
// Before any delivery information exists, assume a quick delivery. Deliberately
// on the early side: a reminder that comes a bit soon costs nothing, one that
// comes too late costs the return.
export const ESTIMATED_DELIVERY_DAYS = 2;

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// The return deadline is the delivery date plus the return window.
export function computeDeadline(input: {
  orderDate: string;
  deliveredDate?: string | null;
  expectedDate?: string | null;
  windowDays?: number | null;
}) {
  const windowDays = input.windowDays && input.windowDays > 0 ? input.windowDays : DEFAULT_WINDOW_DAYS;
  const basis: "delivered" | "expected" | "estimate" = input.deliveredDate
    ? "delivered"
    : input.expectedDate
      ? "expected"
      : "estimate";
  const deliveryDay =
    input.deliveredDate ?? input.expectedDate ?? addDays(input.orderDate, ESTIMATED_DELIVERY_DAYS);
  return { deadline: addDays(deliveryDay, windowDays), basis, windowDays };
}
