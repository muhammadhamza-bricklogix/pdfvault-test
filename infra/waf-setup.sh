#!/usr/bin/env bash
# =============================================================================
# AWS WAFv2 Web ACL for PDFedits CloudFront distribution
#
# Purpose: bot + abuse protection at the edge. Sits in front of the
# CloudFront distribution created by cloudfront-setup.sh.
#
# Adds three rules:
#   1. AWSManagedRulesAmazonIpReputationList — blocks known-bad IPs (free)
#   2. AWSManagedRulesCommonRuleSet          — OWASP-style baseline (free)
#   3. Rate-based rule                        — throttles /sign-up /sign-in
#      to 100 requests / 5 min per source IP (adjustable via RATE_LIMIT)
#
# WAF for CloudFront MUST live in us-east-1 (Global scope).
#
# BEFORE RUNNING:
#   1. Set CF_DISTRIBUTION_ID to the distribution ID from
#      cloudfront-setup.sh (starts with E…). Find it via:
#        aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DomainName]' --output table
#   2. AWS CLI configured for an IAM user with wafv2:* + cloudfront:UpdateDistribution.
#
# AFTER RUNNING:
#   1. Wait ~5–10 min for CloudFront to propagate the association.
#   2. Test /sign-up in the browser — should load normally.
#   3. Rate-limit test: from a single IP, run
#        for i in $(seq 1 120); do curl -o /dev/null -s -w '%{http_code}\n' https://pdfvault.ai/sign-up; done
#      Expect 429s once you cross 100 in a 5-min window.
#   4. Monitor WAF metrics in CloudWatch → WAFv2 namespace.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Config — set these before running
# ---------------------------------------------------------------------------
CF_DISTRIBUTION_ID=""                 # e.g. "E1ABC23DEF456G"  (REQUIRED)
WEB_ACL_NAME="pdfedits-frontend-acl"
RATE_LIMIT="100"                      # requests per 5 min per IP on gated paths
REGION="us-east-1"                    # MUST be us-east-1 for CloudFront scope

if [[ -z "$CF_DISTRIBUTION_ID" ]]; then
  echo "ERROR: set CF_DISTRIBUTION_ID at the top of this script." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Build the Web ACL rules JSON
# ---------------------------------------------------------------------------
RULES_JSON=$(cat <<'ENDRULES'
[
  {
    "Name": "AWS-AWSManagedRulesAmazonIpReputationList",
    "Priority": 0,
    "Statement": {
      "ManagedRuleGroupStatement": {
        "VendorName": "AWS",
        "Name": "AWSManagedRulesAmazonIpReputationList"
      }
    },
    "OverrideAction": {"None": {}},
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "AWSManagedRulesAmazonIpReputationList"
    }
  },
  {
    "Name": "AWS-AWSManagedRulesCommonRuleSet",
    "Priority": 1,
    "Statement": {
      "ManagedRuleGroupStatement": {
        "VendorName": "AWS",
        "Name": "AWSManagedRulesCommonRuleSet",
        "RuleActionOverrides": [
          {
            "Name": "SizeRestrictions_BODY",
            "ActionToUse": {"Count": {}}
          }
        ]
      }
    },
    "OverrideAction": {"None": {}},
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "AWSManagedRulesCommonRuleSet"
    }
  },
  {
    "Name": "RateLimit-SignupSignin",
    "Priority": 2,
    "Statement": {
      "RateBasedStatement": {
        "Limit": __RATE_LIMIT__,
        "AggregateKeyType": "IP",
        "ScopeDownStatement": {
          "OrStatement": {
            "Statements": [
              {
                "ByteMatchStatement": {
                  "SearchString": "/sign-up",
                  "FieldToMatch": {"UriPath": {}},
                  "TextTransformations": [{"Priority": 0, "Type": "LOWERCASE"}],
                  "PositionalConstraint": "STARTS_WITH"
                }
              },
              {
                "ByteMatchStatement": {
                  "SearchString": "/sign-in",
                  "FieldToMatch": {"UriPath": {}},
                  "TextTransformations": [{"Priority": 0, "Type": "LOWERCASE"}],
                  "PositionalConstraint": "STARTS_WITH"
                }
              }
            ]
          }
        }
      }
    },
    "Action": {"Block": {}},
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "RateLimitSignupSignin"
    }
  }
]
ENDRULES
)

