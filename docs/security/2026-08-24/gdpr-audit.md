# GDPR Posture Audit — 2026-08-24

**Scope:** frontend `/Users/softaims/pdf-viewer-app` + backend `/Users/softaims/Downloads/pdf-viewer-backend-main`

## Readiness verdict

**NOT ready for lawful EU operation.**

Legal pages read well but misrepresent the actual product: Privacy Policy promises a cookie banner that doesn't exist, ephemeral file processing that doesn't happen, a sub-processor list naming companies not in the stack, and a GPC handler that isn't wired. Backend erasure leaves S3 objects orphaned forever after account deletion.

## Total BLOCKERS: 6

1. Cookie consent banner missing (ePrivacy Art. 5(3))
2. Privacy Policy misrepresents current controls (Art. 5(1)(a) transparency)
3. Account deletion leaves S3 orphaned (Art. 17)
4. Soft-deleted documents never purged from S3 (Art. 5(1)(e))
5. No SCCs / DPA / TIA for AWS us-east-1 (Art. 44)
6. Same for Clerk, Sentry, Customer.io, Google, Microsoft (Art. 44)

## Top 5 gaps

1. **Cookie consent banner missing** — Privacy Policy §3-4 and Cookie Policy §5 promise one; `cookie_consent` cookie listed; footer references "Cookie Settings" — none exists. Google Analytics + Weglot load unconditionally for EU visitors.
2. **Account deletion leaks S3 forever** — `WebhookService.handleUserDeleted` → `UserService.deleteUser` → `prisma.user.delete()`. DB cascades, no S3 delete call. Direct Art. 17 violation.
3. **Sub-processor list in Privacy Policy §5 is factually wrong** — names Adyen, GoDaddy, Zendesk (none in stack); missing Clerk, Solidgate, AWS, Sentry, Customer.io, Weglot, Trustpilot, Google, Microsoft.
4. **us-east-1 storage of EU user data without documented SCCs / AWS DPA / TIA** — Art. 44 requires Art. 46 safeguards; nothing in-repo.
5. **No data-export endpoint (Art. 15/20)** — user can request deletion but cannot download their data.

## Findings by section

### §2 Data subject rights (Art. 15-22)
- ✅ Self-service Delete Account at `app/(app)/dashboard/settings/danger/page.tsx`
- ✅ Rectification via `settings/account` + Clerk-managed email/name
- ❌ NO data-export endpoint
- ⚠️ `ConsentRecord` kept post-deletion (justified but undisclosed)

### §4 Data minimisation (Art. 5(1)(c))
- ✅ `User` schema minimal (no DOB, phone, address)
- ❌ PII in prod logs — `audit-logger.service.ts` emits email, IP, UA unredacted
- ❌ `documents.controller.ts:112-114` logs full filename
- ✅ Frontend Sentry well-scrubbed

### §5 Retention (Art. 5(1)(e))
- ❌ Zero `@Cron` in backend
- ❌ BullMQ queues don't purge data
- ❌ Policy 90-day log cap unenforced
- ❌ No S3 lifecycle rules

### §7 Breach notification (Art. 33-34)
- ⚠️ `SecurityEvent` type exists, no alerting wired
- ❌ No incident-response runbook

### §8 DPIA triggers (Art. 35)
- ❌ W-9 flow collects SSN in `FormSession.values` JSON (plaintext, no session TTL cap)

### §9 Age gate
- ⚠️ Policy claims 18+, signup has no checkbox

### §10 Data residency
- ❌ AWS us-east-1 for EU users without Art. 46 safeguards

## GDPR readiness scorecard

| Article | Requirement | Status |
|---|---|---|
| Art. 5(1)(a) | Lawfulness, fairness, transparency | ❌ Policy misrepresents |
| Art. 5(1)(c) | Data minimisation | ⚠️ Schema minimal, PII in logs |
| Art. 5(1)(e) | Storage limitation | ❌ No retention automation |
| Art. 5(1)(f) | Integrity + confidentiality | ⚠️ Good crypto, DB SG open |
| Art. 15 | Right of access | ❌ No export |
| Art. 16 | Right to rectification | ✅ |
| Art. 17 | Right to erasure | ❌ S3 orphaned |
| Art. 20 | Right to portability | ❌ No export |
| Art. 21 | Right to object | ⚠️ Partial |
| Art. 25 | Privacy by design | ⚠️ |
| Art. 30 | Records of processing | ❌ |
| Art. 32 | Security of processing | ⚠️ See other audits |
| Art. 33-34 | Breach notification | ❌ |
| Art. 35 | DPIA | ❌ |
| Art. 44/46 | International transfers | ❌ |
| ePrivacy 5(3) | Cookie consent | ❌ |

## Files where fixes need to land

- `components/sections/legal/privacy-policy-content.tsx` — §5 rewrite + §6 additions
- `components/sections/auth/signup-card.tsx` — marketing opt-in + age checkbox
- `components/shared/navigation/weglot-loader.tsx` — consent + GPC gate
- New: cookie-consent component + footer "Cookie Settings" in `components/sections/new-landing/landing-footer.tsx`
- `src/webhook/webhook.service.ts:80-88` + `src/user/user.service.ts:142-147` — delete S3 keys before Prisma cascade
- `src/documents/documents.service.ts:715-753` + new `documents.gc-soft-deleted` BullMQ scheduler
- `src/common/logging/audit-logger.service.ts` — pino redact config
- New docs: `docs/security/incident-response.md`, `docs/security/gdpr/tia-aws.md`, `docs/security/gdpr/subprocessor-dpas.md`, `docs/privacy/dpia-w9.md`, `SECURITY.md`
