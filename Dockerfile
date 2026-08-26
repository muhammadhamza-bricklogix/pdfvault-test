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

# ---------- Stage 1a: install deps with Bun (fast, deterministic) ----------
FROM oven/bun:1.3.13-slim AS deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile


# ---------- Stage 1b: build with Node (Bun crashes on Next's built CJS) ----------
# Next 16 executes emitted CJS chunks during "Collecting page data" to
# resolve dynamic params, sitemap entries, generateStaticParams, etc. Bun's
# require() implementation rejects those wrapped modules with
# "Expected CommonJS module to have a function wrapper" and crashes
# (SIGILL under Turbopack, TypeError under webpack). Node handles them
# natively — this stage uses Node just for `next build`, keeping the fast
# Bun install from the previous stage.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

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

# Reuse the resolved dep tree from the Bun install so we don't run a
# second, slower npm install here. Files are already immutable for the
# build so ownership stays root:root.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Invoke next directly through node so nothing in the build stack falls
# back to Bun's runtime.
RUN node ./node_modules/next/dist/bin/next build --webpack

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
