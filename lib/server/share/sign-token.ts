import { Buffer } from "node:buffer";

import { metadataStore } from "./metadata-store";

/**
 * Share token = bare 128-bit random `jti`, hex-encoded.
 *
 * Previously the token was a base64-encoded JSON claims payload + HMAC
 * signature (200+ characters in the URL bar). The HMAC was redundant:
 * every share-resolve already hits a server-side store for revocation,
 * password lookup, and bytes — the HMAC was protecting state we were
 * about to look up anyway. Dropping it shortens the URL ~6× without
 * weakening security: the jti carries 128 bits of entropy, so guessing
 * a valid share takes ~10³⁸ tries.
 *
 * `signToken(claims)` writes the claims to the metadata store and
 * returns the jti — that jti is what goes in the URL.
 * `verifyToken(jti)` looks the jti up. If absent, expired, or
 * malformed, we report it as such (same shape as before so callers
 * don't change). The function signatures are kept stable so the
 * route handlers don't have to know that the wire format changed.
 */

export type ShareTokenClaims = {
  /** Schema version — bump if claim shape changes. */
  v: 1;
  /** Document id (or jti — same value in the MVP store). */
  did: string;
  /** Owner's Clerk user id (for ownership checks on revoke). */
  oid: string;
  /** Issued-at, unix epoch ms. */
  iat: number;
  /** Expires-at, unix epoch ms. */
  exp: number;
  /** Random 128-bit hex id. The URL bearer. */
  jti: string;
  /** `1` if a password is required; absent otherwise. */
  pw?: 1;
  /** Display name for the share. */
  name?: string;
};

/** Random 128-bit id, hex-encoded. Use as `jti` and store key. */
export function newJti(): string {
  const bytes = new Uint8Array(16);

  crypto.getRandomValues(bytes);

  return Buffer.from(bytes).toString("hex");
}

/**
 * Persists the claims and returns the URL bearer (= `jti`).
 *
 * The function is async to keep the signature compatible with the
 * previous HMAC implementation (which awaited the SubtleCrypto sign
 * call).
 */
export async function signToken(claims: ShareTokenClaims): Promise<string> {
  await metadataStore.put(claims.jti, claims);

  return claims.jti;
}

export type VerifyResult =
  | { ok: true; claims: ShareTokenClaims }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

/**
 * Looks up the claims for a URL bearer.
 *
 * The `bad-signature` reason is kept in the union for backward
 * compatibility with existing route-handler switches, even though
 * there's no signature to check anymore — a wrong jti now produces
 * `malformed` (jti shape doesn't match) or surfaces as a downstream
 * "not-found" once the bytes lookup runs.
 */
export async function verifyToken(jti: string): Promise<VerifyResult> {
  if (!/^[a-f0-9]{32}$/.test(jti)) {
    return { ok: false, reason: "malformed" };
  }

  const claims = await metadataStore.get(jti);

  if (!claims) {
    // The metadata store auto-purges expired entries on read, so a
    // missing entry could be either "never existed" or "expired".
    // We can't distinguish the two from here — callers treat both as
    // the same "link unavailable" UX.
    return { ok: false, reason: "expired" };
  }

  if (Date.now() >= claims.exp) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, claims };
}
