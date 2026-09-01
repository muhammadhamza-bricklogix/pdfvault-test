#!/usr/bin/env bash
set -euo pipefail

# Build and push the frontend image using secrets from AWS Secrets Manager.
# This avoids manually passing Clerk/API keys and prevents mismatched builds.
#
# Usage:
#   AWS_PROFILE=Hamza ./scripts/build-frontend-image.sh

AWS_PROFILE="${AWS_PROFILE:-Hamza}"
AWS_REGION="${AWS_REGION:-us-east-1}"
SECRET_ARN="${SECRET_ARN:-arn:aws:secretsmanager:us-east-1:633321546885:secret:pdfvault-pYG5qu}"
ECR_REPO="${ECR_REPO:-633321546885.dkr.ecr.us-east-1.amazonaws.com/pdfvault-frontend}"

SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --query 'SecretString' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

API_BASE_URL=$(echo "$SECRET" | jq -r '.NEXT_PUBLIC_API_BASE_URL // "https://api.pdfvault.ai"')
CLERK_KEY=$(echo "$SECRET" | jq -r '.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY // .CLERK_PUBLISHABLE_KEY // empty')
WEGLOT_KEY=$(echo "$SECRET" | jq -r '.NEXT_PUBLIC_WEGLOT_API_KEY // empty')
# Env label. Silences the browser console when the built bundle runs in
# a "production" environment. Defaults to "production" for this script
# since it targets the prod ECR repo; override with `NEXT_PUBLIC_APP_ENV=staging`
# in the secret (or in the shell) for non-prod builds.
APP_ENV=$(echo "$SECRET" | jq -r '.NEXT_PUBLIC_APP_ENV // "production"')

if [ -z "$CLERK_KEY" ]; then
  echo "ERROR: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_PUBLISHABLE_KEY not found in secret." >&2
  exit 1
fi

# Ensure an amd64-capable builder exists (required on Apple Silicon Macs).
BUILDER_NAME="pdfvault-amd64-builder"
if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  echo "Creating multi-platform builder: $BUILDER_NAME"
  docker buildx create --name "$BUILDER_NAME" --driver docker-container --driver-opt network=host --use --bootstrap
else
  docker buildx use "$BUILDER_NAME"
fi

# Log in to ECR.
aws ecr get-login-password --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${ECR_REPO%/*}"

# Build and push for the ECS Fargate architecture (X86_64).
docker buildx build \
  --builder "$BUILDER_NAME" \
  --platform linux/amd64 \
  --build-arg "NEXT_PUBLIC_API_BASE_URL=$API_BASE_URL" \
  --build-arg "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_KEY" \
  --build-arg "NEXT_PUBLIC_WEGLOT_API_KEY=$WEGLOT_KEY" \
  --build-arg "NEXT_PUBLIC_APP_ENV=$APP_ENV" \
  -t "$ECR_REPO:latest" \
  --push .

echo "Pushed $ECR_REPO:latest"
echo "Force a new deployment with:"
echo "  aws ecs update-service --cluster pdfvault-cluster --service pdfvault-frontend-service-arskp30n --force-new-deployment --region $AWS_REGION --profile $AWS_PROFILE"
