import type { ShareTokenClaims } from "./sign-token";

/**
 * Share metadata storage.
 *
 * Now that the share URL is just the `jti` (no embedded HMAC token),
 * the server has to look claims up from somewhere. This is the
 * "somewhere": an in-memory map keyed by jti.
 *
 * In production this swaps for the backend's `Share` Prisma row — the
 * interface stays identical.
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

export const metadataStore: MetadataStore = new InMemoryMetadataStore();
