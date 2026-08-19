import { join } from "node:path";

import bcrypt from "bcryptjs";

import { shareFs } from "./fs-store-base";

/**
 * Password hashing for optional share-link passwords.
 *
 * bcryptjs (pure JS) chosen over `argon2` (native addon) because:
 *   • Zero native dependencies — works on Vercel / Lambda / Bun / Node
 *     without `node-gyp` or glibc surprises.
 *   • OWASP-acceptable for this use case (low-value asset, not bank
 *     credentials). Cost factor 12 covers current attack hardware.
 *
 * Hashes live in a server-side store keyed by the token's `jti` — NEVER
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
 * Filesystem-backed: `<SHARE_DATA_DIR>/pw/<jti>.json` = `{ hash, exp }`.
 * Was previously in-memory; server restarts wiped passwords along with
 * everything else, forcing recipients through the "expired" screen even
 * when they had the right password.
 *
 * Multi-instance production still needs a shared store — point
 * `SHARE_DATA_DIR` at a mounted volume or swap the implementation.
 */
export interface PasswordStore {
  set(jti: string, hash: string, expiresAt: number): Promise<void>;
  get(jti: string): Promise<string | undefined>;
  delete(jti: string): Promise<void>;
}

type Entry = { exp: number; hash: string };

class FsPasswordStore implements PasswordStore {
  private async pathFor(jti: string): Promise<string> {
    const dir = await shareFs.ensureDir("pw");

    return join(dir, `${jti}.json`);
  }

  async set(jti: string, hash: string, expiresAt: number): Promise<void> {
    await shareFs.writeJsonAtomic(await this.pathFor(jti), {
      exp: expiresAt,
      hash,
    } satisfies Entry);
  }

  async get(jti: string): Promise<string | undefined> {
    const path = await this.pathFor(jti);
    const entry = await shareFs.readJson<Entry>(path);

    if (!entry) return undefined;
    if (Date.now() >= entry.exp) {
      await shareFs.safeUnlink(path);

      return undefined;
    }

    return entry.hash;
  }

  async delete(jti: string): Promise<void> {
    await shareFs.safeUnlink(await this.pathFor(jti));
  }
}

export const passwordStore: PasswordStore = new FsPasswordStore();
