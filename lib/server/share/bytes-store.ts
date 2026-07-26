/**
 * PDF bytes storage for share links.
 *
 * Backend is selected via `SHARE_STORE`:
 *   - `memory` : in-process Map (default)
 *   - `redis`  : Redis binary string storage
 *   - `s3`     : S3 object storage
 *
 * Missing env vars for the selected backend cause a graceful fallback to
 * memory. Don't `import` from this file in client code.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { getShareStoreType } from "./env";
import { getConnectedRedisClient, getRedisClient } from "./redis-client";
import { getS3Bucket, getS3Client } from "./s3-client";

export interface BytesStore {
  put(jti: string, bytes: Uint8Array, expiresAt: number): Promise<void>;
  get(jti: string): Promise<{ bytes: Uint8Array; mime: string } | undefined>;
  delete(jti: string): Promise<void>;
}

type Entry = { bytes: Uint8Array; mime: string; exp: number };

class InMemoryBytesStore implements BytesStore {
  private readonly store = new Map<string, Entry>();

  async put(jti: string, bytes: Uint8Array, expiresAt: number): Promise<void> {
    this.store.set(jti, { bytes, mime: "application/pdf", exp: expiresAt });
  }

  async get(
    jti: string,
  ): Promise<{ bytes: Uint8Array; mime: string } | undefined> {
    const entry = this.store.get(jti);

    if (!entry) return undefined;
    if (Date.now() >= entry.exp) {
      this.store.delete(jti);

      return undefined;
    }

    return { bytes: entry.bytes, mime: entry.mime };
  }

  async delete(jti: string): Promise<void> {
    this.store.delete(jti);
  }
}

const REDIS_KEY_PREFIX = "share:bytes:";
const REDIS_EXP_PREFIX = "share:bytes-exp:";

class RedisBytesStore implements BytesStore {
  async put(jti: string, bytes: Uint8Array, expiresAt: number): Promise<void> {
    const redis = await getConnectedRedisClient();

    if (!redis) throw new Error("Redis unavailable");

    const ttlMs = Math.max(0, expiresAt - Date.now());

    await redis.setex(
      `${REDIS_KEY_PREFIX}${jti}`,
      Math.ceil(ttlMs / 1000),
      Buffer.from(bytes),
    );
    await redis.setex(
      `${REDIS_EXP_PREFIX}${jti}`,
      Math.ceil(ttlMs / 1000),
      String(expiresAt),
    );
  }

  async get(
    jti: string,
  ): Promise<{ bytes: Uint8Array; mime: string } | undefined> {
    const redis = await getConnectedRedisClient();

    if (!redis) return undefined;

    const [buffer, expStr] = await Promise.all([
      redis.getBuffer(`${REDIS_KEY_PREFIX}${jti}`),
      redis.get(`${REDIS_EXP_PREFIX}${jti}`),
    ]);

    if (!buffer) return undefined;

    const exp = expStr ? Number(expStr) : NaN;

    if (Number.isFinite(exp) && Date.now() >= exp) {
      await this.delete(jti);

      return undefined;
    }

    return { bytes: new Uint8Array(buffer), mime: "application/pdf" };
  }

  async delete(jti: string): Promise<void> {
    const redis = await getConnectedRedisClient();

    if (!redis) return;

    await redis.del(`${REDIS_KEY_PREFIX}${jti}`, `${REDIS_EXP_PREFIX}${jti}`);
  }
}

const S3_KEY_PREFIX = "share/bytes/";

class S3BytesStore implements BytesStore {
  async put(jti: string, bytes: Uint8Array, expiresAt: number): Promise<void> {
    const s3 = getS3Client();
    const bucket = getS3Bucket();

    if (!s3 || !bucket) throw new Error("S3 unavailable");

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${S3_KEY_PREFIX}${jti}`,
        Body: Buffer.from(bytes),
        ContentType: "application/pdf",
        Metadata: { "expires-at": String(expiresAt) },
      }),
    );
  }

  async get(
    jti: string,
  ): Promise<{ bytes: Uint8Array; mime: string } | undefined> {
    const s3 = getS3Client();
    const bucket = getS3Bucket();

    if (!s3 || !bucket) return undefined;

    try {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: `${S3_KEY_PREFIX}${jti}`,
        }),
      );

      const expiresAt = response.Metadata?.["expires-at"];
      const exp = expiresAt ? Number(expiresAt) : NaN;

      if (Number.isFinite(exp) && Date.now() >= exp) {
        await this.delete(jti);

        return undefined;
      }

      if (!response.Body) return undefined;

      const bytes = await response.Body.transformToByteArray();

      return { bytes, mime: response.ContentType || "application/pdf" };
    } catch {
      return undefined;
    }
  }

  async delete(jti: string): Promise<void> {
    const s3 = getS3Client();
    const bucket = getS3Bucket();

    if (!s3 || !bucket) return;

    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: `${S3_KEY_PREFIX}${jti}`,
        }),
      );
    } catch {
      // best-effort cleanup
    }
  }
}

function createBytesStore(): BytesStore {
  const type = getShareStoreType();

  if (type === "s3" && getS3Client()) {
    return new S3BytesStore();
  }

  if (type === "redis" && getRedisClient()) {
    return new RedisBytesStore();
  }

  return new InMemoryBytesStore();
}

export const bytesStore: BytesStore = createBytesStore();
