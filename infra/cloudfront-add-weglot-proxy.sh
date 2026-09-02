#!/usr/bin/env bash
# =============================================================================
# Merge Weglot Reverse Proxy origin + locale cache behaviors into the existing
# PDFedits CloudFront distribution — Option 1 (public-only routing).
#
# Only PUBLIC locale paths (landing, marketing, convert) are routed through
# Weglot's proxy. Authenticated + PII-sensitive paths stay on the ALB:
#   /{locale}/dashboard*        — user file library + settings
#   /{locale}/pdf-composer*     — editor + auth-gated ?id variant
#   /{locale}/pdf-editor*       — legacy editor route
#   /{locale}/w-9-form*         — W-9 tax form (SSN etc.)
#   /{locale}/w9-form*          — legacy W-9 alias
#   /{locale}/forms/*           — form flow pages
#   /{locale}/share/*           — private share tokens serving user PDFs
#
# Everything else under /{locale}/* (landing pages, pricing, about, auth
# entry pages, convert routes) is proxied through Weglot for server-side
# translation and Google indexing.
#
# BEHAVIOR COUNT: adds 7 ALB-first exceptions × 5 locales = 35 + 5 Weglot
# catchall behaviors = 40 new. Combined with the ~6 existing, the
# distribution ends up with ~46 cache behaviors. AWS CloudFront's default
# quota is 25 behaviors per distribution. Request a quota increase to 100
# BEFORE running this script:
#   aws service-quotas request-service-quota-increase \
#     --service-code cloudfront \
#     --quota-code L-BABCBFAB \
#     --desired-value 100
# (Approvals are usually same-day.)
#
# Idempotent: reads current config, adds only missing origin + behaviors,
# applies with the correct ETag.
#
# REQUIREMENTS:
#   export CLOUDFRONT_DIST_ID="E2ABC123XYZ"
#   export WEGLOT_ORIGIN_DOMAIN="websites.weglot.com"    # from Weglot dashboard
#   export WEGLOT_API_KEY="wg_..."                        # NEXT_PUBLIC_WEGLOT_API_KEY
#   export ORIGIN_HOST_HEADER="pdfvault.ai"               # canonical host — leave as-is
#   jq installed (brew install jq)
#
# USAGE:
#   bash infra/cloudfront-add-weglot-proxy.sh
# =============================================================================

set -euo pipefail

: "${CLOUDFRONT_DIST_ID:?Missing CLOUDFRONT_DIST_ID env var}"
: "${WEGLOT_ORIGIN_DOMAIN:?Missing WEGLOT_ORIGIN_DOMAIN env var}"
: "${WEGLOT_API_KEY:?Missing WEGLOT_API_KEY env var (the NEXT_PUBLIC_WEGLOT_API_KEY value)}"
: "${ORIGIN_HOST_HEADER:=pdfvault.ai}"

command -v jq >/dev/null 2>&1 || { echo "jq required — install with: brew install jq"; exit 1; }

# AWS-managed policies
CACHING_DISABLED_POLICY="4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
USE_ORIGIN_CC_POLICY="83da9c7e-98b4-4e11-a168-04f0df8e2c65"
ALL_VIEWER_ORIGIN_REQUEST="b689b0a8-53d0-40ab-baf2-68738e2966ac"

# ALB origin id — must match the origin id in cloudfront-setup.sh.
ALB_ORIGIN_ID="pdfvault-alb"

LOCALES=("de" "fr" "es" "pt" "ar")

# Path patterns that MUST stay on the ALB (never proxied through Weglot).
# Order irrelevant within this list; each pattern becomes its own cache
# behavior. Prefix wildcard (`*` at end) covers path + query-string
# variants (CloudFront path matching ignores query strings).
ALB_FIRST_PATTERNS=(
  "dashboard*"      # dashboard + settings + any sub-route
  "pdf-composer*"   # editor (public bare + auth-gated ?id variant)
  "pdf-editor*"     # legacy editor route
  "w-9-form*"       # W-9 tax form (high-PII)
  "w9-form*"        # legacy W-9 alias
  "forms/*"         # form flows
  "share/*"         # share tokens serving arbitrary user PDFs
)

