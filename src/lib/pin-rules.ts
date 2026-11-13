// What counts as an acceptable app code. Used by the browser (to answer at once) and by
// the server (which is the one that really decides).

export const PIN = /^\d{6}$/;

export function weakPinReason(pin: string): string | null {
  if (!PIN.test(pin)) return "Een pincode bestaat uit precies 6 cijfers.";
  if (/^(\d)\1{5}$/.test(pin)) return "Kies geen pincode met zes dezelfde cijfers.";
  if ("0123456789".includes(pin) || "9876543210".includes(pin)) return "Kies geen reeks zoals 123456.";
  return null;
}
