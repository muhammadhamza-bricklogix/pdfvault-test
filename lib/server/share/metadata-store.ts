import type { ShareTokenClaims } from "./sign-token";

import { join } from "node:path";

import { shareFs } from "./fs-store-base";

/**
 * Share metadata storage.
 *
 * Filesystem-backed: `<SHARE_DATA_DIR>/meta/<jti>.json`. Survives Next.js
 * server restarts + HMR reloads (the in-memory `Map` previously used here
 * did not — every restart wiped shares and recipients saw "expired").
 *
 * Multi-instance production still needs a shared store; either point
 * `SHARE_DATA_DIR` at a mounted persistent volume all replicas can see,
 * or swap this file's implementation for a real DB / KV. Interface stays
 * identical.
 */
export interface MetadataStore {
  put(jti: string, claims: ShareTokenClaims): Promise<void>;
  get(jti: string): Promise<ShareTokenClaims | undefined>;
  delete(jti: string): Promise<void>;
}

class FsMetadataStore implements MetadataStore {
  private async pathFor(jti: string): Promise<string> {
    const dir = await shareFs.ensureDir("meta");

    return join(dir, `${jti}.json`);
  }

  async put(jti: string, claims: ShareTokenClaims): Promise<void> {
    await shareFs.writeJsonAtomic(await this.pathFor(jti), claims);
  }

  async get(jti: string): Promise<ShareTokenClaims | undefined> {
    const path = await this.pathFor(jti);
    const claims = await shareFs.readJson<ShareTokenClaims>(path);

    if (!claims) return undefined;
    if (Date.now() >= claims.exp) {
      await shareFs.safeUnlink(path);

      return undefined;
    }

    return claims;
  }

  async delete(jti: string): Promise<void> {
    await shareFs.safeUnlink(await this.pathFor(jti));
  }
}

export const metadataStore: MetadataStore = new FsMetadataStore();
