# AWS Infrastructure Security Audit — 2026-08-24

**Account:** 633321546885 (IAM user: Hamza)
**Region:** us-east-1
**Method:** Read-only `aws` CLI calls, no modifications

## Severity counts

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 5 |
| Medium | 9 |
| Low | 4 |
| Info (not assessable — missing perms) | 6 |

## Top 10 fixes (ranked by risk × ease)

| # | Severity | Resource | Issue | Fix (aws CLI) |
|---|---|---|---|---|
| 1 | CRITICAL | SG `sg-021ead21d2ca2e113` (pdfvault-db-sg) | Postgres :5432 open to `182.189.70.124/32` — residential Pakistan Telecom IP; rotates, next holder gets unauth network path to DB | `aws ec2 revoke-security-group-ingress --group-id sg-021ead21d2ca2e113 --protocol tcp --port 5432 --cidr 182.189.70.124/32` |
| 2 | HIGH | ALB `pdfvault-alb` listener :80 | `RedirectConfig.Port="433"` typo — HTTP visitors get 301 to dead port | `aws elbv2 modify-listener --listener-arn <arn> --default-actions Type=redirect,RedirectConfig="{Port=443,Protocol=HTTPS,StatusCode=HTTP_301}"` |
| 3 | HIGH | CloudFront `E1WVPECYKY8EBO` origin `pdfvault-alb` | `OriginProtocolPolicy: http-only` — CDN↔ALB plaintext, bypass CloudFront via ALB SG open to 0.0.0.0/0 :80 | Set origin to `https-only`, tighten ALB SG to CloudFront prefix list (`com.amazonaws.global.cloudfront.origin-facing`) OR require secret `X-Origin-Verify` header |
| 4 | HIGH | CloudFront `E1WVPECYKY8EBO` | `WebACLId: ""` — no WAF, no rate limit, no managed rules on `/api/*` | `aws wafv2 create-web-acl --scope CLOUDFRONT --default-action Allow=... --rules '[AWSManagedRulesCommonRuleSet, AWSManagedRulesKnownBadInputsRuleSet, RateLimit@2000/5min]' --visibility-config ...` then `associate-web-acl` |
| 5 | CRITICAL | IAM users Hamza + Huzaifa | Both hold `AdministratorAccess` + `IAMFullAccess` on user identities; Hamza has 2 active access keys used today | Move admin work to a role assumed via SSO/`sts assume-role`; delete second Hamza key: `aws iam delete-access-key --user-name Hamza --access-key-id <old>`; strip `IAMFullAccess` from Huzaifa |
| 6 | HIGH | S3 `pdfvault-prod` + `pdfvault-stag` | Versioning DISABLED; no lifecycle; no access logging | `aws s3api put-bucket-versioning --bucket pdfvault-prod --versioning-configuration Status=Enabled`; add lifecycle + `put-bucket-logging` |
| 7 | MEDIUM | Account | No password policy | `aws iam update-account-password-policy --minimum-password-length 14 --require-symbols --require-numbers --require-uppercase-characters --require-lowercase-characters --allow-users-to-change-password --max-password-age 90 --password-reuse-prevention 12` |
| 8 | HIGH | Account | GuardDuty status not verified (sub-agent lacked perms); CloudTrail multi-region + log-file-validation unverified | `aws guardduty create-detector --enable`; `aws cloudtrail describe-trails` + turn on `LogFileValidation` |
| 9 | MEDIUM | ECR `pdfvault-backend` + `pdfvault-frontend` | `imageTagMutability=MUTABLE`, `scanOnPush=false` | `aws ecr put-image-tag-mutability --repository-name pdfvault-backend --image-tag-mutability IMMUTABLE`; `put-image-scanning-configuration --scan-on-push=true` |
| 10 | MEDIUM | Route53 zone `Z0325060DVZ4MYIV17GK pdfvault.ai` | No CAA record → any CA can mint certs; DMARC is `p=none` (report-only) with no `rua`; malformed `_dmarc.mail.pdfvault.ai.pdfvault.ai.` record | Add CAA `0 issue "amazon.com"`; strengthen DMARC to `p=quarantine; rua=mailto:dmarc@pdfvault.ai`; delete malformed record |

