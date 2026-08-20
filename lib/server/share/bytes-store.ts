import { join } from "node:path";

import { shareFs } from "./fs-store-base";

/**
 * PDF bytes storage for share links.
 *
 * Filesystem-backed: bytes at `<SHARE_DATA_DIR>/bytes/<jti>.pdf`, expiry
 * sidecar at `<SHARE_DATA_DIR>/bytes/<jti>.meta.json` so the TTL check
 * doesn't have to parse the PDF itself.
 *
 * Was previously an in-memory `Map` — every server restart wiped shares
 * and recipients saw "This share link has expired." even though the
 * signed URL was still within its declared expiry window.
 *
 * Multi-instance production needs a shared store: either mount a
 * persistent volume at `SHARE_DATA_DIR` that all replicas can see, or
 * swap this file's implementation for S3 / R2 / cloud storage. Interface
 * stays identical.
 */
export interface BytesStore {
  put(jti: string, bytes: Uint8Array, expiresAt: number): Promise<void>;
  get(jti: string): Promise<{ bytes: Uint8Array; mime: string } | undefined>;
  delete(jti: string): Promise<void>;
}

type Sidecar = { exp: number; mime: string };

class FsBytesStore implements BytesStore {
  private async paths(jti: string) {
    const dir = await shareFs.ensureDir("bytes");

    return {
      bytes: join(dir, `${jti}.pdf`),
      sidecar: join(dir, `${jti}.meta.json`),
    };
  }

  async put(jti: string, bytes: Uint8Array, expiresAt: number): Promise<void> {
    const { bytes: bytesPath, sidecar } = await this.paths(jti);

    await shareFs.writeBytesAtomic(bytesPath, bytes);
    await shareFs.writeJsonAtomic(sidecar, {
      exp: expiresAt,
      mime: "application/pdf",
    } satisfies Sidecar);
  }

  async get(
    jti: string,
  ): Promise<{ bytes: Uint8Array; mime: string } | undefined> {
    const { bytes: bytesPath, sidecar } = await this.paths(jti);
    const meta = await shareFs.readJson<Sidecar>(sidecar);

    if (!meta) return undefined;
    if (Date.now() >= meta.exp) {
      await shareFs.safeUnlink(bytesPath);
      await shareFs.safeUnlink(sidecar);

      return undefined;
    }

    const bytes = await shareFs.readBytes(bytesPath);

    if (!bytes) return undefined;

    return { bytes, mime: meta.mime };
  }

  async delete(jti: string): Promise<void> {
    const { bytes: bytesPath, sidecar } = await this.paths(jti);

    await shareFs.safeUnlink(bytesPath);
    await shareFs.safeUnlink(sidecar);
  }
}

export const bytesStore: BytesStore = new FsBytesStore();