# Substitute rate limit into the template
RULES_JSON="${RULES_JSON//__RATE_LIMIT__/$RATE_LIMIT}"

# ---------------------------------------------------------------------------
# 2. Create the Web ACL (Global scope for CloudFront)
# ---------------------------------------------------------------------------
echo "Creating WAF Web ACL '$WEB_ACL_NAME' in $REGION (CLOUDFRONT scope)..."

CREATE_OUT=$(aws wafv2 create-web-acl \
  --region "$REGION" \
  --scope CLOUDFRONT \
  --name "$WEB_ACL_NAME" \
  --description "PDFedits frontend WAF — IP reputation + baseline + rate limit" \
  --default-action Allow={} \
  --visibility-config "SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=${WEB_ACL_NAME}" \
  --rules "$RULES_JSON" \
  --output json)

WEB_ACL_ID=$(echo "$CREATE_OUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['Summary']['Id'])")
WEB_ACL_ARN=$(echo "$CREATE_OUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['Summary']['ARN'])")

echo "  Web ACL ID  : $WEB_ACL_ID"
echo "  Web ACL ARN : $WEB_ACL_ARN"
echo ""

# ---------------------------------------------------------------------------
# 3. Associate the Web ACL with the CloudFront distribution
# ---------------------------------------------------------------------------
echo "Attaching Web ACL to CloudFront distribution $CF_DISTRIBUTION_ID..."

# CloudFront association is done via update-distribution with WebACLId set on
# the DistributionConfig — the wafv2 associate-web-acl API doesn't accept
# CloudFront ARNs.
DIST_ETAG=$(aws cloudfront get-distribution-config \
  --id "$CF_DISTRIBUTION_ID" \
  --query 'ETag' --output text)

aws cloudfront get-distribution-config --id "$CF_DISTRIBUTION_ID" \
  --output json > /tmp/pdfedits-dist-config.json

python3 - <<PYEOF
import json
with open("/tmp/pdfedits-dist-config.json") as f:
    data = json.load(f)
data["DistributionConfig"]["WebACLId"] = "$WEB_ACL_ARN"
with open("/tmp/pdfedits-dist-config-updated.json", "w") as f:
    json.dump(data["DistributionConfig"], f)
PYEOF

aws cloudfront update-distribution \
  --id "$CF_DISTRIBUTION_ID" \
  --if-match "$DIST_ETAG" \
  --distribution-config file:///tmp/pdfedits-dist-config-updated.json \
  --output json > /dev/null

rm -f /tmp/pdfedits-dist-config.json /tmp/pdfedits-dist-config-updated.json

echo "============================================================"
echo "WAF setup complete."
echo ""
echo "  Web ACL     : $WEB_ACL_NAME ($WEB_ACL_ID)"
echo "  Rate limit  : $RATE_LIMIT req / 5 min per IP on /sign-up + /sign-in"
echo "  Attached to : $CF_DISTRIBUTION_ID"
echo ""
echo "  Console : https://console.aws.amazon.com/wafv2/homev2/web-acl/${WEB_ACL_NAME}/${WEB_ACL_ID}/overview?region=global"
echo ""
echo "NEXT:"
echo "  - Wait 5–10 min for CloudFront to propagate association."
echo "  - Test /sign-up loads normally in browser."
echo "  - Rate-limit smoke test (from a single IP):"
echo "      for i in \$(seq 1 120); do curl -o /dev/null -s -w '%{http_code}\\n' https://pdfvault.ai/sign-up; done"
echo "    Expect 429s past request ~100."
echo "  - Watch CloudWatch → WAFv2 metrics for blocked-request counts."
echo "============================================================"
