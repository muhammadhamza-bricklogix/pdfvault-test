#!/usr/bin/env bash
# =============================================================================
# Rollback — remove all Weglot Reverse Proxy infrastructure from the
# PDFedits CloudFront distribution. Restores the pre-Phase-B state:
#
#   - Removes the `weglot-proxy` origin.
#   - Removes 5 Weglot catchall behaviors: /{de,fr,es,pt,ar}/*
#   - Removes 35 ALB-first exception behaviors: /{locale}/{dashboard*,
#     pdf-composer*, pdf-editor*, w-9-form*, w9-form*, forms/*, share/*}
#
# After rollback, /{locale}/* requests fall through to the default cache
# behavior (ALB origin). Users see English content at /de/edit etc.,
# translated by the Weglot client SDK if the app was deployed with
# WeglotBoot enabled. Nothing 404s.
#
# Idempotent: only removes items that exist.
#
# USAGE:
#   export CLOUDFRONT_DIST_ID="E2ABC123XYZ"
#   bash infra/cloudfront-remove-weglot-proxy.sh
# =============================================================================

set -euo pipefail

: "${CLOUDFRONT_DIST_ID:?Missing CLOUDFRONT_DIST_ID env var}"
command -v jq >/dev/null 2>&1 || { echo "jq required — install with: brew install jq"; exit 1; }

echo "→ Fetching current distribution config for $CLOUDFRONT_DIST_ID"
aws cloudfront get-distribution-config \
  --id "$CLOUDFRONT_DIST_ID" \
  --output json > /tmp/cf-current.json

ETAG=$(jq -r '.ETag' /tmp/cf-current.json)
jq '.DistributionConfig' /tmp/cf-current.json > /tmp/cf-config.json

echo "→ ETag: $ETAG"

# Regex matching all locale-scoped behaviors added by cloudfront-add-weglot-proxy.sh:
#   - /{locale}/* Weglot catchalls
#   - /{locale}/{dashboard*,pdf-composer*,pdf-editor*,w-9-form*,w9-form*,forms/*,share/*}
# Locales: de, fr, es, pt, ar
LOCALE_REGEX='^/(de|fr|es|pt|ar)/(\*|dashboard\*|pdf-composer\*|pdf-editor\*|w-9-form\*|w9-form\*|forms/\*|share/\*)$'

REMOVED_COUNT=$(jq --arg re "$LOCALE_REGEX" '[.CacheBehaviors.Items[]? | select(.PathPattern | test($re))] | length' /tmp/cf-config.json)
echo "→ Will remove $REMOVED_COUNT locale-scoped cache behaviors"

jq --arg re "$LOCALE_REGEX" '
  .CacheBehaviors.Items |= map(select((.PathPattern | test($re)) | not))
  | .CacheBehaviors.Quantity = (.CacheBehaviors.Items | length)
  | .Origins.Items |= map(select(.Id != "weglot-proxy"))
  | .Origins.Quantity = (.Origins.Items | length)
' /tmp/cf-config.json > /tmp/cf-config.next.json
mv /tmp/cf-config.next.json /tmp/cf-config.json

read -p "Remove Weglot proxy + $REMOVED_COUNT locale behaviors from $CLOUDFRONT_DIST_ID? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

echo "→ Applying update-distribution (rollback)"
aws cloudfront update-distribution \
  --id "$CLOUDFRONT_DIST_ID" \
  --if-match "$ETAG" \
  --distribution-config "file:///tmp/cf-config.json" \
  > /tmp/cf-updated.json

NEW_STATUS=$(jq -r '.Distribution.Status' /tmp/cf-updated.json)

echo "============================================================"
echo "Weglot Reverse Proxy removed."
echo "  Distribution : $CLOUDFRONT_DIST_ID"
echo "  Status       : $NEW_STATUS  (edge propagation ~5–10 min)"
echo ""
echo "Locale URLs (/de/*, /fr/*, etc.) fall through to the ALB default"
echo "behavior. Users see English HTML at locale URLs. If the app still"
echo "loads WeglotBoot (client SDK), Weglot translates the DOM in-browser."
echo "============================================================"
