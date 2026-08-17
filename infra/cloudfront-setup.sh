#!/usr/bin/env bash
# =============================================================================
# CloudFront CDN setup for PDFedits (pdfvault-alb → CloudFront)
#
# BEFORE RUNNING:
#   1. Ensure AWS CLI is configured for the Hamza IAM user (already done)
#   2. If you want a custom domain (pdfedits.io), you need an ACM certificate
#      in us-east-1. See the "Certificate" section below.
#   3. Run this script once. It creates a CloudFront distribution and prints
#      the CloudFront domain. Test on that domain before updating DNS.
#
# AFTER RUNNING:
#   1. Copy the printed CloudFront domain (e.g. d1abc123.cloudfront.net)
#   2. Test: open https://<cloudfront-domain>/ in your browser
#   3. Verify caching: DevTools Network → reload → /_next/static/*.js should
#      show "X-Cache: Hit from cloudfront" and an "Age" header on second load
#   4. Update DNS: point pdfedits.io CNAME → <cloudfront-domain>
#      (or an ALIAS record if on Route 53)
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Config — update these if your setup changes
# ---------------------------------------------------------------------------
ALB_DNS="pdfvault-alb-510929358.us-east-1.elb.amazonaws.com"
DISTRIBUTION_COMMENT="PDFedits frontend CDN"
PRICE_CLASS="PriceClass_All"   # All edge locations globally (US/EU/Asia/ME)
                                # Change to PriceClass_100 for US+EU only (cheaper)

# Optional: set your ACM certificate ARN here for pdfedits.io / www.pdfedits.io
# Leave empty to use the .cloudfront.net domain only (good for testing).
# The cert MUST be in us-east-1 (CloudFront requirement).
# Create at: https://console.aws.amazon.com/acm/home?region=us-east-1
ACM_CERT_ARN=""   # e.g. "arn:aws:acm:us-east-1:633321546885:certificate/..."
CUSTOM_DOMAINS=""  # e.g. "pdfedits.io,www.pdfedits.io" — comma-separated

# ---------------------------------------------------------------------------
# Cache policies (managed by AWS, no maintenance needed)
# ---------------------------------------------------------------------------
# AWS-managed CachingOptimized: long TTL, compress, cache based on URL only
CACHING_OPTIMIZED_POLICY="658327ea-f89d-4fab-a63d-7e88639e58f6"
# AWS-managed CachingDisabled: TTL=0, always fetches from origin
CACHING_DISABLED_POLICY="4135ea2d-6df8-44a3-9df3-4b5a84be39ad"

# AWS-managed AllViewer: forwards all headers, cookies, query strings to origin
ALL_VIEWER_ORIGIN_REQUEST="b689b0a8-53d0-40ab-baf2-68738e2966ac"

# ---------------------------------------------------------------------------
# Build the distribution config JSON
# ---------------------------------------------------------------------------
CALLER_REF="pdfedits-cf-$(date +%s)"

# Build aliases block only if custom domains are set
if [[ -n "$ACM_CERT_ARN" && -n "$CUSTOM_DOMAINS" ]]; then
  IFS=',' read -ra DOMAIN_ARRAY <<< "$CUSTOM_DOMAINS"
  ALIAS_ITEMS=""
  for d in "${DOMAIN_ARRAY[@]}"; do
    ALIAS_ITEMS+="\"${d}\","
  done
  ALIAS_ITEMS="${ALIAS_ITEMS%,}"   # strip trailing comma

  ALIASES_BLOCK='"Aliases": {"Quantity": '"${#DOMAIN_ARRAY[@]}"',"Items": ['"$ALIAS_ITEMS"']},'
  VIEWER_CERT_BLOCK='"ViewerCertificate": {"ACMCertificateArn": "'"$ACM_CERT_ARN"'","SSLSupportMethod": "sni-only","MinimumProtocolVersion": "TLSv1.2_2021"},'
else
  ALIASES_BLOCK='"Aliases": {"Quantity": 0},'
  VIEWER_CERT_BLOCK='"ViewerCertificate": {"CloudFrontDefaultCertificate": true},'
fi

