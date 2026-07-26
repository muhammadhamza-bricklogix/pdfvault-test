/**
 * Share-link store environment configuration.
 *
 * `SHARE_STORE` selects the backend:
 *   - `memory`  : in-process Map (default, dev/MVP)
 *   - `redis`   : Redis-backed stores for bytes/metadata/password/deny-list
 *   - `s3`      : S3-backed bytes store (metadata remains Redis or memory)
 *
 * Missing env vars for the selected backend cause a graceful fallback to
 * memory so the feature never hard-fails on misconfiguration.
 */

export type ShareStoreType = "memory" | "redis" | "s3";

export function getShareStoreType(): ShareStoreType {
  const env = process.env.SHARE_STORE;

  if (env === "redis" || env === "s3" || env === "memory") return env;

  return "memory";
}

export function getRedisUrl(): string | undefined {
  return process.env.SHARE_REDIS_URL || process.env.REDIS_URL;
}

export function getS3Config():
  | {
      bucket: string;
      region: string;
      endpoint?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    }
  | undefined {
  const bucket = process.env.SHARE_S3_BUCKET;
  const region = process.env.SHARE_S3_REGION;

  if (!bucket || !region) return undefined;

  return {
    bucket,
    region,
    endpoint: process.env.SHARE_S3_ENDPOINT,
    accessKeyId: process.env.SHARE_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.SHARE_S3_SECRET_ACCESS_KEY,
  };
}
