# Frontend Security Audit — 2026-08-24

**Target:** `/Users/softaims/pdf-viewer-app` (Next.js 16, App Router, Clerk, HeroUI)
**Method:** Static review + `bun audit`

## Severity counts

`bun audit`: **74 total** — 1 Critical / 40 High / 28 Moderate / 5 Low

Plus in-code findings: CSP absence, missing global headers, CSRF gaps on `/api/share/*`, no cookie-consent, no SRI, Sentry email PII, `sentry-test` route left in prod.

## Top 10 fixes (ranked)

| # | Severity | Location | Issue | Fix | Locked-path? |
|---|---|---|---|---|---|
| 1 | HIGH | `package.json` — pdfjs-dist 5.6.205 | GHSA-hq66-cqwq-w95j — arbitrary JS via crafted PDF (RCE-in-tab) fixed ≥6.2.108. Malicious PDF via upload or `/share/*` → Clerk session exfil | Upgrade pdfjs-dist to ≥6.2.108; re-run full mobile checklist (Safari polyfills) | YES — `lib/client/pdf-editor/load-pdfjs.ts`, `pdfjs-polyfills.ts` |
| 2 | HIGH | `next.config.mjs` | No global Content-Security-Policy; third-party surface wide (Weglot, Trustpilot, Clerk, Solidgate iframe, Google Picker, MS Graph, Sentry) → unbounded XSS blast radius | Add global `headers()` CSP with `script-src` allowlist + `frame-ancestors 'none'` | No |
| 3 | HIGH | `package.json` — axios 1.15.2 | 13 CVEs incl. credential leak + prototype-pollution MITM; fixed ≥1.16.0. All API calls flow through `lib/config/api-client.ts` | `bun add axios@latest` | No |
| 4 | HIGH | `package.json` — next 16.2.4 | 8 advisories: middleware/proxy bypass, rewrites SSRF, Server-Action DoS, Image-Optimizer SVG DoS | Upgrade to latest 16.x | No |
| 5 | HIGH | `next.config.mjs` | No global HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options. Only set on `/share/*` + `/api/share/*` | Add globally in `headers()`: HSTS, nosniff, Referrer-Policy, Permissions-Policy, and set `frame-ancestors 'none'` in CSP | No |
| 6 | CRITICAL | build dep | node-tar decompression DoS via `@tailwindcss/oxide` (build-time only) | `bun update @tailwindcss/oxide` | No |
| 7 | HIGH | `/api/share/verify-password` | Rate limit uses in-memory `Map`; multi-container deploy multiplies effective cap | Move to Upstash/Redis (already TODO'd) | No |
| 8 | HIGH | `package.json` — fabric | Upgrade advisory affects editor; touches locked hooks | Test upgrade carefully; may require code adjustments | YES — `use-fabric-canvas.ts`, `use-edit-text-mode.ts`, `PdfViewerCanvas.tsx` |
| 9 | HIGH | third-party scripts | No SRI on Weglot, Trustpilot, Solidgate CDN — supply-chain compromise → full XSS | Add `integrity="sha384-..."` + `crossorigin="anonymous"` where CDN supports it | No |
| 10 | MEDIUM | `app/sentry-test/` route in prod | Test route leaks Sentry DSN behavior + can be triggered by anyone | Delete route or gate behind `NODE_ENV !== 'production'` | No |

## Detailed findings

### Client-side XSS
- No `innerHTML =`, `document.write`, `eval`, `Function()` found ✅
- One `dangerouslySetInnerHTML` — Trustpilot snippet in `app/layout.tsx:129`. Static string, safe.

### CSP + security headers
- **Missing globally.** `next.config.mjs:47-106` only sets COOP + per-path headers for `/share/*` and `/api/share/*`.
- Fix: extend `headers()` to `source: '/(.*)'`.

### Cookies
- ✅ `lib/server/share/view-cookie.ts` — HttpOnly + Secure + SameSite=Lax + path-scoped + 5-min TTL + HMAC-signed + timing-safe compare.

### Secrets in bundle
- **Zero hardcoded API keys** in `app/`, `components/`, `lib/`. ✅
- 15 `NEXT_PUBLIC_*` vars — all safe-to-ship.
- Server-only secrets correctly lack `NEXT_PUBLIC_` prefix ✅
- `.env` gitignored ✅

### Auth chain (CLAUDE.md 21-item contract)
- Reviewed items 1–14 and 21. **No regressions found.** All invariants intact.

### Third-party scripts (loaded before consent — GDPR concern)
- `cdn.weglot.com/weglot.min.js`
- `invitejs.trustpilot.com/tp.min.js`
- `cdn.charge-auth.com` (Solidgate)
- `apis.google.com` / `accounts.google.com` (Google Drive Picker)
- `login.microsoftonline.com` / `graph.microsoft.com` (OneDrive Picker)
- `clerk.pdfvault.ai` (Clerk hosted)
- Sentry client bundle

### Good hygiene preserved
- View-cookie hardened ✅
- Share route magic-byte `%PDF-` check ✅
- Sentry `beforeSend` scrubs Authorization/Cookie headers + `scrubUrl()` ✅
- No dangerous JS eval-family calls ✅

## Fixes touching locked paths (need user approval)

- pdfjs-dist upgrade → `lib/client/pdf-editor/load-pdfjs.ts`, `pdfjs-polyfills.ts`
- fabric major upgrade → `use-fabric-canvas.ts`, `use-edit-text-mode.ts`, `PdfViewerCanvas.tsx`

All other Top-10 fixes are `next.config.mjs` / dependency-only / new-file work — no locked paths.
