# Backend Security Audit — 2026-08-24

**Target:** `/Users/softaims/Downloads/pdf-viewer-backend-main` (NestJS + Prisma)
**Method:** Static review, `npm audit`, no code changes
**AWS account:** 633321546885

## Severity counts

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 6 |
| Medium | ~11 |
| Low | ~6 |
| Info / positives | (see bottom) |

`npm audit`: **30 vulns — 3 low / 7 moderate / 20 high / 0 critical.**

## Top 10 fixes (ranked)

| # | Severity | File | Issue | Fix |
|---|---|---|---|---|
| 1 | HIGH | `src/auth/clerk.strategy.ts:81-83` | Hardcoded admin-email fallback — if `ADMIN_EMAILS` env is missing, `muhammad.hamza@brickslogix.com` silently becomes ADMIN | Remove fallback; throw on missing env in prod |
| 2 | HIGH | `src/redis/redis.controller.ts:82,24` | `POST /cache/refresh` + `GET /cache/metrics` are `@Public()` — unauth can flush Redis (kills BullMQ, SSE, pricing cache) | Gate behind `@Roles(ADMIN)` + auth guard |
| 3 | HIGH | `Dockerfile:28-66` | Node runs as root; ImageMagick PDF policy relaxed at line 55 → RCE in LibreOffice/Ghostscript/IM = container takeover | Add `USER node`, tighten IM policy |
| 4 | HIGH | `src/user/user.service.ts:251-277` | GDPR Art. 17: delete cascades DB rows only; S3 objects orphaned forever | Call `s3Service.deleteMany()` for user's prefix before DB delete |
| 5 | HIGH | `package.json` | 20 high npm CVEs — pdfjs-dist ≤5.5.207 (RCE on malicious PDF, fed via `pdf-to-xlsx-fallback.adapter.ts:80`), sharp <0.35.0 (libvips CVEs), tmp path-traversal, form-data CRLF, ws memory-exhaustion, ip-address SSRF (via geoip-lite) | `npm audit fix`; branch-test `--force` for pdfjs-dist/sharp |
| 6 | HIGH | `src/main.ts` | No `helmet()` middleware — no HSTS, no X-Frame-Options, no nosniff | `app.use(helmet({ contentSecurityPolicy: false }))` (CSP is at edge) |
| 7 | MEDIUM | multiple | Unauth heavy-compute DoS on conversion endpoints | Add `@Throttle` per-IP + per-user; require auth on convert |
| 8 | MEDIUM | share endpoint | Share-bytes route bypasses password gate | Enforce password verification before serving bytes |
| 9 | MEDIUM | `src/main.ts` | `trust proxy: true` (permissive) — XFF header can be spoofed for rate-limit/audit-log bypass | `trust proxy: 1` (single CloudFront hop) |
| 10 | MEDIUM | S3 config | Server-Side Encryption is opt-in per PutObject, not enforced at bucket level | Add bucket default SSE (see AWS audit) + `x-amz-server-side-encryption: AES256` header in code |

## Detailed findings

### A01 Broken Access Control
- **HIGH** `redis.controller.ts` — `POST /cache/refresh` + `GET /cache/metrics` `@Public()`.
- **HIGH** `clerk.strategy.ts:81-83` — admin email fallback.
- **MEDIUM** share endpoint returns bytes without validating share password.
- **MEDIUM** `form-session` — public DELETE + no TTL.
- **MEDIUM** `rebindClerkIdentity` silently reassigns clerk_id without confirmation.

### A02 Cryptographic Failures
- **LOW** bcrypt cost factor not enforced by env; defaults may be low.
- **MEDIUM** S3 SSE opt-in only (see AWS audit for bucket-side fix).

### A03 Injection
- Positive: zero `$queryRawUnsafe` / `$executeRawUnsafe`.
- Positive: `spawn` used with argv arrays, no shell interpolation.
- **LOW** log injection via `file.originalname` (unsanitized into logs — spoofable log entries).

### A04 Insecure Design
- **MEDIUM** heavy CPU endpoints (PDF conversion) reachable without per-user throttling.
- **MEDIUM** no magic-byte verification on `documents/*` and conversion uploads (shares route sniffs `%PDF-`; others don't).
- **MEDIUM** no virus scanning on user uploads (ClamAV / VirusTotal / etc.).

### A05 Security Misconfiguration
- **HIGH** no `helmet`.
- **HIGH** Docker as root.
- **MEDIUM** `trust proxy: true`.
- **LOW** `.env` on host is `-rw-r--r--` (644); should be `600`.
- **INFO** Swagger dev-only ✅.

### A06 Vulnerable Components
- **HIGH** 30 npm vulns. Key packages: `pdfjs-dist`, `sharp`, `tmp`, `form-data`, `ws`, `ip-address`, `brace-expansion`, `fast-uri`, `deepmerge-ts`, `hono`, `socket.io-parser`.

### A07 Authn Failures
- Positive: RS256, issuer pin, JWKS rotation.
- **MEDIUM** no per-jti brute-force lockout (attempted-jwt-replay counter).
- **LOW** no auth-failure log rate for account-lock trigger.

### A08 Software / Data Integrity
- Positive: raw-body-verified webhooks (Clerk + Solidgate) with idempotency ledger.
- **LOW** CloudConvert URL trust (returned URL used for download without re-verifying host allowlist).
- **LOW** presigned URL replay window not minimized.

### A09 Logging / Monitoring
- **LOW** PII (email, user id) present in prod logs without redaction.
- **LOW** log injection via unsanitized `originalname`.

### A10 SSRF
- Positive: no user-controlled `fetch()` / `axios.get()` URLs found.
- Indirect: `ip-address` CVE inside `geoip-lite` could enable SSRF if that dep is upgraded incorrectly.

### GDPR
- **HIGH** Art. 17 — deletion orphans S3 objects (see #4 above).
- **MEDIUM** no user-facing self-service delete endpoint.
- **MEDIUM** no data-export endpoint (Art. 15/20).
- **LOW** PII in logs (Art. 5(1)(c) minimization).

### Secrets scan
- No `sk_live` / `AKIA` / `pk_live` / bearer strings found under `src/`.
- `.env` correctly gitignored + dockerignored ✅.

## Positives worth preserving

- Default-deny guard chain across controllers
- RS256-locked JWT + JWKS rotation + issuer pin
- Raw-body-verified webhooks (Clerk + Solidgate) + idempotency ledger
- Zero `$queryRawUnsafe`
- `spawn` with args array + sandboxed output paths
- Shares upload sniffs `%PDF-` magic
- No user-controlled `fetch()` URLs
- Swagger dev-only
- `.env` gitignored + dockerignored

## Follow-ups (not in-scope of this audit)

- Consider re-running `npm audit fix` and reviewing each `--force` upgrade in a branch (pdfjs-dist major bump, sharp major bump).
- Add integration test for S3-object cascade on user delete.
- Rotate the `.env` on the developer machine (chmod 600).
