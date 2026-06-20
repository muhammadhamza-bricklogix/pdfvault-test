/**
 * Token revocation deny-list.
 *
 * Tokens are stateless (HMAC-signed) so we can't "invalidate" them by
 * deleting a DB row — the signature still verifies. Instead the owner
 * adds the `jti` to a deny-list and every resolve checks it.
 *
 * In-memory `Map` for MVP. Production: swap for a Redis/KV-backed impl.
 * Check on every resolve after HMAC verify (cheap) and before any
 * bytes lookup.
 */

export interface DenyList {
  has(jti: string): Promise<boolean>;
  revoke(jti: string, expiresAt: number): Promise<void>;
}

class InMemoryDenyList implements DenyList {
  private readonly entries = new Map<string, number>();

  async has(jti: string): Promise<boolean> {
    const exp = this.entries.get(jti);

    if (exp === undefined) return false;
    if (Date.now() >= exp) {
      this.entries.delete(jti);

      return false;
    }

    return true;
  }

  async revoke(jti: string, expiresAt: number): Promise<void> {
    this.entries.set(jti, expiresAt);
  }
}

export const denyList: DenyList = new InMemoryDenyList();
