import Redis from "ioredis";

import { getRedisUrl } from "./env";

let redis: Redis | null = null;
let redisFailed = false;

/**
 * Lazy singleton for the share-link Redis connection.
 *
 * Returns `null` when the env var is missing or the connection has previously
 * failed, so callers can fall back to the in-memory implementation.
 */
export function getRedisClient(): Redis | null {
  const url = getRedisUrl();

  if (!url || redisFailed) return null;

  if (!redis) {
    redis = new Redis(url, {
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          redisFailed = true;

          return null;
        }

        return Math.min(times * 100, 1000);
      },
    });

    redis.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("[share] Redis error, falling back to memory store", err);
      redisFailed = true;
    });
  }

  return redis;
}

/**
 * Returns a connected Redis client, or `null` if connection failed.
 * Safe to call repeatedly; the underlying connect is a no-op once connected.
 */
export async function getConnectedRedisClient(): Promise<Redis | null> {
  const client = getRedisClient();

  if (!client) return null;

  try {
    if (client.status === "wait") {
      await client.connect();
    }

    return client;
  } catch {
    return null;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    redisFailed = false;
  }
}
