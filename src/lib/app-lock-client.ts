// The lock screen asks the phone for Face ID with a key made for this one purpose, on this
// device. Because the phone knows which key to use, iOS goes straight to Face ID, without a
// list of passkeys to choose from. Nothing here is sent to a server: it keeps someone who
// holds the unlocked phone out, like the lock of a banking app.

const STORAGE_KEY = "applock-credential";

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s: string) => {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

export function lockSupported() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && Boolean(navigator.credentials);
}

export function hasLockCredential() {
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

// Lets screens follow "is Face ID on for this device" (useSyncExternalStore).
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
export function subscribeLock(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

// Makes the key (Face ID asks once to confirm) and remembers which one it is.
export async function createLockCredential(): Promise<void> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { name: "Finance", id: window.location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "ontgrendelen", displayName: "Finance ontgrendelen" },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Geen sleutel gemaakt.");
  window.localStorage.setItem(STORAGE_KEY, toB64(credential.rawId));
  notify();
}

export function forgetLockCredential() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to forget
  }
  notify();
}

// Asks for Face ID. True only when the phone says the face (or finger) was checked.
export async function confirmWithFaceId(): Promise<boolean> {
  const stored = (() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  })();
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: window.location.hostname,
      userVerification: "required",
      timeout: 60_000,
      // The known key when there is one: then the phone goes straight to Face ID.
      ...(stored ? { allowCredentials: [{ type: "public-key" as const, id: fromB64(stored), transports: ["internal" as const] }] } : {}),
    },
  })) as PublicKeyCredential | null;
  if (!credential) return false;
  // Byte 32 of the authenticator data holds the flags; bit 2 says the face (or finger) was checked.
  const data = new Uint8Array((credential.response as AuthenticatorAssertionResponse).authenticatorData);
  return (data[32] & 0x04) !== 0;
}
