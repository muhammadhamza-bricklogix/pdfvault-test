# CloudFront + Weglot Reverse Proxy setup (server-side subdirectory translation, public-only routing)

This adds Weglot's reverse-proxy origin to the existing PDFedits CloudFront distribution so **public** `/de/*`, `/fr/*`, `/es/*`, `/pt/*`, `/ar/*` URLs are translated server-side by Weglot (Google-indexable HTML). **Authenticated + PII-sensitive routes stay on the ALB** — Weglot never sees the user's file library, editor content, W-9 tax data, share tokens, or dashboard.

## Option 1 routing decision matrix

For every locale (`de`, `fr`, `es`, `pt`, `ar`):

| Path pattern | Origin | Why |
|---|---|---|
| `/{locale}/dashboard*` | ALB | User's file library + settings — highest-PII page in the app |
| `/{locale}/pdf-composer*` | ALB | Editor. Bare `/pdf-composer` is public, but the `?id=` variant is auth-gated + shows user PDFs. One rule for both |
| `/{locale}/pdf-editor*` | ALB | Legacy editor route |
| `/{locale}/w-9-form*` | ALB | W-9 tax form contains SSN and other high-sensitivity PII |
| `/{locale}/w9-form*` | ALB | Legacy W-9 alias |
| `/{locale}/forms/*` | ALB | Form flows — same reasoning as W-9 |
| `/{locale}/share/*` | ALB | Share tokens serve arbitrary user PDFs |
| `/{locale}/*` (catchall) | **Weglot** | Landing pages, `/edit`, `/compress`, `/pricing`, `/about`, auth entry pages, convert routes — all safely translated server-side |

CloudFront evaluates cache behaviors in array order and picks the first match. The script inserts ALB-first exceptions BEFORE each locale's Weglot catchall, so specificity wins without depending on CloudFront's implicit ordering.

**Root English URLs** (`/edit`, `/pricing`, `/dashboard`, etc.) — unchanged. Existing default cache behavior on the ALB serves them.

## Prereqs

- Weglot Pro plan (subdirectory URL structure is included).
- CloudFront distribution already created via `cloudfront-setup.sh`.
- AWS CLI configured with `cloudfront:GetDistributionConfig` + `cloudfront:UpdateDistribution` on the distribution.
- `jq` installed (`brew install jq`).
- **CloudFront quota bump — REQUIRED.** This adds ~40 cache behaviors; the AWS default is 25 per distribution. Request the increase BEFORE running the apply script:

```bash
aws service-quotas request-service-quota-increase \
  --service-code cloudfront \
  --quota-code L-BABCBFAB \
  --desired-value 100
```

Same-day approval usually. Check status with:

```bash
aws service-quotas list-requested-service-quota-change-history \
  --service-code cloudfront
```

## Step 1 — Weglot dashboard

1. Log in → project **pdfvault.ai** → **Settings** → **Setup**.
2. Toggle **URL structure** from Subdomains to **Subdirectories**.
3. When Weglot asks for hosting mode, pick **External Provider** (labelled "custom routing" or "Fastly" depending on UI version) — stops Weglot from trying to take over the apex DNS records.
4. Weglot dashboard now shows a destination endpoint. Copy it — typically one of:
   - `websites.weglot.com`
   - a project-specific hostname like `pdfvault-ai.weglot.com` (varies by tier / rollout)
5. Confirm **Destination languages** = `de, fr, es, pt, ar`.
6. Save.
7. **Optional but recommended** — in Weglot **Settings** → **SEO**, toggle OFF "Automatic hreflang injection". Our SSR emits hreflang from `app/layout.tsx` — one source of truth avoids duplicate tags in `<head>`.

## Step 2 — Staging validation (Railway)

Railway staging can validate Phase A (Weglot client SDK + middleware + hreflang + sitemap) but **cannot validate the CloudFront Reverse Proxy** because Railway doesn't have CloudFront cache behaviors. The Phase A slice ships as-is on staging; Phase B config apply is prod-only.

**Deploy code branch to Railway staging:**

```bash
git push origin main
# Railway auto-deploys from staging branch — trigger the staging deploy per your Railway workflow.
```

**On the Railway staging URL** (e.g. `pdfvault-staging.up.railway.app`), verify:

- `NEXT_PUBLIC_WEGLOT_API_KEY` env var is set in the Railway staging environment (Weglot client SDK needs it).
- `/edit` renders EN + `<html lang="en">`.
- `/de/edit` renders EN HTML + `<html lang="de">` (dir="ltr"), Weglot script loads via `afterInteractive`, DOM strings translate to German after hydration.
- Language switcher click navigates to `/de/edit` + writes `lang_pref` cookie.
- `/de/dashboard` (signed-out) → 302 to `/sign-in?redirect_url=/de/dashboard`.
- `/sitemap.xml` includes 168 entries with reciprocal `xhtml:link` alternates.
- No console errors during page load.
- `bun test tests/geo/locale-decision.spec.ts` → 19/19 pass locally.

If any of these fail on staging, debug BEFORE deploying to prod.

## Step 3 — Prod code deploy

