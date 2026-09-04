#!/usr/bin/env bash
# =============================================================================
# Publish the geo-redirect CloudFront Function and attach it to the
# distribution's DEFAULT cache behavior on viewer-request.
#
# The default cache behavior serves everything not caught by a specific
# path pattern — the root domain, landing pages, `/edit`, `/pricing`,
# etc. The function short-circuits before origin, so all locale-less
# public URLs get evaluated for geo redirect at the edge.
#
# NOTE ON KILL-SWITCH:
#   The function file itself has `GEO_REDIRECT_ENABLED = false` by
#   default. Attaching the function to the distribution does NOT flip
#   the geo redirect on — you still need to edit the JS to set it true
#   AND re-run this script (which republishes). This is intentional so
#   the attach + smoke-test cycle is safe.
#
# REQUIREMENTS:
#   export CLOUDFRONT_DIST_ID="E2ABC123XYZ"
#   aws CLI configured with cloudfront:CreateFunction / UpdateFunction /
#     PublishFunction / GetFunction / GetDistributionConfig /
#     UpdateDistribution permissions
#   jq installed
#
# USAGE:
#   bash infra/cloudfront-publish-geo-redirect.sh
# =============================================================================

set -euo pipefail

: "${CLOUDFRONT_DIST_ID:?Missing CLOUDFRONT_DIST_ID env var}"
command -v jq >/dev/null 2>&1 || { echo "jq required — install with: brew install jq"; exit 1; }

FUNCTION_NAME="pdfvault-geo-redirect"
FUNCTION_FILE="$(dirname "$0")/cloudfront-functions/geo-redirect.js"
FUNCTION_COMMENT="Geo-IP defaulting for pdfvault.ai"
FUNCTION_RUNTIME="cloudfront-js-2.0"

if [[ ! -f "$FUNCTION_FILE" ]]; then
  echo "Function source not found at $FUNCTION_FILE"
  exit 1
fi

# ---------------------------------------------------------------------------
# Create or update the function code
# ---------------------------------------------------------------------------
echo "→ Checking if function $FUNCTION_NAME exists"
if aws cloudfront describe-function --name "$FUNCTION_NAME" > /tmp/geo-fn-describe.json 2>/dev/null; then
  ETAG=$(jq -r '.ETag' /tmp/geo-fn-describe.json)
  echo "  Function exists (ETag: $ETAG). Updating code."
  aws cloudfront update-function \
    --name "$FUNCTION_NAME" \
    --if-match "$ETAG" \
    --function-config "Comment=${FUNCTION_COMMENT},Runtime=${FUNCTION_RUNTIME}" \
    --function-code "fileb://$FUNCTION_FILE" \
    > /tmp/geo-fn-updated.json
  ETAG=$(jq -r '.ETag' /tmp/geo-fn-updated.json)
  echo "  Updated (new ETag: $ETAG)"
else
  echo "  Function does not exist. Creating."
  aws cloudfront create-function \
    --name "$FUNCTION_NAME" \
    --function-config "Comment=${FUNCTION_COMMENT},Runtime=${FUNCTION_RUNTIME}" \
    --function-code "fileb://$FUNCTION_FILE" \
    > /tmp/geo-fn-created.json
  ETAG=$(jq -r '.ETag' /tmp/geo-fn-created.json)
  echo "  Created (ETag: $ETAG)"
fi

# ---------------------------------------------------------------------------
# Publish the function (moves DEVELOPMENT stage → LIVE)
# ---------------------------------------------------------------------------
echo "→ Publishing function $FUNCTION_NAME"
aws cloudfront publish-function \
  --name "$FUNCTION_NAME" \
  --if-match "$ETAG" \
  > /tmp/geo-fn-published.json
FUNCTION_ARN=$(jq -r '.FunctionSummary.FunctionMetadata.FunctionARN' /tmp/geo-fn-published.json)
echo "  Published: $FUNCTION_ARN"

