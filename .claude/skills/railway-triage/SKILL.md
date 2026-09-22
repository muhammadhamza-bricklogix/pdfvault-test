---
name: railway-triage
description: Use whenever the user mentions Railway infrastructure health — phrases like "check Railway", "Railway is down", "deploy failed", "service is slow", "check my services", "check backend", "check API", "500 errors from backend", "why is production broken", "check logs", "spike in errors", "backend is unreachable", "Railway restart loop", "healthcheck failing", or a bare paste of a Railway alert/error. Runs the standard Railway diagnostic sweep (services → status → metrics → logs → error rate) via the railway MCP tools and returns a color-coded triage report so the user doesn't have to re-explain what to check. Also fires when the user asks generic "is my infra up" or "check on production" questions without naming Railway explicitly — this repo's backend runs on Railway.
---

# Railway triage

The backend for this app runs on Railway. When the user reports "backend is slow", "500s in production", "API not responding", or bare paste of a Railway alert, the standard investigation is the same every time: list services → check statuses → pull recent logs → check error rate → check response time. Doing it from scratch each time is wasteful; this skill codifies the sweep.

Your job when this skill fires: run the diagnostic set in order, digest the output, and hand the user a short triage report with a proposed action. Do NOT restart services, redeploy, or change environment variables without explicit approval — those are Phase 4 actions gated by `problem-triage`.

## When this skill applies

- User mentions Railway explicitly: "Railway", "Railway deploy", "Railway logs"
- User names the backend surface without naming Railway: "backend is broken", "API is down", "prod is slow", "check my server"
- User pastes an error or metric that looks Railway-ish (`railway.app` in URL, service ID, healthcheck failure)
- User asks "is prod up" / "check production" / "is everything running"

If the user is asking about frontend / Next.js runtime issues (this repo ships to CloudFront + Vercel-style, not Railway), do NOT run this sweep. Ask which surface.

## Prerequisites — verify tool access

Before diving in, confirm the Railway MCP tools are available. They're prefixed `mcp__railway__*`. Quick check:

```
mcp__railway__whoami
mcp__railway__list-projects
```

If `whoami` errors with an auth failure, tell the user: "Railway MCP not authenticated — run `railway login` in a terminal, or set `RAILWAY_TOKEN` in Claude Code settings." Stop the sweep until fixed.

If `list-projects` returns >1 project, ask the user which project to triage before proceeding. Do not guess.

## The sweep — run in order

### Step 1 — Scope the environment

```
mcp__railway__list-projects
→ pick the project matching this repo (usually named "pdfvault" or "pdf-viewer" or similar)

mcp__railway__list-services  { projectId }
→ get every service in the project (API, worker, DB, etc.)
```

Record: project ID, environment ID (usually "production"), service IDs + names.

### Step 2 — Status per service

For each service:

```
mcp__railway__describe-service { serviceId, environmentId }
mcp__railway__get-status       { serviceId, environmentId }
```

Look for:
- Deployment status = `SUCCESS` / `FAILED` / `CRASHED` / `RESTARTING`
- Restart count in the last hour
- Healthcheck state

Any service in FAILED, CRASHED, or in a restart loop is your prime suspect.

### Step 3 — Deployment history (only if a service looks unhealthy)

```
mcp__railway__list-deployments { serviceId, environmentId, limit: 5 }
```

The most recent deploy is the most likely cause of a sudden regression. Note the deploy ID, commit SHA, and time. If needed:

```
mcp__railway__get-deployment-diagnosis { deploymentId }
```

This surfaces build errors, startup crashes, port binding failures — the usual suspects.

### Step 4 — Recent logs (windowed)

For each unhealthy or user-reported service:

```
mcp__railway__get-logs { serviceId, environmentId, limit: 200 }
```

Scan for:
- Uncaught exceptions / stack traces
- `EADDRINUSE`, `ECONNREFUSED`, `ENOTFOUND`
- Out-of-memory (`OOMKilled`, `heap out of memory`)
- Rate limits from upstream (Solidgate, Clerk, S3)
- Repeated identical errors (indicates a hot path failing)

If logs are empty, that itself is a signal — the service may not be receiving traffic.

### Step 5 — Metrics (only for slow / partial-failure reports)

```
mcp__railway__http-error-rate    { serviceId, environmentId }
mcp__railway__http-response-time { serviceId, environmentId }
mcp__railway__http-requests      { serviceId, environmentId }
mcp__railway__get-service-metrics { serviceId, environmentId }
```