Deploy the same code branch to the prod ECS Fargate service (via existing deploy pipeline). At this point:

- All `/de/*`, `/fr/*`, etc. URLs resolve on prod. Content served in EN with Weglot client SDK translating client-side (Phase A behavior).
- Users get translations. Ads campaigns work. Google indexes English at locale URLs until Step 4.
- CloudFront distribution unchanged — still no `weglot-proxy` origin, no locale behaviors.

## Step 4 — CloudFront apply (Phase B)

```bash
# Set env vars from the Weglot dashboard (Step 1) and AWS
export CLOUDFRONT_DIST_ID="<YOUR_DIST_ID>"            # e.g. E2ABC123XYZ
export WEGLOT_ORIGIN_DOMAIN="websites.weglot.com"    # or project-specific host
export WEGLOT_API_KEY="<PASTE_PUBLIC_API_KEY>"       # matches NEXT_PUBLIC_WEGLOT_API_KEY
export ORIGIN_HOST_HEADER="pdfvault.ai"              # do NOT change

bash infra/cloudfront-add-weglot-proxy.sh
```

The script prompts once for confirmation before applying `update-distribution`.

**CloudFront edge propagation:** 5–10 min after applying. Check status:

```bash
aws cloudfront get-distribution --id "$CLOUDFRONT_DIST_ID" --query 'Distribution.Status'
# "InProgress" → still propagating; "Deployed" → live at all edges
```

## Step 5 — Verify

Once status = `Deployed`:

```bash
# Landing page — should now be Weglot-translated server-side.
# The response HTML should contain German text in the initial payload,
# not just after client-side JS execution.
curl -s https://pdfvault.ai/de/edit | grep -o '<html[^>]*lang="[^"]*"' | head -1
# Expect: <html lang="de">

# Fetch a specific translatable landmark to prove server-side translation
curl -s https://pdfvault.ai/de/pricing | grep -i 'preis\|pläne'
# Expect: German text present in the raw HTML (not just Weglot script tag)

# Dashboard — must stay on ALB.
curl -sI https://pdfvault.ai/de/dashboard | head -3
# Expect: 302 → /sign-in?redirect_url=/de/dashboard (or 200 if signed-in)
# The `Server` header should indicate the ALB, not Weglot's proxy

# Editor — stays on ALB.
curl -sI https://pdfvault.ai/de/pdf-composer

# Share tokens — stay on ALB.
curl -sI https://pdfvault.ai/de/share/test-token

# hreflang correctness
curl -s https://pdfvault.ai/de/edit | grep hreflang | head -10
# Expect: 6 <link rel="alternate" hreflang="..."> + x-default
```

Manual browser walkthrough:

1. Load `pdfvault.ai/de/edit` in a fresh incognito. Should see German in the FIRST paint (no English → German swap after hydration). View source → confirm German text in HTML.
2. Load `pdfvault.ai/de/dashboard` while signed-in. Confirm English dashboard chrome (ALB origin) + filenames intact + no Weglot script running on this URL.
3. Load `pdfvault.ai/pdf-composer` (EN root). Unchanged behavior.
4. Language switcher on `/de/pricing` → click French → navigates to `/fr/pricing` → French content in first paint.
5. Google Search Console → URL inspection on `pdfvault.ai/de/edit` → confirm Google's rendered HTML contains German.

## Step 6 — Enable geo-IP defaulting (Priority 2)

**Prereq:** Priority 1 (locale URL structure) is live and verified.

**What it does:** locale-less URLs (e.g. hitting `pdfvault.ai/` from a German IP) get 302-redirected at the CloudFront edge to the matching `/{locale}` before the request reaches origin. Cookie `lang_pref` overrides the geo lookup. Bots + auth pages + editor + dashboard + share tokens are exempt.

**6.1 Publish + attach the function (kill-switch still OFF):**

```bash
export CLOUDFRONT_DIST_ID="<YOUR_DIST_ID>"
bash infra/cloudfront-publish-geo-redirect.sh
```

The function is now attached to the default cache behavior on `viewer-request` but ships with `GEO_REDIRECT_ENABLED = false`, so it does nothing yet. This lets you verify locale URLs still work with the function attached before the redirect logic activates.

**6.2 Verify nothing broke (function attached, disabled):**

```bash
# Function attached but disabled — no redirects should fire.
curl -sI -H 'CloudFront-Viewer-Country: DE' https://pdfvault.ai/
# Expect: 200 (EN, no redirect)

curl -sI https://pdfvault.ai/de/edit
# Expect: 200 with translated German HTML (Phase B routing intact)
```

**6.3 Enable the redirect:**

```bash
# Edit infra/cloudfront-functions/geo-redirect.js
# Change: var GEO_REDIRECT_ENABLED = false;
# To:     var GEO_REDIRECT_ENABLED = true;

bash infra/cloudfront-publish-geo-redirect.sh
```

Same script — it updates the function code, republishes, and short-circuits if the function is already attached. Edge propagation ~5 min.

**6.4 Verify geo defaulting works:**

