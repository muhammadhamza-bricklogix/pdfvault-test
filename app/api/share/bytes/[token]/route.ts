import type { NextRequest } from "next/server";

import { denyList } from "@/lib/server/share/deny-list";
import { bytesStore } from "@/lib/server/share/bytes-store";
import { verifyToken } from "@/lib/server/share/sign-token";
import {
  verifyViewCookie,
  VIEW_COOKIE_NAME,
} from "@/lib/server/share/view-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/share/bytes/[token]
 *
 * Streams PDF bytes. Gated by:
 *   1. Token signature + expiry (verifyToken)
 *   2. Not revoked (denyList)
 *   3. Valid `share_view` cookie scoped to this token (verifyViewCookie)
 *
 * The cookie is set by `/api/share/resolve` (no-password shares) or
 * `/api/share/verify-password` (after correct password). Without it,
 * even a leaked token + correct password timing can't pull bytes.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);

  const verify = await verifyToken(token);

  if (!verify.ok) {
    return new Response(null, {
      status: verify.reason === "expired" ? 410 : 400,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const { claims } = verify;

  if (await denyList.has(claims.jti)) {
    return new Response(null, {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const cookie = req.cookies.get(VIEW_COOKIE_NAME)?.value;
  const cookieOk = await verifyViewCookie(cookie, claims.jti);

  if (!cookieOk) {
    return new Response(null, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const entry = await bytesStore.get(claims.jti);

  if (!entry) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const safeName = (claims.name ?? "shared.pdf")
    .replace(/[^\w.\- ]/g, "_")
    .slice(0, 100);

  // `bytes.buffer.slice(byteOffset, byteOffset+byteLength)` gives us
  // a tight ArrayBuffer for the Response body — passing the Uint8Array
  // view directly also works but some runtimes lose `byteOffset`.
  const body = entry.bytes.buffer.slice(
    entry.bytes.byteOffset,
    entry.bytes.byteOffset + entry.bytes.byteLength,
  ) as ArrayBuffer;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": entry.mime,
      "Content-Length": String(entry.bytes.byteLength),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}
