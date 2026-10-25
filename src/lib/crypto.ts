import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./config";

export const SEAL_PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function decodeKey(raw: string) {
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)");
  }
  return key;
}

export function encryptionKeyBytes(): Buffer {
  const raw = env("ENCRYPTION_KEY");
  if (raw) return decodeKey(raw);
  if (process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY is required in production");
  }
  const fallback = env("AUTH_SECRET", "spotted-dev-secret-change-in-production-please");
  return createHash("sha256").update(`spotted-dev-enc:${fallback}`).digest();
}

export function isSealedSecret(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(SEAL_PREFIX));
}

export function sealSecret(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  if (isSealedSecret(value)) return value;
  const key = encryptionKeyBytes();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SEAL_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
}

export function openSecret(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  if (!isSealedSecret(value)) return value;
  const key = encryptionKeyBytes();
  const blob = Buffer.from(value.slice(SEAL_PREFIX.length), "base64");
  if (blob.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Encrypted secret is truncated");
  }
  const iv = blob.subarray(0, IV_LENGTH);
  const tag = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = blob.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function tokenOf(value: string | null | undefined): string | undefined {
  return openSecret(value) ?? undefined;
}

export function redactSecrets<T extends Record<string, unknown>>(detail: T): T {
  const safe = { ...detail };
  for (const key of Object.keys(safe)) {
    if (/token|secret|password|authorization|cookie|code/i.test(key)) {
      delete safe[key];
    }
  }
  return safe;
}
