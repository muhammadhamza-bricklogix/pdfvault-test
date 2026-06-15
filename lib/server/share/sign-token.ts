import { Buffer } from "node:buffer";

/**
 * HMAC-signed share-token primitives.
 *
 * The token is the SOLE bearer of authority for a public share link —
 * anyone who has the token can open the share (subject to expiry and
 * optional password). So:
 *
 *   • Sign with HMAC-SHA256 using `SHARE_SECRET` (env). No JWT — we
 *     don't want the `alg:none` / key-confusion surface.
 *   • Verify in constant time.
 *   • Keep claims small. The password hash NEVER goes inside the token;
 *     it would be an offline-crackable artifact handed to anyone with
 *     the URL. The token only carries a `pw: 1` flag.
 *
 * Token wire format:
 *   `<base64url(payload)>.<base64url(sig)>`
 *
 * Payload schema (`ShareTokenClaims`) is a JSON object; expiry is a unix
 * epoch ms timestamp. `jti` is a random 128-bit ID (also used as the
 * password-store + deny-list key).
 */

const ENCODER = new TextEncoder();

export type ShareTokenClaims = {
  /** Schema version — bump if we change claim shape. */
  v: 1;
  /**
   * The document this share gives access to. In the MVP this is the
   * token's own `jti` (bytes live in `bytes-store` keyed by jti).
   * Once a real backend lands, swap to the cloud document id.
   */
  did: string;
  /** Owner's Clerk user id (for ownership checks on revoke). */
  oid: string;
  /** Issued-at, unix epoch ms. */
  iat: number;
  /** Expires-at, unix epoch ms. */
  exp: number;
  /** Random 128-bit id, used as deny-list + password-store key. */
  jti: string;
  /** `1` if a password is required; absent otherwise. */
  pw?: 1;
  /** Optional display name for the share (filename, etc.). Display only. */
  name?: string;
};

function b64urlEncode(bytes: Uint8Array | string): string {
  const buf =
    typeof bytes === "string" ? Buffer.from(bytes) : Buffer.from(bytes);

  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));

  return Buffer.from(padded + pad, "base64");
}

function getSecret(): string {
  const secret = process.env.SHARE_SECRET;

  if (
    !secret ||
    secret.length < 32 ||
    secret === "CHANGE_ME_TO_A_LONG_RANDOM_STRING"
  ) {
    throw new Error(
      "SHARE_SECRET env var is missing, too short, or unset. " +
        "Set a 32+ byte random string. See .env.example.",
    );
  }

  return secret;
}

async function hmac(message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, ENCODER.encode(message));

  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;

  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return diff === 0;
}

/** Random 128-bit id, hex-encoded. Use as `jti` and bytes-store key. */
export function newJti(): string {
  const bytes = new Uint8Array(16);

  crypto.getRandomValues(bytes);

  return Buffer.from(bytes).toString("hex");
}

export async function signToken(claims: ShareTokenClaims): Promise<string> {
  const payload = b64urlEncode(JSON.stringify(claims));
  const sig = await hmac(payload);

  return `${payload}.${b64urlEncode(sig)}`;
}

export type VerifyResult =
  | { ok: true; claims: ShareTokenClaims }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

export async function verifyToken(token: string): Promise<VerifyResult> {
  const parts = token.split(".");

  if (parts.length !== 2) return { ok: false, reason: "malformed" };

  const [payload, sig] = parts as [string, string];
  let expected: Uint8Array;
  let provided: Uint8Array;

  try {
    expected = await hmac(payload);
    provided = new Uint8Array(b64urlDecode(sig));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (!timingSafeEqual(expected, provided)) {
    return { ok: false, reason: "bad-signature" };
  }

  let claims: ShareTokenClaims;

  try {
    claims = JSON.parse(
      b64urlDecode(payload).toString("utf8"),
    ) as ShareTokenClaims;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (claims.v !== 1) return { ok: false, reason: "malformed" };
  if (typeof claims.exp !== "number") return { ok: false, reason: "malformed" };
  if (Date.now() >= claims.exp) return { ok: false, reason: "expired" };

  return { ok: true, claims };
}
