import { Buffer } from "node:buffer";

/**
 * Short-lived "view authorization" cookie.
 *
 * After the viewer enters the correct password (or for password-less
 * shares, immediately on resolve), the server sets a path-scoped
 * cookie that authorizes the bytes endpoint. The cookie carries its
 * own HMAC-signed payload — separate from the long-lived share token
 * so leaking one doesn't leak the other.
 *
 * Cookie shape:
 *   name:  `share_view`
 *   value: `<base64url(payload)>.<base64url(sig)>`
 *   path:  `/api/share/bytes/<token>` (path-scoped)
 *   flags: HttpOnly, Secure, SameSite=Lax
 *   ttl:   5 minutes
 */

const ENCODER = new TextEncoder();

export const VIEW_COOKIE_NAME = "share_view";
export const VIEW_TTL_MS = 5 * 60 * 1000;

type ViewClaims = { jti: string; exp: number };

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

  if (!secret || secret.length < 32) {
    throw new Error("SHARE_SECRET env var missing or too short");
  }

  // Derive a separate key for the view cookie so it can't be confused
  // with the share-token signature.
  return `${secret}:view`;
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

export async function mintViewCookie(jti: string): Promise<string> {
  const payload = b64urlEncode(
    JSON.stringify({ jti, exp: Date.now() + VIEW_TTL_MS } as ViewClaims),
  );
  const sig = await hmac(payload);

  return `${payload}.${b64urlEncode(sig)}`;
}

export async function verifyViewCookie(
  cookie: string | undefined,
  expectedJti: string,
): Promise<boolean> {
  if (!cookie) return false;
  const parts = cookie.split(".");

  if (parts.length !== 2) return false;
  const [payload, sig] = parts as [string, string];
  let expected: Uint8Array;
  let provided: Uint8Array;

  try {
    expected = await hmac(payload);
    provided = new Uint8Array(b64urlDecode(sig));
  } catch {
    return false;
  }
  if (!timingSafeEqual(expected, provided)) return false;

  let claims: ViewClaims;

  try {
    claims = JSON.parse(b64urlDecode(payload).toString("utf8")) as ViewClaims;
  } catch {
    return false;
  }
  if (claims.jti !== expectedJti) return false;
  if (Date.now() >= claims.exp) return false;

  return true;
}

/** Cookie attributes for the Set-Cookie header. */
export function viewCookieAttributes(token: string): string {
  // Path-scope to the specific bytes endpoint so this cookie can't
  // leak across shares.
  const path = `/api/share/bytes/${encodeURIComponent(token)}`;
  const maxAge = Math.floor(VIEW_TTL_MS / 1000);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  return `Path=${path}; HttpOnly${secure}; SameSite=Lax; Max-Age=${maxAge}`;
}
