import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Logins that users link for themselves are kept encrypted (AES-256-GCM). The key
// lives only in the server settings (CREDENTIALS_ENCRYPTION_KEY, 32 random bytes in
// base64). Each value is bound to its user and kind, so a copied row is useless in
// another place.

export type SecretKind = "wbw";

function key(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error("CREDENTIALS_ENCRYPTION_KEY staat nog niet in Vercel.");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY moet 32 bytes zijn (base64).");
  return buf;
}

export const encryptionConfigured = () => {
  try {
    key();
    return true;
  } catch {
    return false;
  }
};

function seal(userId: string, kind: SecretKind, value: object): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`${userId}:${kind}`));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

function open<T>(userId: string, kind: SecretKind, sealed: string): T {
  const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAAD(Buffer.from(`${userId}:${kind}`));
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")) as T;
}

export async function saveSecret(userId: string, kind: SecretKind, value: object) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("user_credentials")
    .upsert({ user_id: userId, kind, secret: seal(userId, kind, value), updated_at: new Date().toISOString() }, { onConflict: "user_id,kind" });
  if (error) throw new Error("Opslaan van de koppeling mislukt.");
}

export async function readSecret<T>(userId: string, kind: SecretKind): Promise<T | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("user_credentials").select("secret").eq("user_id", userId).eq("kind", kind).maybeSingle();
  if (!data?.secret) return null;
  try {
    return open<T>(userId, kind, data.secret as string);
  } catch {
    return null; // wrong key or damaged: treated as not linked
  }
}

export async function hasSecret(userId: string, kind: SecretKind): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("user_credentials").select("user_id").eq("user_id", userId).eq("kind", kind).maybeSingle();
  return Boolean(data);
}

export async function deleteSecret(userId: string, kind: SecretKind) {
  const admin = createAdminClient();
  await admin.from("user_credentials").delete().eq("user_id", userId).eq("kind", kind);
}