echo "→ Fetching current distribution config for $CLOUDFRONT_DIST_ID"
aws cloudfront get-distribution-config \
  --id "$CLOUDFRONT_DIST_ID" \
  --output json > /tmp/cf-current.json

ETAG=$(jq -r '.ETag' /tmp/cf-current.json)
jq '.DistributionConfig' /tmp/cf-current.json > /tmp/cf-config.json

echo "→ ETag: $ETAG"

# ---------------------------------------------------------------------------
# Add the Weglot origin (skip if already present)
# ---------------------------------------------------------------------------
HAS_WEGLOT_ORIGIN=$(jq '[.Origins.Items[] | select(.Id == "weglot-proxy")] | length' /tmp/cf-config.json)

if [[ "$HAS_WEGLOT_ORIGIN" == "0" ]]; then
  echo "→ Injecting weglot-proxy origin ($WEGLOT_ORIGIN_DOMAIN)"
  jq --arg domain "$WEGLOT_ORIGIN_DOMAIN" \
     --arg key "$WEGLOT_API_KEY" \
     --arg host "$ORIGIN_HOST_HEADER" \
    '.Origins.Items += [{
      Id: "weglot-proxy",
      DomainName: $domain,
      OriginPath: "",
      CustomOriginConfig: {
        HTTPSPort: 443,
        HTTPPort: 80,
        OriginProtocolPolicy: "https-only",
        OriginSslProtocols: {Quantity: 1, Items: ["TLSv1.2"]},
        OriginReadTimeout: 30,
        OriginKeepaliveTimeout: 30
      },
      CustomHeaders: {
        Quantity: 2,
        Items: [
          {HeaderName: "X-Weglot-Key", HeaderValue: $key},
          {HeaderName: "Host", HeaderValue: $host}
        ]
      }
    }]
    | .Origins.Quantity = (.Origins.Items | length)' \
    /tmp/cf-config.json > /tmp/cf-config.next.json
  mv /tmp/cf-config.next.json /tmp/cf-config.json
else
  echo "→ weglot-proxy origin already present, skipping origin injection"
fi

# ---------------------------------------------------------------------------
# Per locale: add ALB-first exceptions FIRST, then Weglot catchall.
# CloudFront evaluates behaviors in array order — first match wins — so
# specific `/{locale}/dashboard*` etc. must precede the `/{locale}/*`
# catchall for the same locale.
# ---------------------------------------------------------------------------
for locale in "${LOCALES[@]}"; do
  # 1. ALB-first exceptions for this locale
  for suffix in "${ALB_FIRST_PATTERNS[@]}"; do
    PATTERN="/${locale}/${suffix}"
    HAS=$(jq --arg p "$PATTERN" '[.CacheBehaviors.Items[]? | select(.PathPattern == $p)] | length' /tmp/cf-config.json)

    if [[ "$HAS" == "0" ]]; then
      echo "  + ALB-first: $PATTERN"
      jq --arg pattern "$PATTERN" \
         --arg targetId "$ALB_ORIGIN_ID" \
         --arg cachePolicy "$CACHING_DISABLED_POLICY" \
         --arg originPolicy "$ALL_VIEWER_ORIGIN_REQUEST" \
        '.CacheBehaviors.Items += [{
          PathPattern: $pattern,
          TargetOriginId: $targetId,
          ViewerProtocolPolicy: "redirect-to-https",
          Compress: true,
          CachePolicyId: $cachePolicy,
          OriginRequestPolicyId: $originPolicy,
          AllowedMethods: {
            Quantity: 7,
            Items: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
            CachedMethods: {Quantity: 2, Items: ["GET", "HEAD"]}
          }
        }]
        | .CacheBehaviors.Quantity = (.CacheBehaviors.Items | length)' \
        /tmp/cf-config.json > /tmp/cf-config.next.json
      mv /tmp/cf-config.next.json /tmp/cf-config.json
    else
      echo "  = ALB-first: $PATTERN (already present, skipping)"
    fi
  done

  # 2. Weglot catchall for this locale — placed AFTER the ALB-first
  #    exceptions so specific patterns take precedence.
  CATCHALL="/${locale}/*"
  HAS_CATCHALL=$(jq --arg p "$CATCHALL" '[.CacheBehaviors.Items[]? | select(.PathPattern == $p)] | length' /tmp/cf-config.json)

  if [[ "$HAS_CATCHALL" == "0" ]]; then
    echo "  + Weglot catchall: $CATCHALL"
    jq --arg pattern "$CATCHALL" \
       --arg cachePolicy "$CACHING_DISABLED_POLICY" \
       --arg originPolicy "$ALL_VIEWER_ORIGIN_REQUEST" \
      '.CacheBehaviors.Items += [{
        PathPattern: $pattern,
        TargetOriginId: "weglot-proxy",
        ViewerProtocolPolicy: "redirect-to-https",
        Compress: true,
        CachePolicyId: $cachePolicy,
        OriginRequestPolicyId: $originPolicy,
        AllowedMethods: {
          Quantity: 3,
          Items: ["GET", "HEAD", "OPTIONS"],
          CachedMethods: {Quantity: 2, Items: ["GET", "HEAD"]}
        }
      }]
      | .CacheBehaviors.Quantity = (.CacheBehaviors.Items | length)' \
      /tmp/cf-config.json > /tmp/cf-config.next.json
    mv /tmp/cf-config.next.json /tmp/cf-config.json
  else
    echo "  = Weglot catchall: $CATCHALL (already present, skipping)"
  fi
