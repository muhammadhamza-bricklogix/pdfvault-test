import { getShareStoreType } from "./env";
import { getConnectedRedisClient, getRedisClient } from "./redis-client";

/**
 * Token revocation deny-list.
 *
 * Tokens are stateless (HMAC-signed) so we can't "invalidate" them by
 * deleting a DB row — the signature still verifies. Instead the owner
 * adds the `jti` to a deny-list and every resolve checks it.
 *
 * Backend is selected via `SHARE_STORE`:
 *   - `memory` : in-process Map (default)
 *   - `redis`  : Redis set membership
 *
 * Missing Redis env vars cause a graceful fallback to memory.
 */

export interface DenyList {
  has(jti: string): Promise<boolean>;
  revoke(jti: string, expiresAt: number): Promise<void>;
}

class InMemoryDenyList implements DenyList {
  private readonly entries = new Map<string, number>();

  async has(jti: string): Promise<boolean> {
    const exp = this.entries.get(jti);

    if (exp === undefined) return false;
    if (Date.now() >= exp) {
      this.entries.delete(jti);

      return false;
    }

    return true;
  }

  async revoke(jti: string, expiresAt: number): Promise<void> {
    this.entries.set(jti, expiresAt);
  }
}

const REDIS_KEY = "share:deny-list";

class RedisDenyList implements DenyList {
  async has(jti: string): Promise<boolean> {
    const redis = await getConnectedRedisClient();

    if (!redis) return false;

    const score = await redis.zscore(REDIS_KEY, jti);

    return score !== null && Date.now() < Number(score);
  }

  async revoke(jti: string, expiresAt: number): Promise<void> {
    const redis = await getConnectedRedisClient();

    if (!redis) return;

    await redis.zadd(REDIS_KEY, expiresAt, jti);
  }
}

function createDenyList(): DenyList {
  if (getShareStoreType() === "redis" && getRedisClient()) {
    return new RedisDenyList();
  }

  return new InMemoryDenyList();
}

export const denyList: DenyList = createDenyList();