# ---------------------------------------------------------------------------
# Attach to the distribution's default cache behavior on viewer-request
# ---------------------------------------------------------------------------
echo "→ Fetching distribution config for $CLOUDFRONT_DIST_ID"
aws cloudfront get-distribution-config \
  --id "$CLOUDFRONT_DIST_ID" \
  --output json > /tmp/cf-current.json

DIST_ETAG=$(jq -r '.ETag' /tmp/cf-current.json)
jq '.DistributionConfig' /tmp/cf-current.json > /tmp/cf-config.json

# Check if the function is already attached
CURRENT_ARN=$(jq -r '
  .DefaultCacheBehavior.FunctionAssociations.Items[]?
  | select(.EventType == "viewer-request") | .FunctionARN
' /tmp/cf-config.json | head -1)

if [[ "$CURRENT_ARN" == "$FUNCTION_ARN" ]]; then
  echo "→ Function already attached to default cache behavior (viewer-request). No config update needed."
  echo "  Function code was republished — new logic is now live at all edges within ~5 min."
  exit 0
fi

if [[ -n "$CURRENT_ARN" && "$CURRENT_ARN" != "null" ]]; then
  echo "⚠  Another function is attached: $CURRENT_ARN"
  read -p "Replace with $FUNCTION_ARN? (yes/no): " CONFIRM
  [[ "$CONFIRM" == "yes" ]] || { echo "Aborted."; exit 0; }
fi

echo "→ Attaching function to DefaultCacheBehavior viewer-request"
jq --arg arn "$FUNCTION_ARN" '
  .DefaultCacheBehavior.FunctionAssociations = {
    Quantity: 1,
    Items: [
      {FunctionARN: $arn, EventType: "viewer-request"}
    ]
  }
' /tmp/cf-config.json > /tmp/cf-config.next.json
mv /tmp/cf-config.next.json /tmp/cf-config.json

echo "→ Applying update-distribution"
aws cloudfront update-distribution \
  --id "$CLOUDFRONT_DIST_ID" \
  --if-match "$DIST_ETAG" \
  --distribution-config "file:///tmp/cf-config.json" \
  > /tmp/cf-updated.json

NEW_STATUS=$(jq -r '.Distribution.Status' /tmp/cf-updated.json)

echo ""
echo "============================================================"
echo "Geo-redirect function published + attached."
echo "  Function ARN : $FUNCTION_ARN"
echo "  Distribution : $CLOUDFRONT_DIST_ID"
echo "  Status       : $NEW_STATUS  (edge propagation ~5 min)"
echo ""
echo "IMPORTANT: kill-switch is OFF by default."
echo "  The function ships with GEO_REDIRECT_ENABLED = false."
echo "  It's now attached but does NOTHING until you flip the flag:"
echo ""
echo "  1. Edit infra/cloudfront-functions/geo-redirect.js"
echo "     var GEO_REDIRECT_ENABLED = true;"
echo "  2. bash infra/cloudfront-publish-geo-redirect.sh   (republishes)"
echo ""
echo "VERIFY once enabled + Deployed:"
echo "  curl -sI -H 'CloudFront-Viewer-Country: DE' https://pdfvault.ai/"
echo "  # Expect: 302 Location: /de + Set-Cookie: lang_pref=de"
echo ""
echo "  curl -sI -H 'CloudFront-Viewer-Country: US' https://pdfvault.ai/"
echo "  # Expect: 200 (EN default, no redirect)"
echo ""
echo "  curl -sI -H 'CloudFront-Viewer-Country: DE' -A 'Googlebot/2.1' https://pdfvault.ai/"
echo "  # Expect: 200 (bots never redirected)"
echo ""
echo "DISABLE without unattaching:"
echo "  Flip GEO_REDIRECT_ENABLED = false + republish."
echo ""
echo "FULL UNATTACH:"
echo "  bash infra/cloudfront-detach-geo-redirect.sh"
echo "============================================================"
