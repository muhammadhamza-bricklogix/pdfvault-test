import bcrypt from "bcryptjs";

import { getShareStoreType } from "./env";
import { getConnectedRedisClient, getRedisClient } from "./redis-client";

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
 * Backend is selected via `SHARE_STORE`:
 *   - `memory` : in-process Map (default)
 *   - `redis`  : Redis string storage
 *
 * Missing Redis env vars cause a graceful fallback to memory.
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

const REDIS_KEY_PREFIX = "share:password:";

class RedisPasswordStore implements PasswordStore {
  async set(jti: string, hash: string, expiresAt: number): Promise<void> {
    const redis = await getConnectedRedisClient();

    if (!redis) throw new Error("Redis unavailable");

    const ttlMs = Math.max(0, expiresAt - Date.now());

    await redis.setex(
      `${REDIS_KEY_PREFIX}${jti}`,
      Math.ceil(ttlMs / 1000),
      hash,
    );
  }

  async get(jti: string): Promise<string | undefined> {
    const redis = await getConnectedRedisClient();

    if (!redis) return undefined;

    const hash = await redis.get(`${REDIS_KEY_PREFIX}${jti}`);

    return hash ?? undefined;
  }

  async delete(jti: string): Promise<void> {
    const redis = await getConnectedRedisClient();

    if (!redis) return;

    await redis.del(`${REDIS_KEY_PREFIX}${jti}`);
  }
}

function createPasswordStore(): PasswordStore {
  if (getShareStoreType() === "redis" && getRedisClient()) {
    return new RedisPasswordStore();
  }

  return new InMemoryPasswordStore();
}

export const passwordStore: PasswordStore = createPasswordStore();