done

TOTAL_BEHAVIORS=$(jq '.CacheBehaviors.Items | length' /tmp/cf-config.json)
echo ""
echo "→ Total cache behaviors after merge: $TOTAL_BEHAVIORS"
echo "  (default AWS quota is 25 per distribution; request an increase to 100 if needed)"
echo ""

read -p "Apply this update to distribution $CLOUDFRONT_DIST_ID? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

echo "→ Applying update-distribution"
aws cloudfront update-distribution \
  --id "$CLOUDFRONT_DIST_ID" \
  --if-match "$ETAG" \
  --distribution-config "file:///tmp/cf-config.json" \
  > /tmp/cf-updated.json

NEW_STATUS=$(jq -r '.Distribution.Status' /tmp/cf-updated.json)
NEW_ETAG=$(jq -r '.ETag' /tmp/cf-updated.json)

echo ""
echo "============================================================"
echo "Weglot Reverse Proxy behaviors added (Option 1: public-only)."
echo ""
echo "  Distribution : $CLOUDFRONT_DIST_ID"
echo "  Status       : $NEW_STATUS  (edge propagation takes ~5–10 min)"
echo "  New ETag     : $NEW_ETAG"
echo ""
echo "VERIFY once status is 'Deployed':"
echo ""
echo "  # Landing page — Weglot-translated"
echo "  curl -s https://pdfvault.ai/de/edit | grep -o '<html[^>]*lang=\"[^\"]*\"' | head -1"
echo "  # Expect: <html lang=\"de\"> with German body text"
echo ""
echo "  # Dashboard — stays on ALB, does NOT reach Weglot"
echo "  curl -sI https://pdfvault.ai/de/dashboard"
echo "  # Expect: 302 → /sign-in?redirect_url=/de/dashboard (or dashboard HTML if signed-in)"
echo ""
echo "  # Editor — stays on ALB"
echo "  curl -sI https://pdfvault.ai/de/pdf-composer"
echo "  # Expect: HTML served from origin, no Weglot processing"
echo ""
echo "  # Share tokens — stay on ALB (never touch Weglot)"
echo "  curl -sI https://pdfvault.ai/de/share/some-token"
echo "  # Expect: served from origin"
echo ""
echo "ROLLBACK:"
echo "  bash infra/cloudfront-remove-weglot-proxy.sh"
echo "============================================================"
