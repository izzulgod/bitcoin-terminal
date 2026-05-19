// PIN hashing using Web Crypto. Stored hash is salted SHA-256 hex (64 chars).
// Legacy plain-text PINs (length !== 64) are detected and migrated on first verify.

const SALT = "btc-terminal:pin:v1";

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${SALT}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isHashedPin(value: string | null | undefined): boolean {
  return !!value && value.length === 64 && /^[0-9a-f]+$/.test(value);
}

export async function verifyPin(entered: string, stored: string): Promise<boolean> {
  if (!isHashedPin(stored)) {
    // Legacy plain-text comparison (used once during migration).
    return entered === stored;
  }
  const h = await hashPin(entered);
  return h === stored;
}
