# Public Share Links — Backend Contract

**Audience:** Backend engineering team. Read with [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md).
**Purpose:** Specify exactly what the backend needs to provide so that the public share-link feature — shipped in the frontend on **2026-06-15** — can run in production at scale.
**Last updated:** 2026-06-15

---

## TL;DR for the backend team

The frontend ships a fully working public share-link UX today. Tokens are HMAC-signed in the Next.js server, password hashes are computed there, and PDF bytes are streamed back to the recipient — but **all four state stores currently live in-process memory inside the web-app server**. That means every deploy wipes existing shares and a horizontally-scaled deployment will see different shares per instance.

You don't need to redesign the feature. You need to **expose four small storage/lookup endpoints** (or take ownership of the four interfaces) so that the frontend route handlers can swap their in-memory `Map`s for persistent backend calls without any change to the user-facing behavior or contract.

The four stores are:

| Store | Today (frontend, in-memory) | Production (your service) |
|---|---|---|
| **Bytes store** — the PDF | `Map<jti, Uint8Array>` | Object storage (S3 / R2) addressed by `jti`, OR reuse existing document storage and store `documentId` instead |
| **Password store** — bcrypt hash per share | `Map<jti, string>` | DB row (or KV) keyed by `jti` |
| **Deny-list** — revoked `jti`s | `Map<jti, expiry>` | DB row (or KV) keyed by `jti` |
| **Rate-limit counters** — password attempts per `jti` | `Map<jti, { count, windowStart }>` | Upstash / Redis sliding window |

Two integration shapes are acceptable. Pick whichever is faster for your team:

- **Shape A — Backend hosts all four stores behind one REST endpoint set.** The frontend's route handlers continue to exist (they do the HMAC work, password compare, cookie minting) but their `bytesStore.put` / `.get` / etc. calls become `fetch` calls into your service.
- **Shape B — Backend hosts share creation + viewing end-to-end and the frontend just routes traffic.** The frontend `/share/[token]` page server-renders by calling your backend; the route handlers under `/api/share/*` become thin proxies. More work for you, but the persistence story is cleaner.

The rest of this document specifies the contract precisely enough to implement either shape.

---

## 1. The token (do not change without coordinating)

Tokens are issued by the frontend (today) and may move to the backend later. Either way:

- Algorithm: **HMAC-SHA256**.
- Wire format: `<base64url(payload)>.<base64url(signature)>` — a compact custom format, **not a JWT**. JWTs are deliberately avoided to remove the `alg:none` / key-confusion surface.
- Signing key: a single env var `SHARE_SECRET` — must be the same value across every server that signs or verifies tokens. **At least 32 bytes of entropy.** Generate with `openssl rand -base64 48`.
- Verification: constant-time HMAC compare (no early-exit).
- Payload claims:

  ```json
  {
    "v": 1,
    "did": "<documentId or jti>",
    "oid": "<owner's Clerk user id>",
    "iat": 1733000000000,
    "exp": 1733600000000,
    "jti": "<32 hex chars — 128 random bits>",
    "pw": 1,
    "name": "report-q4.pdf"
  }
  ```

  - `v`: schema version. Bump if any other claim changes shape.
  - `did`: opaque to the recipient. Frontend uses `did === jti` today; backend may store the real document id here.
  - `oid`: used for owner-only operations (revoke).
  - `iat` / `exp`: unix epoch **milliseconds**, not seconds.
  - `jti`: the storage / deny-list / password key. Must be cryptographically random.
  - `pw`: present (value `1`) **only** if the share has a password. Never embed the password or its hash in the token.
  - `name`: display only, shown on the viewer page header.

- TTL range enforced server-side: **1 hour minimum, 30 days maximum**. Reject anything outside that range with HTTP 400 / `expiry-out-of-range`.

---

## 2. The four required operations

Each operation maps to a frontend route handler (in `app/api/share/*`). You can implement each operation either as (a) a method on a stateful store the frontend calls in-process (no network) or (b) an authenticated REST endpoint the frontend `fetch`es. The signatures below describe the contract regardless of transport.

### 2.1 Create share

Called from `POST /api/share/create` after the frontend has already authenticated the user via Clerk, validated the file (`%PDF-` magic bytes, ≤ 25 MB), and clamped the expiry. Frontend then needs the backend to:

1. **Persist the PDF bytes** so they're retrievable for `expiresAt` ms.
2. **Persist the password hash** if `password` was set (frontend has already bcrypted it at cost 12).

