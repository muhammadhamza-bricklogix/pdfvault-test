#!/usr/bin/env bash
# =============================================================================
# Detach the geo-redirect CloudFront Function from the distribution's
# default cache behavior. The function itself stays published in the
# CloudFront Functions inventory — this only removes the association
# so it no longer fires on viewer-request.
#
# Faster reversal than editing the JS + republishing. Use this if geo
# redirect starts misbehaving in prod and you need to stop it fast.
#
# USAGE:
#   export CLOUDFRONT_DIST_ID="E2ABC123XYZ"
#   bash infra/cloudfront-detach-geo-redirect.sh
# =============================================================================

set -euo pipefail

: "${CLOUDFRONT_DIST_ID:?Missing CLOUDFRONT_DIST_ID env var}"
command -v jq >/dev/null 2>&1 || { echo "jq required — install with: brew install jq"; exit 1; }

echo "→ Fetching distribution config for $CLOUDFRONT_DIST_ID"
aws cloudfront get-distribution-config \
  --id "$CLOUDFRONT_DIST_ID" \
  --output json > /tmp/cf-current.json

ETAG=$(jq -r '.ETag' /tmp/cf-current.json)
jq '.DistributionConfig' /tmp/cf-current.json > /tmp/cf-config.json

CURRENT_COUNT=$(jq '.DefaultCacheBehavior.FunctionAssociations.Quantity // 0' /tmp/cf-config.json)
if [[ "$CURRENT_COUNT" == "0" ]]; then
  echo "→ No function attached to default cache behavior. Nothing to detach."
  exit 0
fi

echo "→ Clearing FunctionAssociations on DefaultCacheBehavior"
jq '.DefaultCacheBehavior.FunctionAssociations = {Quantity: 0, Items: []}' \
  /tmp/cf-config.json > /tmp/cf-config.next.json
mv /tmp/cf-config.next.json /tmp/cf-config.json

read -p "Detach geo-redirect function from $CLOUDFRONT_DIST_ID? (yes/no): " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { echo "Aborted."; exit 0; }

aws cloudfront update-distribution \
  --id "$CLOUDFRONT_DIST_ID" \
  --if-match "$ETAG" \
  --distribution-config "file:///tmp/cf-config.json" \
  > /tmp/cf-updated.json

NEW_STATUS=$(jq -r '.Distribution.Status' /tmp/cf-updated.json)

echo "============================================================"
echo "Geo-redirect function detached."
echo "  Distribution : $CLOUDFRONT_DIST_ID"
echo "  Status       : $NEW_STATUS  (edge propagation ~5 min)"
echo ""
echo "Locale-less URLs no longer geo-redirect. Users landing on / see"
echo "the English default. Explicit /de/edit etc. still work."
echo ""
echo "The function itself remains published in CloudFront. Re-attach with:"
echo "  bash infra/cloudfront-publish-geo-redirect.sh"
echo "============================================================"
