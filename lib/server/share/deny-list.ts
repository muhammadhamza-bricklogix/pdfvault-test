import { join } from "node:path";

import { shareFs } from "./fs-store-base";

/**
 * Token revocation deny-list.
 *
 * Filesystem-backed: `<SHARE_DATA_DIR>/denylist/<jti>.json` = `{ exp }`.
 * Per-jti files (not a single bag file) so concurrent revokes never race
 * a shared bag write. Was previously in-memory — server restarts silently
 * "un-revoked" tokens, which is worse than the "expired" bug because
 * revocations are a user's explicit "make this stop working" signal.
 *
 * Multi-instance production still needs a shared store — point
 * `SHARE_DATA_DIR` at a mounted volume all replicas can see.
 */
export interface DenyList {
  has(jti: string): Promise<boolean>;
  revoke(jti: string, expiresAt: number): Promise<void>;
}

type Entry = { exp: number };

class FsDenyList implements DenyList {
  private async pathFor(jti: string): Promise<string> {
    const dir = await shareFs.ensureDir("denylist");

    return join(dir, `${jti}.json`);
  }

  async has(jti: string): Promise<boolean> {
    const path = await this.pathFor(jti);
    const entry = await shareFs.readJson<Entry>(path);

    if (!entry) return false;
    if (Date.now() >= entry.exp) {
      await shareFs.safeUnlink(path);

      return false;
    }

    return true;
  }

  async revoke(jti: string, expiresAt: number): Promise<void> {
    await shareFs.writeJsonAtomic(await this.pathFor(jti), {
      exp: expiresAt,
    } satisfies Entry);
  }
}

export const denyList: DenyList = new FsDenyList();
