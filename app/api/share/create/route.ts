import type { NextRequest } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { bytesStore } from "@/lib/server/share/bytes-store";
import { getCanonicalOrigin } from "@/lib/server/share/canonical-origin";
import { hashPassword, passwordStore } from "@/lib/server/share/password";
import { newJti, signToken } from "@/lib/server/share/sign-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB
const MIN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const MAX_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * POST /api/share/create
 *
 * Auth: Clerk-required (only signed-in users create shares).
 * Body: multipart/form-data
 *   - file:      Blob — the PDF bytes
 *   - expiresAt: number (unix epoch ms)
 *   - password?: string (optional)
 *   - name?:     string (optional, display only)
 *
 * Response: { token, url, expiresAt }
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;

  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid-form" }, { status: 400 });
  }

  const file = form.get("file");
  const expiresAtRaw = form.get("expiresAt");
  const password = form.get("password");
  const name = form.get("name");

  if (!(file instanceof Blob)) {
    return Response.json({ error: "file-missing" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_PDF_BYTES) {
    return Response.json(
      { error: "file-too-large", maxBytes: MAX_PDF_BYTES },
      { status: 413 },
    );
  }
  if (file.type !== "application/pdf") {
    return Response.json({ error: "not-a-pdf" }, { status: 415 });
  }

  const expiresAt = Number(expiresAtRaw);

  if (!Number.isFinite(expiresAt)) {
    return Response.json({ error: "invalid-expiry" }, { status: 400 });
  }
  const now = Date.now();
  const ttl = expiresAt - now;

  if (ttl < MIN_EXPIRY_MS || ttl > MAX_EXPIRY_MS) {
    return Response.json(
      {
        error: "expiry-out-of-range",
        minMs: MIN_EXPIRY_MS,
        maxMs: MAX_EXPIRY_MS,
      },
      { status: 400 },
    );
  }

  const pw = typeof password === "string" ? password.trim() : "";

  if (pw && (pw.length < 4 || pw.length > 128)) {
    return Response.json({ error: "invalid-password" }, { status: 400 });
  }

  const jti = newJti();
  const displayName =
    typeof name === "string" ? name.slice(0, 200) : "Shared PDF";

  // Magic-byte sniff — `file.type` from the form is set by the client
  // and is not trustworthy on its own. Real PDFs start with `%PDF-`.
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const isPdf =
    header[0] === 0x25 && // %
    header[1] === 0x50 && // P
    header[2] === 0x44 && // D
    header[3] === 0x46 && // F
    header[4] === 0x2d; //   -

  if (!isPdf) {
    return Response.json({ error: "not-a-pdf" }, { status: 415 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  await bytesStore.put(jti, bytes, expiresAt);

  if (pw) {
    const hash = await hashPassword(pw);

    await passwordStore.set(jti, hash, expiresAt);
  }

  const token = await signToken({
    v: 1,
    did: jti,
    oid: userId,
    iat: now,
    exp: expiresAt,
    jti,
    ...(pw ? { pw: 1 as const } : {}),
    name: displayName,
  });

  // Build the URL from the actual request host — the bytes-store lives in
  // memory on THIS instance, so a share URL must point back at the same
  // origin that just accepted the upload. `NEXT_PUBLIC_APP_URL` used to be
  // first here but leaks across envs (staging shares ended up on the prod
  // domain, which had no bytes → 500 for the recipient).
  const origin = getCanonicalOrigin(req.headers, req.nextUrl.origin);
  const url = `${origin}/share/${encodeURIComponent(token)}`;

  return Response.json(
    { token, url, expiresAt },
    {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
