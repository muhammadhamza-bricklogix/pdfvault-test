# Phase 2 Estimate Review — Smart Vault + Intelligence + AI Actions

**Reviewer:** Engineering (principal-level estimate critique)
**Date:** 2026-06-13
**Scope reviewed:** Your Phase 2 estimate sheet comparing **Manual build** vs **AWS managed-first** effort (days), across workstreams 2.1–2.5 + the 10k-scale row.
**Verdict in one line:** The sheet is internally consistent and the managed-first *direction* is sound, but the committed number should be the **High** column — not the **AWS Low** column — and even that is missing several real workstreams. The "AWS Low ≈ 45 days" figure is a *stacked best-case* and is not safe to commit to.

> **Important caveat about what I could and couldn't verify.** This review was done from the **frontend repository only** (`pdfedits-frontend`). Per `docs/INFRASTRUCTURE.md` §3C and §14, the entire backend (storage, PDF processing, document library, audit) is a **separate service maintained outside this repo**, reached via `NEXT_PUBLIC_API_BASE_URL`. Almost all of Phase 2's effort lives there. So:
> - Claims I **could** verify (frontend): the service layer (`documentsService`, `pdfToolsService`), the axios client with Clerk bearer-token + refresh, and an SSE client for upload progress all exist. Object storage + short-lived signed URLs + server-side processing already work in the MVP.
> - Claims I **could not** verify (backend): whether the backend already has a transactional email provider, an analytics pipeline, an admin app, and a job queue. Several rows say "reuse (no extra time)" against these. **Those reuse claims must be validated by whoever owns the backend repo before you commit to the numbers.**

---

## 1. The single biggest structural problem: the estimate doesn't separate Frontend from Backend

Phase 2 is split across **two codebases and (almost certainly) two teams**:

| Lives in **this frontend repo** | Lives in the **separate backend repo** |
|---|---|
| Vault UI (grid/list, thumbnails, folders, multi-select) | S3/KMS storage model, quotas, multi-tenant isolation |
| Search bar, in-editor search, result previews, click-to-jump | OCR (Textract), text extraction, page-level indexing, FTS service |
| Document detail view + editable fields + confidence flags | Event-driven indexing pipeline (S3→Lambda), backfill |
| Summary panel, Q&A chat + streaming, Ask box | Intelligence pipeline (scan→OCR→classify→extract), Step Functions |
| Reminder UI / lead-time controls, in-app badges | Classification + extraction (Bedrock Data Automation) |
| Cancellation screen, usage/credits UI | Reminder engine (EventBridge + SES), Vault Digest |
| | AI orchestration (Bedrock calls, map-reduce, citations), usage metering |
| | Lifecycle jobs, billing gates, admin metadata APIs |

Roughly **two-thirds of the Phase 2 day-count is backend**, and it sits in a repo this estimate's reuse claims can't see into. The sheet collapses both sides into a single per-row number with **no FE/BE breakdown**. That hides three real costs that are *not line-itemed anywhere*:

1. **API contract design** — every new feature needs an agreed request/response shape between the two repos *before* either side can build. For ~15 new capabilities that's a meaningful, recurring design tax.
2. **Cross-team integration cycles** — FE and BE will not land simultaneously; there's mocking, contract drift, and re-integration each time. On a two-team build this commonly adds **20–40% to calendar time** even when effort-days are right.
3. **Coordination / sequencing** — 2.3 (AI actions) depends on 2.1 (extraction) and 2.2 (metadata). Effort-days ≠ calendar-days when there's a dependency chain across teams.

**Recommendation:** Re-cut the sheet with an **FE column and a BE column** per row, plus an explicit **"API contract + integration"** line per workstream (suggest +4–6 days total for 2.1–2.3). Then state whether the headline number is *effort-days* or *calendar-time* — they are very different here.

---

## 2. The "AWS Low" column conflates two different accelerators — and one of them is unreliable

The AWS-Low column bakes in **two** assumptions at once:

