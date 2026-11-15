// Tikkie shows at most 35 characters of the description. A longer text is not taken over,
// so the text is cut to fit, with the reference code (if any) kept at the end.
export const TIKKIE_MAX_DESCRIPTION = 35;

// How many characters can be typed: 35, minus the reference code that goes behind the text.
export function tikkieRoom(referenceCode?: string | null): number {
  return Math.max(0, TIKKIE_MAX_DESCRIPTION - (referenceCode ? ` (${referenceCode})` : "").length);
}

export function tikkieDescription(base: string, referenceCode?: string | null): string {
  const clean = base.replace(/\s+/g, " ").trim();
  const suffix = referenceCode ? ` (${referenceCode})` : "";
  const room = TIKKIE_MAX_DESCRIPTION - suffix.length;
  if (clean.length <= room) return clean + suffix;
  const cut = clean.slice(0, Math.max(room - 1, 0)).trimEnd() + "…";
  return (cut + suffix).slice(0, TIKKIE_MAX_DESCRIPTION);
}

// The link that opens Tikkie's "create a request" screen with the amount (in euros) and the
// description (already cut to what Tikkie takes) filled in.
export function tikkieUrl(amount: number, description: string): string {
  const params = new URLSearchParams();
  params.set("totalAmountInCents", String(Math.round(amount * 100)));
  params.set("description", tikkieDescription(description));
  return `tikkie://payment_request?${params.toString().replace(/\+/g, "%20")}`;
}
