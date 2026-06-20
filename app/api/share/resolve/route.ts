import type { NextRequest } from "next/server";

import { denyList } from "@/lib/server/share/deny-list";
import { bytesStore } from "@/lib/server/share/bytes-store";
import { verifyToken } from "@/lib/server/share/sign-token";
import {
  mintViewCookie,
  viewCookieAttributes,
  VIEW_COOKIE_NAME,
} from "@/lib/server/share/view-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/share/resolve?t=<token>
 *
 * Public — no auth. Verifies token signature, expiry, and revocation.
 * Returns share metadata (NOT the bytes) for the viewer page to
 * render. For password-less shares we also mint a `share_view` cookie
 * here so the viewer can fetch bytes immediately.
 *
 * Response:
 *   { ok: true, name, expiresAt, requiresPassword }
 *   { ok: false, reason: "not-found" | "expired" | "revoked" | "malformed" }
 */
export async function GET(req: NextRequest): Promise<Response> {
  const token = req.nextUrl.searchParams.get("t");

  if (!token) {
    return Response.json({ ok: false, reason: "malformed" } as const, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const verify = await verifyToken(token);

  if (!verify.ok) {
    const status = verify.reason === "expired" ? 410 : 400;

    return Response.json({ ok: false, reason: verify.reason } as const, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { claims } = verify;

  if (await denyList.has(claims.jti)) {
    return Response.json({ ok: false, reason: "revoked" } as const, {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Check bytes are still present — in the in-memory MVP impl, a
  // server restart wipes them and we want the viewer to show
  // "not-found" rather than 500ing later.
  const present = await bytesStore.get(claims.jti);

  if (!present) {
    return Response.json({ ok: false, reason: "not-found" } as const, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const requiresPassword = claims.pw === 1;
  const headers: Record<string, string> = { "Cache-Control": "no-store" };

  // Password-less shares: mint the view cookie now so the viewer can
  // pull bytes without an extra round-trip.
  if (!requiresPassword) {
    const cookie = await mintViewCookie(claims.jti);

    headers["Set-Cookie"] =
      `${VIEW_COOKIE_NAME}=${cookie}; ${viewCookieAttributes(token)}`;
  }

  return Response.json(
    {
      ok: true,
      name: claims.name ?? "Shared PDF",
      expiresAt: claims.exp,
      requiresPassword,
    } as const,
    { status: 200, headers },
  );
}