```ts
backend.shares.create({
  jti:          string,    // 32 hex chars
  ownerId:      string,    // Clerk user id
  bytes:        Uint8Array,
  expiresAt:    number,    // unix epoch ms
  passwordHash: string | null,
  name:         string,    // display only
}): Promise<{ ok: true }>;
```

Return error shape (HTTP 4xx if remote): `{ ok: false, reason: "rejected" | "quota-exceeded" | "internal" }`.

Frontend already does input validation; the backend only needs to enforce **storage quotas / abuse limits** if any.

### 2.2 Resolve share

Called from `GET /api/share/resolve?t=<token>` on every recipient visit. The frontend verifies the HMAC + expiry **before** calling the backend (cheap, no DB hit on garbage tokens). It then needs to know:

1. Does this `jti` still have bytes? (Not 404'd, not revoked.)
2. Is this `jti` on the deny-list?

```ts
backend.shares.lookup({
  jti: string,
}): Promise<
  | { ok: true; hasBytes: true; revoked: false }
  | { ok: true; hasBytes: false; revoked: false }    // expired / never existed
  | { ok: true; hasBytes: true;  revoked: true  }    // owner revoked
>;
```

(Frontend reads `hasBytes` + `revoked` to decide the user-visible reason — `not-found` / `revoked`.)

### 2.3 Verify password & fetch hash

Called from `POST /api/share/verify-password` when the share has a password set. The frontend handles bcrypt comparison itself (it has `bcryptjs` already) — backend just needs to return the hash and a "yes this share exists" answer.

```ts
backend.shares.getPasswordHash({
  jti: string,
}): Promise<
  | { ok: true; hash: string }
  | { ok: false; reason: "not-found" | "revoked" }
>;
```

**Rate limiting** lives on the backend if backed by Redis (preferred), or the frontend if not. Either way the rule is fixed: **10 failed password attempts per `jti` per 15 minutes**, then a 1-hour lockout. Track by `jti`, not by IP — defeats IP rotation.

### 2.4 Stream bytes

Called from `GET /api/share/bytes/[token]` after the frontend has verified the HMAC, the deny-list, AND the short-lived view cookie. The frontend then needs the bytes:

```ts
backend.shares.streamBytes({
  jti: string,
}): Promise<
  | { ok: true; bytes: ReadableStream<Uint8Array> | Uint8Array; mime: "application/pdf" }
  | { ok: false; reason: "not-found" | "revoked" }
>;
```

The response back to the recipient already has the right headers wired by the frontend — `Content-Type`, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`. The backend just needs to deliver the bytes.

### 2.5 Revoke share

Called from `POST /api/share/revoke`. Frontend verifies Clerk auth, verifies the token, and confirms `claims.oid === userId`. Then:

```ts
backend.shares.revoke({
  jti:       string,
  expiresAt: number,   // so the deny-list entry can be GC'd after this
}): Promise<{ ok: true }>;
```

Must also delete the password hash and the bytes (or mark them so future `lookup` returns `revoked: true`).

---

## 3. Database schema (one table is enough)

Minimal schema. Adapt to whatever ORM / DB the backend already uses.

```sql
CREATE TABLE shares (
  jti              CHAR(32)  PRIMARY KEY,           -- 128 random bits, hex-encoded
  owner_id         TEXT      NOT NULL,              -- Clerk user id
  document_id      TEXT      NULL,                  -- if reusing existing document storage
  bytes_url        TEXT      NULL,                  -- if bytes live in object storage
  display_name     TEXT      NOT NULL,
  password_hash    TEXT      NULL,                  -- bcrypt; null = no password
  created_at       BIGINT    NOT NULL,              -- unix epoch ms
  expires_at       BIGINT    NOT NULL,              -- unix epoch ms
  revoked_at       BIGINT    NULL,                  -- null = active
  view_count       INTEGER   NOT NULL DEFAULT 0     -- optional; bumped on every byte fetch
);

CREATE INDEX shares_owner_id_idx ON shares (owner_id);
CREATE INDEX shares_expires_at_idx ON shares (expires_at);  -- for GC job
```

**Garbage collection job (recommended hourly):** `DELETE FROM shares WHERE expires_at < NOW()_ms;` — plus delete the corresponding object-storage blobs.

**Optional `share_password_attempts` table** if you do rate-limiting in DB rather than Redis:

```sql
CREATE TABLE share_password_attempts (
  jti          CHAR(32)  NOT NULL,
  attempted_at BIGINT    NOT NULL,
  PRIMARY KEY (jti, attempted_at)
);
CREATE INDEX share_password_attempts_jti_idx ON share_password_attempts (jti, attempted_at);
```

Or just put it in Upstash with a sliding-window key like `share:rl:<jti>`.

---

## 4. Where the PDF bytes should live

Three options, pick one. They're equivalent from the frontend's perspective.

**Option A — Reuse existing document storage.** When the user clicks "Share via link", the frontend uploads the bytes once to **the existing document library API** (it already does this for cloud-saved docs), gets back a `documentId`, then calls `shares.create({ documentId, ... })`. The `shares` row stores only the `documentId`; on `streamBytes` the backend resolves the document and streams it back.
- **Pros:** No duplicate copy, no new object-storage bucket, audit log is unified.
- **Cons:** Shares need read access to documents that may be in another user's library scope — careful permission model.

**Option B — Dedicated `shares/` object-storage bucket.** New S3 / R2 bucket, public-write-no-public-read. `shares.create` writes `{jti}.pdf` into it. `streamBytes` reads it back. GC job sweeps expired keys.
- **Pros:** Clean separation, no ACL crossover with the document library.
- **Cons:** Bytes are duplicated (one copy in document library + one in shares bucket).

**Option C — Inline in DB.** `bytea` column. Only viable if average shared PDF is < 1 MB and total shares fit in DB storage budget.
- **Pros:** Simplest. One backup target.
- **Cons:** Bloats DB, hot pages for binary blobs, terrible for large files.

The frontend's current 25 MB-per-share limit was chosen with Option A or B in mind. If you go Option C, drop it to ~2 MB.

---

## 5. Auth / authorization model

| Endpoint | Who can call | How auth is enforced |
|---|---|---|
| `POST /api/share/create` | Signed-in users only | Clerk session middleware (frontend already does this; if backend takes over, validate the Clerk session JWT or service-account header) |
| `POST /api/share/revoke` | Owner only | `claims.oid === Clerk.userId` — checked by frontend today; backend can re-check on its side |
| `GET /api/share/resolve` | Public | None — token IS the auth |
| `POST /api/share/verify-password` | Public | None — token IS the auth |
| `GET /api/share/bytes/[token]` | Public, cookie-gated | Frontend verifies the `share_view` cookie; backend just trusts the call from the frontend route handler |

If backend takes over the resolve/bytes endpoints directly (Shape B), the share-view cookie validation needs to move backend-side too. The cookie is its own HMAC-signed `{ jti, exp }` payload with a separate derived secret (`SHARE_SECRET + ":view"`).

---

## 6. Security requirements (non-negotiable)

These already hold in the frontend implementation. Whichever shape the backend takes, they must continue to hold.

1. **Bcrypt cost ≥ 10**, recommended **12**. Use a battle-tested library — `bcrypt` (native, Node) or `bcryptjs` (pure JS, ideal for serverless). Do not roll your own.
2. **Constant-time comparisons** for both the HMAC signature and the bcrypt result. Standard library `crypto.timingSafeEqual` / `bcrypt.compare` covers this.
3. **Never log the token or the password.** Logs may include `jti` and `ownerId` for debugging.
4. **Never embed the password hash in the token.** Token leaks would become offline-crackable hashes.
5. **Per-`jti` rate limit on password attempts:** 10 failed attempts / 15 min, then 1-hour lockout. Return `429` with `Retry-After` header.
6. **Per-IP rate limit on token-resolve:** 30 req/min as a circuit breaker.
7. **Bytes endpoint requires a valid `share_view` cookie**, not just a valid token. The cookie is scoped to `/api/share/bytes/<token>` so it can't leak across shares.
8. **Magic-byte PDF sniff** on upload (`%PDF-` = `25 50 44 46 2D`). Don't trust the client-set MIME type.
9. **Hard 25 MB upload limit** (current). Bump only after sizing object storage.
10. **No CDN caching of any share response.** Frontend sets `Cache-Control: private, no-store` on every response in this family; backend must do the same.
11. **No search-engine indexing.** `X-Robots-Tag: noindex, nofollow, noarchive` on `/share/*`. Already set.
12. **No referrer leak.** `Referrer-Policy: no-referrer` on both the viewer page and the API. Already set.
13. **No iframe embedding.** `X-Frame-Options: DENY` on `/share/*`. Already set. (If you want to allow specific embeds, change to a CSP `frame-ancestors`.)

OWASP references this design was checked against:
- ASVS 4.0 §2 (Auth), §3 (Session), §6 (Crypto), §7 (Error Handling), §11 (Business Logic).
- Cheat Sheet — Password Storage (bcrypt cost guidance).
- API Security Top 10 2023 — API1 (BOLA, addressed via token + owner check on revoke) and API4 (Resource consumption, addressed via rate limiting + size cap).

---

## 7. Today's implementation map (what already exists in the frontend repo)

These files implement the contract above against in-memory storage. When you take over, the call sites swap their imports — the route-handler logic stays identical.

```
lib/server/share/
  sign-token.ts        ← HMAC + verify (unchanged after handoff)
  view-cookie.ts       ← Short-lived view cookie HMAC (unchanged after handoff)
  password.ts          ← bcryptjs hash/compare + PasswordStore interface (impl swaps)
  bytes-store.ts       ← BytesStore interface (impl swaps)
  deny-list.ts         ← DenyList interface (impl swaps)

app/api/share/
  create/route.ts            ← POST  — Clerk-authed
  resolve/route.ts           ← GET   — public
  verify-password/route.ts   ← POST  — public, rate-limited
  bytes/[token]/route.ts     ← GET   — public, cookie-gated
  revoke/route.ts            ← POST  — owner-only

app/share/[token]/
  page.tsx           ← server component, force-dynamic, robots-noindex
  PasswordGate.tsx   ← client, RHF + fetch verify-password
  ViewerClient.tsx   ← client, read-only pdf.js via loadPdfJs

components/sections/pdf-editor/
  ShareModal.tsx     ← the owner's create-share UI

lib/client/api/
  shares.ts          ← typed client (createShare, revokeShare)
```

Three pieces of glue change after the handoff:

1. The three `*Store` impls in `lib/server/share/` get a network-backed replacement (or a thin adapter to your existing backend SDK).
2. `app/api/share/*` route handlers' imports point at the new impls. Nothing else.
3. `INFRASTRUCTURE.md` "Public share links" note about in-memory state gets dropped.

---

## 8. Acceptance criteria (for the backend handoff PR)

A backend implementation is ready to swap in when **all** of the following hold:

- [ ] An owner can create a share, close the browser tab, **the web-app server is restarted**, and the recipient can still open the link.
- [ ] An owner can create a share, the link is served via **two different web-app instances behind a load balancer**, and both instances return the same PDF to the recipient.
- [ ] Owner revokes a share — the next viewer access (any instance) returns the "revoked" page within 5 seconds.
- [ ] A recipient makes 11 wrong-password attempts to the same share inside 15 minutes — the 11th returns HTTP 429 with `Retry-After`.
- [ ] A recipient with a leaked token but no valid `share_view` cookie gets HTTP 401 from the bytes endpoint.
- [ ] Expired shares are GC'd from storage within an hour of `expires_at`.
- [ ] The bcrypt hash is **never** sent to the recipient's browser. (Verify with DevTools network tab.)
- [ ] `SHARE_SECRET` is identical across every server that signs or verifies tokens. Rotating it invalidates every existing share.
- [ ] Frontend smoke test passes: create → open in incognito → password gate → view → revoke → "unavailable" page.

---

## 9. Open questions for the backend team

These need product/eng decisions before implementation lands. None block the contract above.

1. **Do you want view-count tracking?** Cheap (one `UPDATE shares SET view_count = view_count + 1` per `streamBytes`). Useful for the owner's dashboard but adds write traffic.
2. **Do you want max-views?** E.g., "expires after 5 views or 7 days, whichever first." Trivial to add to `lookup`.
3. **Owner-facing share list / dashboard.** Not built yet on the frontend. The backend can already provide `GET /shares?ownerId=<me>` and the frontend will wire the UI.
4. **Audit log.** Should each `create / revoke / open` write an entry to the existing activity feed? If yes, the backend wires it on create / revoke calls.
5. **Watermarking.** Some products burn the viewer's IP and access timestamp into the rendered PDF on every download. Not in scope for this feature, but the contract above doesn't preclude it — `streamBytes` can take an optional `watermark` payload.
6. **Notification on first view.** Email/in-app ping to the owner the first time their share is opened. Out of scope, but easy to add at `streamBytes` time.

---

*This contract was written from the working frontend implementation on 2026-06-15. Any deviation from the token shape, the store interfaces, or the security requirements above must be discussed with the frontend team before being implemented — the frontend route handlers depend on these specifics.*