CONFIG=$(cat <<ENDJSON
{
  "CallerReference": "$CALLER_REF",
  "Comment": "$DISTRIBUTION_COMMENT",
  $ALIASES_BLOCK
  $VIEWER_CERT_BLOCK
  "PriceClass": "$PRICE_CLASS",
  "HttpVersion": "http2and3",
  "IsIPV6Enabled": true,
  "DefaultRootObject": "",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "pdfvault-alb",
        "DomainName": "$ALB_DNS",
        "CustomOriginConfig": {
          "HTTPSPort": 443,
          "HTTPPort": 80,
          "OriginProtocolPolicy": "https-only",
          "OriginSslProtocols": {"Quantity": 1,"Items": ["TLSv1.2"]},
          "OriginReadTimeout": 60,
          "OriginKeepaliveTimeout": 60
        }
      }
    ]
  },
  "CacheBehaviors": {
    "Quantity": 4,
    "Items": [
      {
        "PathPattern": "/_next/static/*",
        "TargetOriginId": "pdfvault-alb",
        "ViewerProtocolPolicy": "redirect-to-https",
        "Compress": true,
        "CachePolicyId": "$CACHING_OPTIMIZED_POLICY",
        "AllowedMethods": {"Quantity": 2,"Items": ["GET","HEAD"],"CachedMethods": {"Quantity": 2,"Items": ["GET","HEAD"]}}
      },
      {
        "PathPattern": "/_next/image*",
        "TargetOriginId": "pdfvault-alb",
        "ViewerProtocolPolicy": "redirect-to-https",
        "Compress": true,
        "CachePolicyId": "$CACHING_OPTIMIZED_POLICY",
        "AllowedMethods": {"Quantity": 2,"Items": ["GET","HEAD"],"CachedMethods": {"Quantity": 2,"Items": ["GET","HEAD"]}}
      },
      {
        "PathPattern": "/api/*",
        "TargetOriginId": "pdfvault-alb",
        "ViewerProtocolPolicy": "redirect-to-https",
        "Compress": true,
        "CachePolicyId": "$CACHING_DISABLED_POLICY",
        "OriginRequestPolicyId": "$ALL_VIEWER_ORIGIN_REQUEST",
        "AllowedMethods": {"Quantity": 7,"Items": ["GET","HEAD","OPTIONS","PUT","PATCH","POST","DELETE"],"CachedMethods": {"Quantity": 2,"Items": ["GET","HEAD"]}}
      },
      {
        "PathPattern": "/share/*",
        "TargetOriginId": "pdfvault-alb",
        "ViewerProtocolPolicy": "redirect-to-https",
        "Compress": false,
        "CachePolicyId": "$CACHING_DISABLED_POLICY",
        "OriginRequestPolicyId": "$ALL_VIEWER_ORIGIN_REQUEST",
        "AllowedMethods": {"Quantity": 7,"Items": ["GET","HEAD","OPTIONS","PUT","PATCH","POST","DELETE"],"CachedMethods": {"Quantity": 2,"Items": ["GET","HEAD"]}}
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "pdfvault-alb",
    "ViewerProtocolPolicy": "redirect-to-https",
    "Compress": true,
    "CachePolicyId": "$CACHING_DISABLED_POLICY",
    "OriginRequestPolicyId": "$ALL_VIEWER_ORIGIN_REQUEST",
    "AllowedMethods": {"Quantity": 7,"Items": ["GET","HEAD","OPTIONS","PUT","PATCH","POST","DELETE"],"CachedMethods": {"Quantity": 2,"Items": ["GET","HEAD"]}}
  },
  "Enabled": true
}
ENDJSON
)

# ---------------------------------------------------------------------------
# Create the distribution
# ---------------------------------------------------------------------------
echo "Creating CloudFront distribution..."
echo "Origin: $ALB_DNS"
echo "Price class: $PRICE_CLASS"
echo ""

RESULT=$(aws cloudfront create-distribution --distribution-config "$CONFIG" --output json)

CF_DOMAIN=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Distribution']['DomainName'])")
CF_ID=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Distribution']['Id'])")
CF_STATUS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Distribution']['Status'])")

echo "============================================================"
echo "CloudFront distribution created!"
echo ""
echo "  Distribution ID : $CF_ID"
echo "  Domain          : https://$CF_DOMAIN"
echo "  Status          : $CF_STATUS  (deploying to edge — takes ~5 min)"
echo ""
echo "NEXT STEPS:"
echo "  1. Wait ~5 minutes for the distribution to finish deploying"
echo "     aws cloudfront get-distribution --id $CF_ID --query 'Distribution.Status'"
echo ""
echo "  2. Test the CloudFront domain:"
echo "     curl -I https://$CF_DOMAIN/_next/static/  (expect 200 or 404)"
echo "     Open https://$CF_DOMAIN in your browser"
echo ""
if [[ -n "$ACM_CERT_ARN" && -n "$CUSTOM_DOMAINS" ]]; then
  echo "  3. Update DNS (pdfedits.io → CloudFront):"
  echo "     If Route 53: create ALIAS record pointing to $CF_DOMAIN"
  echo "     If external registrar: create CNAME record: pdfedits.io → $CF_DOMAIN"
  echo ""
fi
echo "  4. Verify caching (after DNS update or using CF domain):"
echo "     - Open DevTools Network tab"
echo "     - Hard reload the page"
echo "     - Soft reload"
echo "     - Check /_next/static/*.js → X-Cache: Hit from cloudfront"
echo "============================================================"