A healthy service typically shows:
- Error rate under 1%
- p95 response time under 500ms (adjust per service)
- Request volume matching business hours

### Step 6 — Environment / variables (only if config regression is suspected)

```
mcp__railway__list-variables { serviceId, environmentId }
```

Do NOT print secret values to the user. Report only variable NAMES and whether they're set / empty. Flag any variable ending in `_KEY`, `_SECRET`, `_TOKEN`, `_PASSWORD` — never surface the value.

## Triage report shape

Return to the user in this exact format:

```
Railway triage — <project name>

Services:
  <service-a>: 🟢 healthy — deploy <sha> 12h ago, 0.2% err, p95 340ms
  <service-b>: 🟡 degraded — deploy <sha> 40m ago, 4.1% err, p95 1.8s
  <service-c>: 🔴 failing — CRASHED at <time>, 3 restart attempts

Signal (from logs):
  - <service-b>: repeated "ETIMEDOUT connecting to solidgate.com" (57 hits in last hour)
  - <service-c>: startup error "PORT env var missing"

Most likely cause: <one-line hypothesis>

Proposed action:
  [1] Restart <service-c>          (safe, reversible — 30s downtime)
  [2] Rollback <service-b> to <prev-sha>  (safe if the prev deploy was healthy)
  [3] Set PORT=8080 on <service-c>       (config fix — 1 min downtime)

Need from you: pick [1] / [2] / [3] / other, then I execute. No changes yet.
```

**Never** silently execute restart / redeploy / variable change. Every action is a Phase 4 step gated by explicit approval, per `problem-triage`.

## Restart / redeploy — only after approval

If the user approves an action:

- **Restart:** `mcp__railway__restart-service { serviceId, environmentId }`. Confirm status returns to healthy after ~60s.
- **Redeploy:** `mcp__railway__redeploy { serviceId, environmentId, deploymentId }`. Point to the last known-good deploy.
- **Variable change:** `mcp__railway__set-variables { serviceId, environmentId, variables: {...} }`. Confirm the change and note it triggers an automatic redeploy.
- **Rollback:** find the last SUCCESS deploy in `list-deployments`, then `mcp__railway__redeploy` with that deployment ID.

After ANY action, re-run Step 2 (status) and Step 5 (metrics) to confirm the fix landed and metrics returned to green.

## Escalation — when to use the Railway agent

If the diagnostic sweep can't localize the fault after Steps 1–5, or the fix requires cross-service reasoning (DB migration + API deploy + worker restart), invoke:

```
mcp__railway__railway-agent { prompt: "<self-contained brief>" }
```

The Railway agent has deeper Railway-side reasoning and can operate across services. Do NOT reflexively invoke it — use it when the local sweep is genuinely inconclusive.

## Common failure patterns in this project

| Symptom | Likely cause | Fix |
|---|---|---|
| Backend responds slow for 5-10 min after deploy, then normal | Cold-start on ECS-style scaling; first requests hit fresh containers | Wait it out, or bump min replicas |
| Solidgate webhook drops with 500 | Webhook secret rotated in Solidgate dashboard but not in Railway env | Update `SOLIDGATE_WEBHOOK_SECRET` variable |
| Auth requests 401 in prod, work in dev | Clerk publishable key mismatch between environments | Compare `CLERK_PUBLISHABLE_KEY` across environments |
| Upload endpoint returns 413 | Body-parser limit lower than Cloudflare / CloudFront max | Increase `MAX_UPLOAD_BYTES` env or middleware limit |
| Healthcheck fails at deploy, but service otherwise runs | Healthcheck path doesn't match app routes (usually `/_health` vs `/api/health`) | Fix healthcheck path in Railway service settings |

## What NOT to do

- Do NOT redeploy without approval. A redeploy costs 1-3 minutes downtime.
- Do NOT change environment variables without approval, even to "fix a typo".
- Do NOT surface secret values to the user in plain text.
- Do NOT `mcp__railway__accept-deploy` without explicit approval — that promotes staged changes.
- Do NOT run `delete-service`, `delete-volume`, `delete-bucket`, `delete-tcp-proxy` in triage. Ever. Even if the user says so, confirm with a full sentence acknowledging the destruction.
- Do NOT skip Step 4 (logs). A metrics-only view misses causes; a logs-only view misses scope.

## Cross-references

- `problem-triage` — the parent flow; this skill executes Phase 2 for Railway surfaces
- `use-railway` (plugin skill) — deep reference on Railway CLI, feature flags, IaC, tracing
- `regression-forensics` — if the failure correlates with a recent deploy, load this too
