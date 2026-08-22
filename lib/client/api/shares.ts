/**
 * Typed client for the share-link API.
 *
 * Endpoints live under `/api/share/*` (same Next.js app, route handlers
 * in `app/api/share/`). The contract is fixed; the backend implementation
 * is currently in-memory (see `lib/server/share/`) — when a persistent
 * backend lands the routes swap their stores and this client stays the
 * same.
 *
 * Endpoints:
 *   POST /api/share/create           — auth required
 *   GET  /api/share/resolve?t=...    — public
 *   POST /api/share/verify-password  — public
 *   GET  /api/share/bytes/{token}    — public, cookie-gated
 *   POST /api/share/revoke           — owner-only
 */

export type CreateShareInput = {
  file: File;
  /** unix epoch ms; 1h ≤ ttl ≤ 30d enforced server-side. */
  expiresAt: number;
  password?: string;
  /** Display only — shown on the viewer page. Defaults to filename. */
  name?: string;
};

export type CreateShareResult = {
  token: string;
  url: string;
  expiresAt: number;
};

export type CreateShareError =
  | "unauthorized"
  | "file-missing"
  | "file-too-large"
  | "not-a-pdf"
  | "invalid-expiry"
  | "expiry-out-of-range"
  | "invalid-password"
  | "invalid-form"
  | "unknown";

export async function createShare(
  input: CreateShareInput,
): Promise<
  | { ok: true; data: CreateShareResult }
  | { ok: false; reason: CreateShareError }
> {
  const form = new FormData();

  form.append("file", input.file);
  form.append("expiresAt", String(input.expiresAt));
  if (input.password) form.append("password", input.password);
  if (input.name) form.append("name", input.name);

  let res: Response;

  try {
    res = await fetch("/api/share/create", {
      method: "POST",
      body: form,
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unknown" };
  }

  if (res.ok) {
    const data = (await res.json()) as CreateShareResult;

    // Override the server-computed URL with one built from the current
    // browser origin. The server's `getCanonicalOrigin` relies on
    // `x-forwarded-host` / `host` headers that some production proxies
    // don't forward, which produced domain-less "/share/<token>" strings
    // in the user's copied link. The browser origin is always correct
    // because the user is literally on that origin right now.
    const url =
      typeof window !== "undefined" && window.location?.origin
        ? `${window.location.origin}/share/${encodeURIComponent(data.token)}`
        : data.url;

    return { ok: true, data: { ...data, url } };
  }

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const reason = (body.error ?? "unknown") as CreateShareError;

  return { ok: false, reason };
}

export async function revokeShare(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/share/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });

    return res.ok;
  } catch {
    return false;
  }
}
