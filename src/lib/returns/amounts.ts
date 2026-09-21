// An order-level discount (coupon) isn't on the individual items, so the amount
// a returned item brings back is its price times this factor.
export function discountFactor(itemsTotal: number, discountTotal: number | null | undefined) {
  const discount = discountTotal ?? 0;
  if (!(itemsTotal > 0) || !(discount > 0)) return 1;
  return Math.max(0, (itemsTotal - discount) / itemsTotal);
}

// When the mail shows a total below the sum of the items and no explicit
// discount, the difference is a discount (shipping would only push it up).
export function inferDiscount(itemsTotal: number, total: number | null | undefined) {
  if (total == null || !(itemsTotal > 0)) return 0;
  const diff = Math.round((itemsTotal - total) * 100) / 100;
  return diff > 0.01 ? diff : 0;
}
