# PDFVault — Production Readiness Checklist

Owner: Hamza · Prepared: 2026-08-08
Scope: everything that must be verified before we open pdfvault.ai to public users.

Use the checkboxes as a working sign-off sheet. Anything left unchecked is a launch blocker unless explicitly waived, in writing, with the risk noted.

---

## 0. Definition of "production"

- [ ] Public DNS points at the production ALBs (frontend + backend), not staging.
- [ ] Both apps read from **production** databases, buckets, queues, and third-party accounts — never a staging Clerk/CloudConvert/Solidgate/S3.
- [ ] All `NODE_ENV=production` and equivalent flags are set on every runtime.
- [ ] The word "staging" does not appear anywhere the user can see (banners, footer, meta tags, analytics property names).

---

## 1. Third-party services

Every external dependency needs a production account, production keys stored in the production secrets vault, and a documented failure/support path. One row per vendor.

### 1.1 Clerk (authentication)

- [ ] Separate **production Clerk instance** provisioned (not sandbox / development).
- [ ] Production `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWKS_URL`, `CLERK_WEBHOOK_SECRET` in secrets manager.
- [ ] Production instance settings match app assumptions:
  - Email verification code enabled as **first-factor** sign-in strategy (PRD §3 dependency — new email-OTP flow won't complete without this).
  - Password policy relaxed to accept **8+ alphanumeric** (PRD §4 dependency).
  - Google OAuth app pointing at the production redirect URIs (`/sso-callback`).
  - 2FA options match what the login card handles (email_code / phone_code / TOTP / backup_code).
- [ ] JWKS endpoint reachable from the backend VPC / egress.
- [ ] Clerk webhooks endpoint on the backend is registered in the Clerk dashboard, signature-verified with the production `CLERK_WEBHOOK_SECRET`, and covered by the backend's replay-protection logic.
- [ ] Rate limits reviewed against expected sign-up burst; contact Clerk support if a launch spike is planned.
- [ ] Fallback plan documented: what do we do if Clerk has an outage during launch?

### 1.2 Solidgate (payments)

- [ ] `SOLIDGATE_ENV=production` on the backend, with production `MERCHANT_ID`, `PUBLIC_KEY`, `SECRET_KEY`, `WEBHOOK_PUBLIC_KEY`, `WEBHOOK_SECRET_KEY`.
- [ ] Production and sandbox keys stored under different Secrets Manager names — no way to mix them by accident.
- [ ] Solidgate merchant account has the correct legal entity on file (**FLUTTWINGS INVESTMENTS LIMITED**, Cyprus, per recent commits).
- [ ] Apple Pay domain association file live at `/.well-known/apple-developer-merchantid-domain-association`, verified by Apple through Solidgate. Confirm in Solidgate Hub → Payment Methods → Apple Pay.
- [ ] Google Pay production merchant ID configured; production domain whitelisted.
- [ ] Webhook endpoint (`/webhook/solidgate` on the backend) registered with the production webhook signing key and covers: `order.approved`, `order.declined`, `subscription.status_changed`, `subscription.cancelled`, `subscription.finished`, `card.declined`, and any refund/chargeback events the backend consumes.
- [ ] Test the full flow end-to-end with a real (small) charge on a live card BEFORE public launch. Refund the test charge and archive the receipt.
- [ ] Refund process runbook exists (`docs/` — mirror the existing `2026-07-31-solidgate-audit.md` spec into a runbook if not already).
- [ ] Chargeback handling: who gets the email, who logs into Solidgate Hub, what's the SLA?
- [ ] `BILLING_ENABLED=true` on production backend at launch time (currently `false` per `.env.example`).

### 1.3 CloudConvert (file conversion)

- [ ] Production `CLOUDCONVERT_API_KEY`, `CLOUDCONVERT_SANDBOX=false`, `CLOUDCONVERT_DISABLED=false`.
- [ ] Paid plan sized for expected conversion volume. Confirm minute quota + concurrency limits and set a **monthly spend cap alert** in the CloudConvert dashboard so a bug can't drain the balance overnight.
- [ ] Test every conversion route we advertise (`pdf-to-word`, `word-to-pdf`, `pdf-to-excel`, `excel-to-pdf`, `pdf-to-jpg`, `pdf-to-png`, `pdf-to-powerpoint`, `pdf-to-html`, `pdf-to-text`, `powerpoint-to-pdf`, `txt-to-pdf`) against production CloudConvert with a real file. Log the time-to-first-byte for capacity planning.
- [ ] `CONVERSION_TIMEOUT_MS` set to a value that matches the CloudConvert job-timeout policy (default 300000ms = 5min).
- [ ] Fallback: the backend already has "manual adapters" toggle (`CLOUDCONVERT_DISABLED=true`) — confirm the manual pipeline works for at least PDF↔DOCX in case CloudConvert has an incident.
- [ ] Webhook / polling strategy verified: how do we know when a job finishes? Any retry storm risk on 5xx from CloudConvert?
- [ ] Support contact & escalation path recorded.

### 1.4 AWS S3 (file storage)

- [ ] Production S3 bucket (`AWS_S3_BUCKET`) exists, region matches `AWS_REGION`, and is **not** the staging bucket.
- [ ] Bucket policy: block **all public access** at the account level. Objects served via signed URLs only.
- [ ] Object lifecycle rules configured:
  - Automatic deletion of `/uploads/` scratch files after N hours (matches the "we don't store contents" claim in About Us / Privacy).
  - Retention for user-saved documents defined and documented.
- [ ] Versioning enabled on the bucket so accidental deletes are recoverable.
- [ ] Server-side encryption (SSE-S3 or SSE-KMS) enabled by default.
- [ ] CORS on the bucket restricted to the production frontend origin(s) only.
- [ ] IAM role used by the backend has **least-privilege** access to only this bucket + the specific prefixes it needs. No `s3:*` on `*`.
- [ ] `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` used only if IAM role assumption isn't available; prefer instance/task IAM roles on ECS/EC2.

### 1.5 AWS SES (transactional email)

- [ ] SES **out of sandbox** for the production account (24-hour sending limit lifted).
- [ ] `SES_FROM_ADDRESS` (`receipts@pdfvault.ai`) + `SES_REPLY_TO` (`support@pdfvault.ai`) both verified.
- [ ] Domain verified with **DKIM** signing enabled (three CNAME records on the pdfvault.ai DNS zone).
- [ ] **SPF** record on pdfvault.ai includes SES.
- [ ] **DMARC** policy on pdfvault.ai set to at minimum `p=quarantine` (start with `p=none` if you need a monitoring period, then tighten).
- [ ] Bounce + complaint SNS topics wired up — a spike in either kills SES reputation fast.
- [ ] Test send of every automated email template (welcome, receipt, sign-in code, cancellation confirmation, password reset if used, contact-form receipt).
- [ ] Suppression list monitored; support inbox knows how to remove a legitimately-suppressed address.

### 1.6 Weglot (translation)

- [ ] Production Weglot API key, correct destination languages configured.
- [ ] The switcher fences in `globals.css` (`.country-selector`, `.wg-drop`, etc.) still hide any floating switcher — confirm on staging with production Weglot key before flipping DNS.
- [ ] Billing plan matches expected pageview volume; overage behavior known.
- [ ] Custom-domain translation URLs / SEO strategy decided.

### 1.7 Google Drive + Microsoft OneDrive pickers (optional but wired)

- [ ] Production `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — the Google Cloud project is in **"In production"** state, OAuth consent screen passed review (or is explicitly limited to test users).
- [ ] Production `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID`, Azure AD app in production, redirect URIs point at production `/oauth-callback`.
- [ ] Scopes requested match what the picker actually needs (read-only file access) — no over-scoping.
- [ ] `Cross-Origin-Opener-Policy: same-origin-allow-popups` header confirmed live on the production edge (already set in `next.config.mjs`; verify it survives whatever proxy/CDN sits in front).

### 1.8 Redis / BullMQ (backend queue)

- [ ] Production Redis endpoint provisioned (managed — ElastiCache / Upstash / Railway) with authentication and TLS.
- [ ] `REDIS_URL` in backend secrets uses `rediss://` (TLS).
- [ ] Redis persistence configured (RDB snapshots or AOF) matching how much job state we can afford to lose.
- [ ] Queue names namespaced by env so a staging worker can't ever pull a production job.
- [ ] Dead-letter / retry policy defined per queue (conversion, email, webhooks) — no infinite loop on a poison message.

### 1.9 Postgres (backend database)

- [ ] Production database (managed — RDS / Aurora / Railway Postgres) with **automated backups** enabled, 7+ day retention, point-in-time recovery on.
- [ ] `DATABASE_URL` secret is production-only, credentials rotated from any that were shared during development.
- [ ] Read-replica planned if analytics queries will hit prod (not launch-blocking, but decide the strategy now).
- [ ] Prisma migrations reviewed for any that lock a big table under load. Have a plan for zero-downtime migration if one is queued.
- [ ] Connection pool size × pod count ≤ Postgres `max_connections`. Add PgBouncer if that math doesn't work.

---

## 2. Secrets, config, and environments

- [ ] Every secret in the two `.env.example` files (backend + frontend) is present in the production secrets manager (AWS Secrets Manager / Parameter Store / equivalent).
- [ ] No production secret has ever been committed to git — grep the whole history for known prefixes (`sk_live`, `api_sk_`, `wh_sk_`, `AKIA`, etc.). If found, **rotate immediately**.
- [ ] `.env.example` reflects the current variables; no orphaned or missing keys.
- [ ] Config precedence documented: env var overrides > `.env` > default. No "hidden" defaults that only work in dev.
- [ ] Rotation policy: which secrets get rotated on what schedule, and who's on the hook.

---

## 3. Domain, DNS, TLS, CDN

- [ ] `pdfvault.ai` (apex) + `www.pdfvault.ai` both resolve to the frontend ALB / CDN.
- [ ] Backend API domain (e.g. `api.pdfvault.ai`) resolves to the backend ALB.
- [ ] TLS certificates issued and auto-renewing (ACM if AWS, otherwise Let's Encrypt with a monitored cron).
- [ ] HTTPS enforced everywhere (HTTP → HTTPS 301 at the ALB / edge).
- [ ] `Strict-Transport-Security` header set with `max-age=31536000; includeSubDomains; preload`.
- [ ] CDN (CloudFront / Cloudflare) sits in front of the frontend for static asset caching. Cache headers on Next.js `/_next/static/**` are `public, max-age=31536000, immutable`.
- [ ] Apple Pay `.well-known` file is served over HTTPS on the same origin as the checkout (no redirect chain), and returns the raw hex-decoded content (see `docs/` history).
- [ ] `robots.txt` and `sitemap.xml` are correct for production (allow indexing, list the public marketing pages, disallow the app routes).

---

## 4. Monitoring, alerting, observability

- [ ] Application logs stream to a central log store (CloudWatch / Loki / Datadog). Grepable by request ID.
- [ ] Metrics dashboard live for: request rate, p50/p95/p99 latency, 5xx rate, database connection pool usage, Redis queue depth, CloudConvert job success/failure rate, Solidgate webhook success/failure rate.
- [ ] Alerts wired up (PagerDuty / Slack / email) for at minimum:
  - Backend 5xx rate > 1% for 5 min.
  - CloudConvert failure rate > 5% for 10 min.
  - Solidgate webhook 5xx or signature-failure rate > 0.
  - Postgres CPU > 80% or connection pool > 80%.
  - Redis memory > 80% or evictions > 0.
  - SES bounce rate > 5% or complaint rate > 0.1%.
  - CloudConvert monthly spend > 80% of budget (via CloudConvert-native alert or CloudWatch billing).
  - AWS bill anomaly detection ON.
- [ ] Uptime monitoring (Pingdom / Better Stack / Route 53 health checks) on the marketing homepage, the sign-in page, and a health-check endpoint on the backend.
- [ ] Frontend error tracking (**Sentry** or equivalent) installed. **Not currently in `package.json`** — see the frontend audit for details. This is a launch-recommended add.
- [ ] Backend uses `nestjs-pino` — confirm log level is `info` in prod (not `debug`), request IDs are propagated, and no PII / file content is logged.

---

## 5. Rate limiting, abuse prevention, security

- [ ] Backend `@nestjs/throttler` is registered globally (`app.module.ts` — confirmed). Verify the buckets (short + long) match your realistic worst-case legitimate traffic without blocking real users.
- [ ] CORS `CORS_ORIGINS` env is set to the **production** frontend domain(s) only. No `*`, no staging URLs.
- [ ] A WAF (AWS WAF, Cloudflare, or the ALB's own managed rules) sits in front of the backend with at least: SQL injection, XSS, path traversal, and known-bad-bot rules turned on.
- [ ] File upload endpoints enforce max file size (currently the UI says 100MB — confirm the backend + ALB + WAF all agree on the ceiling; a mismatch produces confusing errors).
- [ ] File uploads scanned for content-type mismatch (a `.pdf` that isn't actually a PDF).
- [ ] Rate-limit + abuse rules on: sign-up endpoint (Clerk-side + our side), password reset, contact form (already Throttler-guarded per code comment), file-conversion endpoints, download endpoints.
- [ ] CAPTCHA (Cloudflare Turnstile / hCaptcha / Google reCAPTCHA) on sign-up + contact form if abuse is expected.
- [ ] Security headers set: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a sensible `Content-Security-Policy` (audit which third-party scripts we load — Clerk, Weglot, Solidgate, Google Pay, Apple Pay, analytics).
- [ ] Secrets rotation runbook in place for a leaked-key incident (Clerk, Solidgate, AWS, CloudConvert, Google/Microsoft OAuth).

---

## 6. Data protection & compliance

- [ ] Legal entity + address on file with every vendor is **FLUTTWINGS INVESTMENTS LIMITED**, Cyprus (matches the footer + Privacy Policy).
- [ ] Privacy Policy, Terms and conditions, Refund Policy, Cookie Policy, Do Not Sell, Contact page all live at `/privacy`, `/terms-and-conditions`, `/refund`, `/cookies`, `/do-not-sell`, `/contact` — verify links from footer, sign-up card, and checkout page all work.
- [ ] New **About Us** page (`/about`) + **Subscription Terms** page (`/subscription-terms`) are linked from the footer + checkout copy where relevant.
- [ ] **GDPR**: cookie consent banner behavior verified (accept / reject / manage). No non-essential trackers fire before consent. "Do Not Sell" workflow tested for CA users.
- [ ] **GDPR data-subject requests**: email inbox and process defined for `support@pdfvault.ai` to receive access / deletion requests, and the backend has a way to actually delete a user's account + data.
- [ ] **PCI-DSS**: since Solidgate iframes handle card entry, we should be **SAQ-A** scope. Confirm this with Solidgate in writing. No card data ever touches our servers or logs.
- [ ] **EU/UK 14-day withdrawal**: checkout enforces the explicit consent checkbox referenced in the Subscription Terms PDF's INTERNAL NOTE. Confirm the checkbox is not pre-ticked and is placed immediately above the Pay / Subscribe button.
- [ ] Data retention policy: how long do we keep saved documents, deleted-user data, logs, backups? Documented publicly (Privacy Policy) and enforced technically (S3 lifecycle, DB purges).
- [ ] Sub-processor list published — CloudConvert, Clerk, Solidgate, AWS, Weglot, Google, Microsoft — with links to each vendor's DPA.
- [ ] DPA (Data Processing Agreement) signed with each sub-processor that handles user data.

---

## 7. Backups, DR, incident response

- [ ] Postgres backups: automated daily + PITR window ≥ 7 days. Test a restore into a scratch instance BEFORE launch, not after an incident.
- [ ] S3 versioning on (already listed under §1.4) — recovery of an accidentally-overwritten user file has been walked through.
- [ ] Redis: is any state critical enough that losing it would be a customer-visible problem? If yes, AOF + snapshot. If no (queue-only, transient), that's fine — document it.
- [ ] Runbook for "backend is down" — steps to check ALB health, logs, DB connectivity, Redis, CloudConvert status page, Solidgate status page.
- [ ] Runbook for "payments are failing" — check Solidgate Hub, webhook logs, dashboard, on-call contact at Solidgate.
- [ ] Status page (StatusGator / Instatus / manual `status.pdfvault.ai`) — decide whether we need one at launch and who updates it.
- [ ] On-call rotation defined even if it's a one-person rotation, with contact info in an off-repo doc.

---

## 8. Analytics & product intelligence

- [ ] Web analytics (GA4 / Plausible / PostHog) picked, deployed, cookie-consent-gated.
- [ ] Conversion funnel events instrumented: landing → sign-up → first upload → first save → checkout view → subscribe → first download after subscribe.
- [ ] Server-side event stream (if using PostHog / Segment) covers webhook events from Solidgate + Clerk so back-office can reconcile without cookies.
- [ ] No PII / file content in any analytics event.

---

## 9. Load & capacity testing

- [ ] Pick a realistic launch scenario (peak concurrent users, uploads per minute, conversion jobs per minute) and load-test against a staging environment that mirrors prod.
  - Suggested tool: k6, Artillery, or Locust.
  - Suggested targets to hit: sign-in flow, upload → convert → download, editor load with a 20MB PDF.
- [ ] Backend autoscaling: does the ECS/EC2/Railway service scale on CPU / RPS? Test that the scale-up happens before you saturate.
- [ ] Postgres: confirm connection pool + PgBouncer (if used) survives max expected worker count × replica count.
- [ ] CloudConvert: confirm your plan's concurrency limit is above the worst realistic burst; if not, upgrade or add queue backpressure BEFORE launch.
- [ ] Frontend CDN cache-hit ratio measured under load — should be > 90% for static assets.
- [ ] Cost per 1000 conversions modeled with real CloudConvert pricing so you know your unit economics before real users show up.

---

## 10. Rollback + change management

- [ ] Both frontend + backend deploys are versioned and one-command reversible (previous ECR image / Railway deployment / Vercel deployment).
- [ ] Feature flag mechanism reviewed. `BILLING_ENABLED` is the biggest one — verify flipping it OFF gracefully hides the paywall without breaking free tools.
- [ ] Database migration policy: never break the previous app version, always deploy migration → new app in that order, keep a "roll forward" mindset (rollbacks of destructive migrations are painful).
- [ ] Git tag the launch commit on both repos (`launch-2026-08-XX` or similar) so "what did we ship?" is answerable.

---

## 11. Human & operational readiness

- [ ] Support inbox (`support@pdfvault.ai`) has a real human checking it. SLA committed to publicly (e.g. "we respond within 24h business days") — matches the FAQ page copy.
- [ ] Billing inbox (`billing@pdfvault.ai`) monitored, with someone who can process cancellation + refund requests in the Solidgate Hub.
- [ ] Legal contact reachable (per the address / entity in the footer).
- [ ] Someone owns each of: uptime, security, billing, support. One person can wear multiple hats, but each must be named — "we'll figure it out" is not a plan on launch day.
- [ ] Off-hours coverage plan for the first 72 hours after launch.

---

## 12. Frontend-specific pre-launch (paired with the code audit)

- [ ] Full mobile pass on iOS Safari + Android Chrome per the 10-step checklist in `CLAUDE.md`.
- [ ] Bundle-analyze the production build (`bunx next build --profile` or `@next/bundle-analyzer`) and confirm no shocks (see audit file).
- [ ] Lighthouse run on landing page: Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95 on desktop; ≥ 60 / 95 / 95 / 95 on mobile.
- [ ] Every route in `app/(landing)/**` prerenders as static (already confirmed in the recent build output — verify again on the launch commit).
- [ ] Weglot switcher renders only the custom `LanguageSwitcher` — no injected Weglot chip anywhere.

---

## 13. Sign-off

- [ ] Product owner (you) signs off in writing.
- [ ] Any unchecked box above is either resolved or explicitly waived with a note here:

  | Waived item | Reason | Owner | Revisit date |
  | ----------- | ------ | ----- | ------------ |
  |             |        |       |              |

Launch time / date fixed only after this sheet is complete.
