import bcrypt from "bcryptjs";

/**
 * Password hashing for optional share-link passwords.
 *
 * bcryptjs (pure JS) chosen over `argon2` (native addon) because:
 *   • Zero native dependencies — works on Vercel / Lambda / Bun / Node
 *     without `node-gyp` or glibc surprises.
 *   • OWASP-acceptable for this use case (low-value asset, not bank
 *     credentials). Cost factor 12 covers current attack hardware.
 *
 * Hashes live in a server-side map keyed by the token's `jti` — NEVER
 * inside the token itself. Putting a hash in the URL would hand an
 * offline-crackable artifact to anyone with the link.
 */

const COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Per-`jti` password storage.
 *
 * In-memory `Map` is fine for local dev + single-instance staging. For
 * production / multi-instance, swap the implementation for a Redis-backed
 * (Upstash) or DB-backed one — interface stays the same.
 */
export interface PasswordStore {
  set(jti: string, hash: string, expiresAt: number): Promise<void>;
  get(jti: string): Promise<string | undefined>;
  delete(jti: string): Promise<void>;
}

class InMemoryPasswordStore implements PasswordStore {
  private readonly store = new Map<string, { hash: string; exp: number }>();

  async set(jti: string, hash: string, expiresAt: number): Promise<void> {
    this.store.set(jti, { hash, exp: expiresAt });
  }

  async get(jti: string): Promise<string | undefined> {
    const entry = this.store.get(jti);

    if (!entry) return undefined;
    if (Date.now() >= entry.exp) {
      this.store.delete(jti);

      return undefined;
    }

    return entry.hash;
  }

  async delete(jti: string): Promise<void> {
    this.store.delete(jti);
  }
}

/**
 * Module-level singleton. Resets on every server restart — fine for
 * MVP demo. Production needs a persistent backend (see interface).
 */
export const passwordStore: PasswordStore = new InMemoryPasswordStore();
