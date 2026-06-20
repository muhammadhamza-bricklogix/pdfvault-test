import type { NextRequest } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { bytesStore } from "@/lib/server/share/bytes-store";
import { denyList } from "@/lib/server/share/deny-list";
import { metadataStore } from "@/lib/server/share/metadata-store";
import { passwordStore } from "@/lib/server/share/password";
import { verifyToken } from "@/lib/server/share/sign-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/share/revoke
 * Body: { token }
 *
 * Owner-only. Adds `jti` to the deny-list and clears bytes/password
 * state. The HMAC signature still verifies, but `denyList.has()` now
 * returns true, so resolve / bytes / verify-password all 410 from here
 * on.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { token?: string };

  try {
    body = (await req.json()) as { token?: string };
  } catch {
    return Response.json({ error: "malformed" }, { status: 400 });
  }

  const { token } = body;

  if (typeof token !== "string") {
    return Response.json({ error: "malformed" }, { status: 400 });
  }

  const verify = await verifyToken(token);

  if (!verify.ok) {
    return Response.json({ error: verify.reason }, { status: 400 });
  }
  if (verify.claims.oid !== userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await denyList.revoke(verify.claims.jti, verify.claims.exp);
  await bytesStore.delete(verify.claims.jti);
  await passwordStore.delete(verify.claims.jti);
  await metadataStore.delete(verify.claims.jti);

  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
