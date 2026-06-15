/**
 * PDF bytes storage for share links.
 *
 * Keyed by the token's `jti`. The MVP keeps bytes in-memory so the
 * feature runs end-to-end with zero infrastructure. Production needs
 * a persistent backend — either:
 *
 *   1. Upload bytes to the existing cloud storage at share-create
 *      time and store the cloud document id here (preferred — bytes
 *      are already authenticated, no duplicate copy), OR
 *   2. Store bytes in S3 / R2 / KV keyed by jti.
 *
 * In either case the interface below stays the same. Don't `import`
 * from this file in client code — the in-memory store doesn't ship to
 * the browser and would break HMR.
 */

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

export const bytesStore: BytesStore = new InMemoryBytesStore();