```bash
# German IP hitting root → 302 to /de with cookie
curl -sI -H 'CloudFront-Viewer-Country: DE' https://pdfvault.ai/ | head -6
# Expect: HTTP/2 302, Location: /de, Set-Cookie: lang_pref=de..., Cache-Control: no-store

# French IP hitting /edit → 302 to /fr/edit
curl -sI -H 'CloudFront-Viewer-Country: FR' https://pdfvault.ai/edit

# US IP hitting root → 200 (EN default, no redirect)
curl -sI -H 'CloudFront-Viewer-Country: US' https://pdfvault.ai/

# Unmapped country → 200 EN
curl -sI -H 'CloudFront-Viewer-Country: JP' https://pdfvault.ai/

# Cookie override — DE IP + lang_pref=en cookie → 200 EN (no redirect)
curl -sI -H 'CloudFront-Viewer-Country: DE' -H 'Cookie: lang_pref=en' https://pdfvault.ai/

# Bot exempt — DE IP + Googlebot UA → 200 EN
curl -sI -H 'CloudFront-Viewer-Country: DE' -A 'Googlebot/2.1' https://pdfvault.ai/

# Explicit locale URL from DE IP → 200 (no redirect, locale wins)
curl -sI -H 'CloudFront-Viewer-Country: DE' https://pdfvault.ai/fr/pricing

# Auth entry pages exempt — DE IP + /sign-in → 200 (no redirect into /de/sign-in)
curl -sI -H 'CloudFront-Viewer-Country: DE' https://pdfvault.ai/sign-in

# Authenticated content routes exempt — DE IP + /dashboard → served by ALB unchanged
curl -sI -H 'CloudFront-Viewer-Country: DE' https://pdfvault.ai/dashboard

# Sitemap + robots exempt — never redirected
curl -sI -H 'CloudFront-Viewer-Country: DE' https://pdfvault.ai/robots.txt
curl -sI -H 'CloudFront-Viewer-Country: DE' https://pdfvault.ai/sitemap.xml
```

**6.5 Kill switches for geo-redirect:**

| Action | Command | Time to effect |
|---|---|---|
| Disable redirect, keep function attached | Edit js → `false` → `bash infra/cloudfront-publish-geo-redirect.sh` | ~5 min |
| Detach function entirely | `bash infra/cloudfront-detach-geo-redirect.sh` | ~5 min |
| Change country → locale mapping | Edit `COUNTRY_TO_LOCALE` in both `geo-redirect.js` AND `lib/shared/constants/locale-map.ts`, then republish | ~5 min |
| Flip AR-country IPs from `en` → `ar` after RTL sign-off | Change `SA: "en"` etc. to `SA: "ar"` etc. in both files, republish | ~5 min |

## Step 7 — Cleanup (optional, after ~1 week of prod stability)

Once Phase B + geo-redirect are verified stable, the client-side `WeglotBoot` component is redundant on Weglot-proxied URLs (their proxy already translated the HTML). Remove it:

1. Delete `<WeglotBoot />` from `app/layout.tsx`.
2. Delete `components/shared/navigation/weglot-boot.tsx`.
3. Delete Weglot preconnect + dns-prefetch from `app/layout.tsx`.

Don't remove until you've confirmed all 5 Weglot-proxied locale URLs work correctly for at least a week — the client SDK is your fallback if the CloudFront config develops any issue.

## Rollback

If any step fails or produces unexpected behavior:

```bash
export CLOUDFRONT_DIST_ID="<YOUR_DIST_ID>"
bash infra/cloudfront-remove-weglot-proxy.sh
```

Strips the `weglot-proxy` origin + all 40 locale-scoped behaviors. Locale URLs fall through to the ALB default (English content served, Weglot client SDK still translates in-browser).

Rollback edge propagation: 5–10 min.

## What changes on the codebase after Phase B ships

Nothing has to change in the Next.js codebase immediately. The current setup — middleware locale detection, per-URL canonical/hreflang metadata, sitemap, language switcher — remains correct and stays as the source of truth for URL structure + SEO signals. Weglot's proxy operates orthogonally, translating whatever HTML we serve.

Only the optional Step 6 cleanup removes `WeglotBoot` once Phase B is proven stable.

## Privacy: `data-wg-notranslate`

Already applied on the code side to protect PII if any authenticated content ever reaches Weglot (belt-and-braces alongside the ALB-first CloudFront routing above):

- `components/sections/dashboard/pv-file-table.tsx` — filename cells.
- `components/sections/dashboard/identity-popover.tsx` — name + email in the popover.
- `components/sections/dashboard/dashboard-shell.tsx` — sidebar user block.

**Pending:** `components/sections/pdf-editor/PvEditorTopChrome.tsx` filename input — file is locked (`.claude/LOCKED_PATHS`). Not urgent since editor routes stay on ALB per option 1, but add if the LOCKED_PATHS list is ever revisited.

## Quota + cost impact

- CloudFront quota: 25 → 100 behaviors (request via `aws service-quotas`, same-day approval).
- Weglot Pro plan cost: unchanged (€79/mo, already active).
- CloudFront traffic cost: unchanged — Weglot proxy just routes existing traffic through a different origin.
- Fargate cost: unchanged — Weglot fetches the SAME English HTML from our ALB, so origin load is identical.
