import { S3Client } from "@aws-sdk/client-s3";

import { getS3Config } from "./env";

let s3: S3Client | null = null;

/**
 * Lazy singleton for the share-link S3 client.
 *
 * Returns `null` when required env vars (`SHARE_S3_BUCKET`, `SHARE_S3_REGION`)
 * are missing, so callers can fall back to the in-memory bytes store.
 */
export function getS3Client(): S3Client | null {
  const config = getS3Config();

  if (!config) return null;

  if (!s3) {
    s3 = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      ...(config.accessKeyId && config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {}),
      forcePathStyle: Boolean(config.endpoint),
    });
  }

  return s3;
}

export function getS3Bucket(): string | undefined {
  return getS3Config()?.bucket;
}
