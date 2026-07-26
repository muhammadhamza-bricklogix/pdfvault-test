import type { ShareTokenClaims } from "./sign-token";

import { getShareStoreType } from "./env";
import { getConnectedRedisClient, getRedisClient } from "./redis-client";

/**
 * Share metadata storage.
 *
 * Backend is selected via `SHARE_STORE`:
 *   - `memory` : in-process Map (default)
 *   - `redis`  : Redis JSON string storage
 *
 * Missing Redis env vars cause a graceful fallback to memory.
 */

export interface MetadataStore {
  put(jti: string, claims: ShareTokenClaims): Promise<void>;
  get(jti: string): Promise<ShareTokenClaims | undefined>;
  delete(jti: string): Promise<void>;
}

class InMemoryMetadataStore implements MetadataStore {
  private readonly store = new Map<string, ShareTokenClaims>();

  async put(jti: string, claims: ShareTokenClaims): Promise<void> {
    this.store.set(jti, claims);
  }

  async get(jti: string): Promise<ShareTokenClaims | undefined> {
    const claims = this.store.get(jti);

    if (!claims) return undefined;
    if (Date.now() >= claims.exp) {
      this.store.delete(jti);

      return undefined;
    }

    return claims;
  }

  async delete(jti: string): Promise<void> {
    this.store.delete(jti);
  }
}

const REDIS_KEY_PREFIX = "share:metadata:";

class RedisMetadataStore implements MetadataStore {
  async put(jti: string, claims: ShareTokenClaims): Promise<void> {
    const redis = await getConnectedRedisClient();

    if (!redis) throw new Error("Redis unavailable");

    const ttlMs = Math.max(0, claims.exp - Date.now());

    await redis.setex(
      `${REDIS_KEY_PREFIX}${jti}`,
      Math.ceil(ttlMs / 1000),
      JSON.stringify(claims),
    );
  }

  async get(jti: string): Promise<ShareTokenClaims | undefined> {
    const redis = await getConnectedRedisClient();

    if (!redis) return undefined;

    const raw = await redis.get(`${REDIS_KEY_PREFIX}${jti}`);

    if (!raw) return undefined;

    try {
      const claims = JSON.parse(raw) as ShareTokenClaims;

      if (Date.now() >= claims.exp) {
        await this.delete(jti);

        return undefined;
      }

      return claims;
    } catch {
      await this.delete(jti);

      return undefined;
    }
  }

  async delete(jti: string): Promise<void> {
    const redis = await getConnectedRedisClient();

    if (!redis) return;

    await redis.del(`${REDIS_KEY_PREFIX}${jti}`);
  }
}

function createMetadataStore(): MetadataStore {
  if (getShareStoreType() === "redis" && getRedisClient()) {
    return new RedisMetadataStore();
  }

  return new InMemoryMetadataStore();
}

export const metadataStore: MetadataStore = createMetadataStore();