## Resource inventory (evidence)

### CloudFront
- Distribution `E1WVPECYKY8EBO`
  - `WebACLId: ""` ❌ no WAF
  - `Logging.Enabled: false` ❌
  - Origin `pdfvault-alb`: `OriginProtocolPolicy=http-only` ❌

### ALB `pdfvault-alb`
- ARN: `arn:aws:elasticloadbalancing:us-east-1:633321546885:loadbalancer/app/pdfvault-alb/7a855e8f70e1d143`
- Listener :80 → 301 redirect with `Port="433"` (typo) ❌
- Listener :443: `SslPolicy=ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09` ✅ (TLS1.3, post-quantum ready)
- Attrs: `access_logs.s3.enabled=false` ❌, `deletion_protection.enabled=false` ❌, `drop_invalid_header_fields=false` ⚠️

### Security Groups
- `sg-021ead21d2ca2e113` **pdfvault-db-sg** — 5432 open to `182.189.70.124/32` ❌ CRITICAL
- `sg-038d4fda1cdd4d09e` **pdfvault-backend-sg** — 80/443/3000 open to `0.0.0.0/0` (also the ALB's SG) ⚠️
- `sg-06a1f9af14d298df7` **pdfvault-admin-sg** — 80/443 worldwide, SSH from `39.34.107.30/32` ⚠️

### EC2
- `i-003145425637782dc` **pdfvault-admin** — 13.219.59.208, t3.small, IMDSv2 required ✅

### S3
| Bucket | Encryption | PAB | Versioning | Lifecycle | Logging | CORS |
|---|---|---|---|---|---|---|
| `pdfvault-prod` | AES256 ✅ | all-on ✅ | OFF ❌ | none ❌ | none ❌ | `*` headers + `localhost:300{0,1,2}` origins ⚠️ |
| `pdfvault-stag` | AES256 ✅ | all-on ✅ | OFF ❌ | none ❌ | none ❌ | `*` headers ⚠️ |

### IAM
- Users: `Hamza` (2 active keys, both used 2026-08-24, `AdministratorAccess` + `IAMFullAccess` + `AmazonS3FullAccess`), `Huzaifa` (`IAMFullAccess` + `AmazonS3FullAccess`)
- Both have console + MFA ✅
- Custom roles all correctly scoped (least-privilege) ✅
  - `pdfvault-backend-task-role`, `pdfvault-secret-sync-role`, `github-actions-pdfvault`, `pdfvault-admin-ec2-role`

### ECR
- `pdfvault-backend` + `pdfvault-frontend`: `imageTagMutability=MUTABLE` ❌, `scanOnPush=false` ❌, AES256 ✅

### ACM
- 2 RSA-2048 certs (`3ebbc2e7...` on ALB, `7fc728dc...` on CloudFront)
- Both `RenewalEligibility=ELIGIBLE`
- Expiry: 2027-01-16 and 2027-02-18 ✅

### Route53
- Zone `Z0325060DVZ4MYIV17GK pdfvault.ai` — 38 records
- No CAA ❌, no root SPF ❌
- `_dmarc.pdfvault.ai=v=DMARC1; p=none` (no rua/ruf) ⚠️
- Malformed record `_dmarc.mail.pdfvault.ai.pdfvault.ai.` ❌
- DNSSEC status unknown

### Secrets Manager
- 4 secrets. Only auto-managed `rds!db-...` rotates (7d) ✅
- Composite `pdfvault` secret NO rotation ⚠️

### Lambda
- 1 function `pdfvault-secret-sync`, role correctly scoped ✅

## Not-assessable (permissions denied to sub-agent)

CloudTrail, AWS Config, GuardDuty, WAFv2, RDS parameter groups, SSM parameters, Route53 DNSSEC — verify manually with wider perms or grant `SecurityAudit` managed policy for the audit user.