- **(a) Managed service replaces build** (Textract, Bedrock Data Automation, Step Functions, EventBridge, SES). This saving is **real and durable**.
- **(b) Claude Code writes the glue code faster.** This saving is **variable**, and it does **not** apply to the highest-variance work: prompt/accuracy tuning, OCR & table-extraction edge cases, load testing, security remediation, and (this app's chronic pain point) **mobile Safari**.

Stacking *both* accelerators *plus* the "reuse holds" assumption on every row means each AWS-Low cell is best-case³. The errors compound. The sheet itself admits tuning and load-testing "barely compress" — yet the compressed numbers still feed the 45-day headline.

> Note on my role specifically: I (Claude Code) operate in the **frontend** repo. I have **no visibility into the backend codebase**, so the assumption that "CC accelerates the backend" is unverifiable from here. Don't price the backend on my velocity.

**Recommendation:** **Commit to the High column.** Use AWS-Low only as an upside/stretch figure, never as the number you quote to a client or plan a release around.

---

## 3. Arithmetic & internal consistency

The math mostly ties out — good discipline:

| Check | Result |
|---|---|
| Manual Low total = 16 + 17.5 + 15.5 + 5 + 13 | **67** ✓ |
| Manual High total = 18 + 24.5 + 21 + 8 + 17 | **88.5** ✓ |
| AWS High total = 16.5 + 14 + 19 + 7.5 + 17 | **74** ✓ |
| "AWS Δ (high)" = Manual High − AWS High = 88.5 − 74 | **14.5** ✓ (matches the Δ-column sum) |

Two small issues:

- **2.1 AWS-Low subtotal shows 11.3, but the rows sum to ~11.6** (≈0.3 off). Minor; reconcile.
- **Several rows have no Low/High spread** — Admin panel (5/5), Prod deployment (2/2), and especially **Cross-cutting prompt tuning + load testing (3/3)**. A flat estimate with no range usually means it was *placeholdered, not estimated*. Tuning + load-testing is the **highest-variance activity in the entire project** and giving it a fixed 3 with no upper bound is the single most dangerous estimate in the sheet (realistic High: 8–10).

**One consistency point that matters for the business case:** the headline "14.5 days saved by managed-first" is **fragile** — **10.5 of those 14.5 saved days come entirely from the 2.2 intelligence-pipeline block** (the Bedrock Data Automation rows). If BDA underperforms on your real documents, most of the managed-first ROI evaporates. The decision to go managed-first should *not* be sold on the day-count delta alone; it's also an OPEX, vendor-lock-in, and accuracy-ceiling tradeoff.

---

## 4. Underestimation risks, ranked (highest → lowest)

### 4.1 — Classification + key-field extraction · AWS Low = **1 day** 🔴 most underestimated cell
Bedrock Data Automation removes the *ML training* work, not the *product* work. You still must: design the 8-category taxonomy, author per-document-type blueprint schemas, **iterate blueprints to acceptable accuracy on messy real-world docs** (insurance/legal/medical/tax all look different), tune confidence thresholds, and build the **low-confidence "unconfirmed" review loop**. Realistic even *with* BDA: **3–5 days**, not 1. Plus vendor risk: BDA is relatively new — check **regional availability** (a cross-region call here can conflict with data-residency, see §5), **quotas/TPS**, **cold-start latency**, and accuracy on *your* corpus, not the demo set.

### 4.2 — Vault UI · 1 day 🔴
"list/grid, thumbnails, folders, multi-select" is **not** one day. Thumbnails need page-1 render/generation; folders need CRUD + move + nesting + breadcrumbs; multi-select needs bulk-action UX and selection state. Realistic FE: **3–5 days**. The "1" almost certainly priced the list view only.

### 4.3 — "Ask about this document" (no vector store) · AWS Low = 2.5 days 🟠
The client wording makes **page citations a firm acceptance criterion** and **explicitly excludes a vector RAG index ("should not be quoted")** — which your estimate correctly honored. So the difficulty isn't optional: going **without RAG makes long documents harder, not easier**. With no retrieval you either stuff the whole doc into context (hits context-window limits, raises cost + latency) or build per-doc chunk/**map-reduce** (this is *in-document* chunking, not a RAG index — still allowed). **Citation verification** — confirming the cited page actually supports the answer — is the demo-vs-product gap and is fiddly. Realistic Low is higher; the High of 5 is the honest number.

### 4.4 — Cross-vault routing via Postgres FTS 🟡 *(downgraded after seeing the client wording)*
The confirmed client spec makes **"if no confident match, return the closest candidate documents rather than guessing" the spec itself** — graceful degradation is the *defined behaviour*, not a failure. That removes the hard "≥80% routing accuracy" gate I originally treated as a risk, so this is now lower-risk to *satisfy*. What remains is **product quality**, not acceptance: keyword FTS is weak at *semantic* routing ("when does my mortgage end?" won't keyword-match "mortgage"/"maturity date" reliably), so how good routing *feels* is downstream of how rich the **2.2 extracted metadata** is — a confident match on a structured "end date" field beats raw FTS. Net: the routing build is genuinely lightweight as scoped; just don't expect FTS alone to make it feel smart without good metadata behind it.

### 4.5 — Cross-cutting prompt tuning + load testing · 3/3 (no upper bound) 🟠
See §3. Widen to **3–10**. Single-point accuracy gates (routing ≥80%, the RFQ 50-question gate) need an explicit *"iterate until the gate passes"* budget, which is open-ended by nature.

### 4.6 — AI usage metering · AWS Low = 2 days 🟢 *(downgraded after seeing the client wording)*
The confirmed spec is a **simple credits counter per user per month, with config-driven limits and a clear in-product display** — i.e. *1 AI action = 1 credit*, reset monthly. That means **no token-level reconciliation** (the credits↔Bedrock-token mapping I originally worried about is out of scope), so **2 days is defensible**. Residual risk is small and only at scale: the per-user monthly increment needs to be race-safe (don't let a burst of concurrent AI actions overshoot the cap), which is a single atomic DB increment — or Redis *only if* you actually hit the 10k-concurrent bottleneck. Keep the limits in config as the client asked; don't hard-code them.

### 4.7 — Scale to 10k **concurrent** users · one row (2.5–5), excluded from the total 🟠
- If "concurrent" is literal, **PgBouncer + a read replica may not save Postgres FTS** under that load — search ranking + snippet generation is CPU-heavy. Be ready to move search to **OpenSearch**.
- "Managed services auto-scale" **ignores hard quotas/throttles**: Lambda account concurrency (default ~1000), **Bedrock per-model TPM/RPM** (10k concurrent Q&A likely needs **Provisioned Throughput** — significant $ + lead time), Textract/BDA TPS, SES sending limits, Step Functions limits. **None of these quota increases or throttle-handling paths are estimated.**
- This row is **outside the total** — either fold it in or flag clearly that the totals exclude scale hardening.

### 4.8 — Extract tables to Excel · 1.5 days 🟡
Textract Tables → `.xlsx` is fine for clean tables; **merged cells, multi-page tables, nested structures** wreck fidelity. 1.5 is demo-quality; production is higher.

### 4.9 — Summarise · AWS Low = 1 day 🟡
A single Bedrock call is a day, but **robust long-doc map-reduce** (chunking, partial-summary merge, 200-page docs) + panel + streaming + mobile is more. The High of 3 is realistic; the Low is aggressive.

### 4.10 — Born-digital vs scanned detection (inside 2.1 OCR) 🟡
Deciding per page whether to use `pdftotext` (free) or Textract, and handling **mixed PDFs** (some scanned pages), is a small but edge-prone task folded into nothing.

---

## 4A. The Zero-Data-Retention (ZDR) gate — a contractual requirement that must be proven *per service*

The confirmed client requirement is that the AI features are *"powered by a hosted LLM API under a **zero-data-retention agreement**."* This is a **hard, contractual gate**, not a nice-to-have, and it is **the most under-specified item in the estimate** — the sheet only notes "Bedrock ZDR-by-default meets the requirement," which is true for *one* of the three AWS services in play and **false for another**. ZDR must be established and evidenced **per service**, because each AWS service has a different default:

| Service (where used) | Default data-handling posture | What you must do for ZDR |
|---|---|---|
| **Bedrock — on-demand model invocation** (2.3 Summarise / Q&A / routing) | AWS states it does **not** store/log your prompts+completions, does not train on them, does not share with model providers. Effectively zero-retention by default. | **Defensible as-is — but** model-invocation logging is **opt-in**: if anyone enables it for debugging, retention is back on. Keep it **off** and document that. |
| **Bedrock Data Automation** (2.2 classify + extract — your heaviest AI user) | Newer service that ingests **whole documents**; "Bedrock = ZDR" does **not** automatically transfer. Output lands in *your* S3 (you control that). | **Verify explicitly** in the BDA service terms what AWS retains server-side. Do not assume. This is where the personal-document exposure is largest. |
| **Textract** (2.1 OCR / 2.3 table extraction) | **NOT zero-retention by default.** AWS may retain/use processed content to improve the service unless you opt out. | **Mandatory:** set an org-level **AI services opt-out policy** (AWS Organizations). Same applies to Comprehend/Rekognition if used. Without it you are *not* ZDR-compliant on scanned personal docs. |

Two more points the estimate misses:

- **"Agreement" = procurement/legal, not code.** For AWS, ZDR rests on the AWS service terms (+ a DPA/addendum if the client's counsel wants it in writing). If any **non-AWS hosted LLM** is ever substituted, zero-retention is a *contracted enterprise opt-in* with real lead time — budget **calendar time + a compliance deliverable that produces the signed evidence**, not engineering days. This reinforces §5.4 (compliance/privacy).
- **AWS terms change** — confirm the current posture of each service at contract time, not from this doc.

**Net:** add an explicit **"ZDR verification + AI-services opt-out config + evidence"** line (suggest ~1–2 eng-days for the Textract/Comprehend opt-out policy + BDA terms verification, plus legal/procurement calendar lead time that runs in parallel). It's small in effort but **blocking** — you can't ship the AI features to this client without it.

---

## 5. Workstreams missing entirely (not line-itemed anywhere)

These are real Phase 2 costs with no row today:

1. **API contract design + FE↔BE integration cycles** (see §1) — the biggest omission. **~+4–6 days.**
2. **Pipeline observability + DLQ / retry / idempotency.** S3→Lambda events can fire twice and Lambdas retry; reprocessing must not duplicate index rows or **double-fire reminders/emails**. The CloudWatch row is generic ops monitoring, not per-document pipeline tracing or stuck-doc alerting. **~+3–5 days.**
3. **Data backfill / migration** of existing MVP users' documents into the new vault metadata model + index (only a partial "backfill" appears under search). **~+2–4 days.**
4. **Compliance / privacy / data-handling review.** These are **personal documents** (insurance, legal, medical, tax). Sending them to **Textract / Bedrock / BDA** has data-handling and residency implications; the product already ships a **CCPA "do not sell"** page, so GDPR/CCPA obligations, access auditing, and a DPA with AWS are in scope. The "security checklist" row is **not** a privacy/compliance review — that's often **legal-gated** (calendar > effort). **~+3–6 days (+ legal lead time).**
5. **Prompt-injection / AI abuse hardening.** "Ask" runs an LLM over **untrusted document content** — a classic prompt-injection surface. No line item. **~+1–2 days.**
6. **Cost model / unit economics at 10k users.** Not an effort line, but a **deliverable a stakeholder will demand**: Textract (~$1.50/1k pages), Bedrock per-token, BDA per-page, storage, egress. **~+1–2 days.**
7. **Per-surface mobile QA.** This app's entire history is iOS-Safari regressions (see `CLAUDE.md`). **Every new FE surface** — summary panel, streaming Q&A chat, detail view, reminders, vault grid — needs mobile verification. Currently budgeted **once** (Q&A), not across the board. **~+3–5 days.**
8. **Empty / error / loading states** across all new surfaces — routinely 10–20% of FE effort, almost always uncounted. **~+2–4 days.**
9. **Dedicated QA / E2E automation** beyond 2.1's single "integration & testing" line (Playwright already exists in the repo — use it). **~+2–4 days.**

---

## 6. Estimating-method issues (the "how", not the "what")

- **No contingency/buffer.** Granular bottom-up sums systematically under-count integration glue and unknowns. Add an explicit **+25–40% risk buffer**, or a per-workstream "integration/unknowns" line.
- **Low = best-case³.** Managed-service-saves *and* CC-accelerates *and* reuse-holds, stacked per row. Don't commit to it.
- **No dependency graph / critical path.** 2.3 depends on 2.1+2.2; the pipeline is sequential. With two teams, effort-days ≠ calendar-days. If you're selling a *timeline*, you need the critical path drawn.
- **No "definition of done" per row.** The biggest swings (extraction, Q&A, tables) hinge entirely on **demo-quality vs production-quality vs an accuracy SLA** — which isn't stated. State the quality bar; it's where half the estimate variance hides.
- **Unverified "reuse" assumptions** (email provider, analytics stack, admin app) — see the caveat at the top. Each unconfirmed reuse is a few hidden days.

---

## 7. Bottom line & recommended numbers

**What's good:** the managed-first direction is the right call; the AWS service choices (Textract OCR, GuardDuty malware scan, Step Functions orchestration, EventBridge+SES for reminders/digest/lifecycle, BDA for classify+extract) are appropriate; the math ties out; the "no vector RAG" constraint is respected throughout.

**What to change before you commit:**

| Action | Why |
|---|---|
| **Quote the High column, not AWS-Low** | Low is a stacked best-case (§2) |
| **Add the missing workstreams in §5** | ~**+21 to +38 eng-days** not currently counted |
| **Fix the worst under-counts** (2.2 classify 1→3–5; Vault UI 1→3–5; tuning 3→3–10) | §4 |
| **Add a 25–40% buffer** on top | bottom-up sums under-count glue (§6) |
| **Split FE vs BE + add API-contract/integration lines** | two repos, two teams (§1) |
| **Verify backend "reuse" claims** (email, analytics, admin, queue) with the backend owner | top caveat |
| **Add a ZDR-verification line + set the Textract/Comprehend AI-services opt-out** | contractual gate; Textract is **not** zero-retention by default (§4A) |
| **Fold the 10k-scale row into the total** (or flag it's excluded) and add quota/Provisioned-Throughput work | §4.7 |

**Directional realistic range (AWS-managed track), engineering-days:**

- Your sheet's AWS Low: **45** · AWS High: **74**
- Add missing §5 work (~+21–38) and the §4 corrections (~+8–15): realistic **base ≈ 90–110 days** *before* buffer.
- With a 25–40% integration/unknowns buffer: **realistic Phase 2 ≈ 110–150 engineering-days**, and **calendar time longer still** because of the FE↔BE dependency chain.

In short: **45 days is not a number to commit to.** The honest planning range for the AWS-managed track is roughly **2.5–3× that**, driven mostly by (a) work that isn't on the sheet yet and (b) the two-team integration cost. Treat the Bedrock-Data-Automation rows as the project's biggest single risk, since the entire managed-first ROI is concentrated there.

---

*Prepared from the `pdfedits-frontend` repo + `docs/INFRASTRUCTURE.md`. Backend effort figures and all "existing infrastructure" reuse claims should be validated against the separate backend repository before these numbers are committed.*
