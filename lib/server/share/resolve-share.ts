import { bytesStore } from "./bytes-store";
import { denyList } from "./deny-list";
import { verifyToken } from "./sign-token";

export type ResolveShareResult =
  | {
      ok: true;
      name: string;
      expiresAt: number;
      requiresPassword: boolean;
      jti: string;
    }
  | {
      ok: false;
      reason:
        | "malformed"
        | "bad-signature"
        | "expired"
        | "revoked"
        | "not-found";
    };

/**
 * Shared resolve pipeline used by both the public `/api/share/resolve`
 * route and the server-rendered `/share/[token]` page. Extracted from
 * the route handler so the page component can call it directly instead
 * of round-tripping through an internal HTTP fetch (which fails on some
 * hosting setups and turns the viewer into a 500 black screen).
 */
export async function resolveShare(
  token: string | null | undefined,
): Promise<ResolveShareResult> {
  if (!token) return { ok: false, reason: "malformed" };

  const verify = await verifyToken(token);

  if (!verify.ok) return { ok: false, reason: verify.reason };

  const { claims } = verify;

  if (await denyList.has(claims.jti)) {
    return { ok: false, reason: "revoked" };
  }

  const present = await bytesStore.get(claims.jti);

  if (!present) return { ok: false, reason: "not-found" };

  return {
    ok: true,
    name: claims.name ?? "Shared PDF",
    expiresAt: claims.exp,
    requiresPassword: claims.pw === 1,
    jti: claims.jti,
  };
}
