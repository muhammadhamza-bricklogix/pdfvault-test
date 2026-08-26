# syntax=docker/dockerfile:1.6
#
# Frontend (Next.js 16, App Router) — multi-stage image for ECS Fargate.
#
#   Build stage  : Bun 1.2 (matches `engines.bun` in package.json) — installs
#                  deps + runs `next build` with output: "standalone".
#   Runtime stage: node:22-bookworm-slim — runs the standalone server. Smaller
#                  + better-tested than running Next prod under Bun today.
#
# Listens on $PORT (default 3000). HOSTNAME=0.0.0.0 is REQUIRED inside a
# container so the server binds to the network interface (not 127.0.0.1).
#
# NEXT_PUBLIC_* env vars are inlined at BUILD time by Next.js, so we expose
# them as ARGs here. ECS task definitions should pass them via --build-arg
# at image-build time (CodeBuild / GitHub Actions). Runtime-only secrets
# (CLERK_SECRET_KEY, SHARE_SECRET) are passed via task-definition env / SSM
# at container start.

# ---------- Stage 1: build ----------
# Bun 1.3.13 required for Next 16.3+: worker_threads.Worker options
# (stdout/stderr/resourceLimits) and Turbopack's CommonJS-wrapping runtime
# both crash on 1.2.19. Keep this in lockstep with `engines.bun` in
# package.json.
FROM oven/bun:1.3.13-slim AS builder

WORKDIR /app

# Build-time (NEXT_PUBLIC_*) inputs. These get baked into the JS bundle —
# rebuild when they change. Defaults are placeholders that fail fast at
# runtime if not overridden.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_GOOGLE_API_KEY
ARG NEXT_PUBLIC_MICROSOFT_CLIENT_ID
ARG NEXT_PUBLIC_MICROSOFT_TENANT_ID
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_WEGLOT_API_KEY
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID} \
    NEXT_PUBLIC_GOOGLE_API_KEY=${NEXT_PUBLIC_GOOGLE_API_KEY} \
    NEXT_PUBLIC_MICROSOFT_CLIENT_ID=${NEXT_PUBLIC_MICROSOFT_CLIENT_ID} \
    NEXT_PUBLIC_MICROSOFT_TENANT_ID=${NEXT_PUBLIC_MICROSOFT_TENANT_ID} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_WEGLOT_API_KEY=${NEXT_PUBLIC_WEGLOT_API_KEY} \
    NEXT_TELEMETRY_DISABLED=1

# Copy the lockfile so Bun can do a reproducible install.
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy the rest of the app and build.
COPY . .
RUN bun run build

# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Non-root runtime user — Fargate runs as root by default; we drop privileges
# defensively. UID/GID match what next start expects.
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Copy ONLY the standalone bundle, the .next/static output, and the
# public/ folder. The standalone server includes a trimmed node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Standalone server entry. Reads HOSTNAME + PORT from the env above.
CMD ["node", "server.js"]
