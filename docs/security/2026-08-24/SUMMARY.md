# Security Audit Summary — 2026-08-24

**Scope:** AWS infra (acct 633321546885) + backend (NestJS) + frontend (Next.js 16) + GDPR posture
**Method:** Read-only static + AWS CLI describe/list calls; no live probing
**Reports:** [`aws-audit.md`](./aws-audit.md), [`backend-audit.md`](./backend-audit.md), [`frontend-audit.md`](./frontend-audit.md), [`gdpr-audit.md`](./gdpr-audit.md)

## Overall verdict

- **AWS infra:** 2 CRITICAL findings block production trust (Postgres open to residential IP; 2 IAM admin-users with active keys).
- **Backend:** 6 HIGH findings — hardcoded admin fallback, unauth cache-flush, root Docker, GDPR-17 S3 orphaning, 20 high npm CVEs (incl. pdfjs-dist RCE), no helmet.
- **Frontend:** 74 dep-audit findings (1 crit, 40 high) + no global CSP/HSTS/nosniff — wide XSS blast radius.
- **GDPR:** 6 hard blockers before serving EU users lawfully.

## Combined severity

| Severity | Count |
|---|---|
| Critical | **4** (2 AWS + 1 build-dep + 6 GDPR blockers counted separately) |
| High | **17** (5 AWS + 6 backend + 6 frontend) |
| Medium | ~29 |
| Low | ~15 |

## Priority 0 — do today (≤ 30 min work each)

1. **[CRIT-AWS-01]** Revoke Postgres SG rule for `182.189.70.124/32`
2. **[HIGH-AWS-02]** Fix ALB :80 redirect typo `Port=433` → `443`
3. **[CRIT-AWS-05a]** Delete one of Hamza's two active access keys; move keys out of source-of-truth
4. **[HIGH-BE-01]** Remove hardcoded admin-email fallback in `clerk.strategy.ts:81-83`
5. **[HIGH-BE-02]** Add auth guard to `/cache/refresh` + `/cache/metrics`
6. **[HIGH-FE-06]** `bun update @tailwindcss/oxide` (node-tar critical)

## Priority 1 — this week (each ≤ 4 hrs)

7. **[HIGH-AWS-03/04]** CloudFront `https-only` + attach WAF (AWS Managed Rules + rate limit)
8. **[HIGH-AWS-06]** S3 versioning + lifecycle + access logging on both prod/stag
9. **[HIGH-BE-06]** Add `helmet()` to NestJS bootstrap
10. **[HIGH-BE-03]** Dockerfile `USER node`
11. **[HIGH-FE-02/05]** Global CSP + HSTS + nosniff + Referrer-Policy + Permissions-Policy in `next.config.mjs`
12. **[HIGH-FE-03/04]** `bun add axios@latest`, upgrade next to latest 16.x
13. **[HIGH-BE-04 / GDPR-BL-3]** S3 cascade on user delete
14. **[HIGH-BE-05]** `npm audit fix` on backend (20 high CVEs)

## Priority 2 — this month

15. IAM cleanup — strip `IAMFullAccess` from Huzaifa; SSO/role-based admin instead of user keys
16. GuardDuty on; CloudTrail multi-region + log-file-validation verified
17. ECR IMMUTABLE tags + scan-on-push
18. Route53: CAA record; DMARC `p=quarantine` with rua; delete malformed `_dmarc.mail.` record; enable DNSSEC
19. Cookie consent banner (blocks EU launch)
20. Data-export endpoint (Art. 15/20)
21. Privacy Policy §5 sub-processor list rewrite
22. Retention automation (BullMQ purge + S3 lifecycle)
23. SCCs / DPA / TIA docs for AWS + Clerk + Sentry + Solidgate + Weglot

## Fixes that touch LOCKED_PATHS (need explicit user OK)

- pdfjs-dist major upgrade (`lib/client/pdf-editor/load-pdfjs.ts`, `pdfjs-polyfills.ts`) — fixes GHSA-hq66-cqwq-w95j RCE-in-tab. Full mobile checklist must re-run afterwards.
- fabric major upgrade (`use-fabric-canvas.ts`, `use-edit-text-mode.ts`, `PdfViewerCanvas.tsx`) — API shifts around `objectCaching` and touch-action.

## What was NOT tested (per user scope constraint: localhost + staging only)

- Live production endpoint probing
- Auth fuzzing / brute-force testing
- Solidgate webhook signature forgery
- Actual PDF exploit payload against pdfjs-dist RCE
- AWS Config Rules / Security Hub findings (perms not granted to sub-agent)
- WAFv2 status (perms not granted)

Grant `SecurityAudit` managed policy for the audit IAM user to complete those.
