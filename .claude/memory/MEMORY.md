# Memory Index

- [User role](user_role.md) — Uzair, owner/builder of PDFedits (Next.js 16 PDF editor)
- [Current work](project_current_work.md) — active branch `main`, Solidgate billing hardening + Apple Pay rollout
- [Mobile priority](project_mobile_priority.md) — iOS Safari + Android Chrome is #1 regression surface; walk CLAUDE.md mobile checklist before push
- [Caveman mode](feedback_caveman_mode.md) — terse replies default, normal English for code/commits/security
- [Off-limits revisable](feedback_off_limits_revisable.md) — when a bug fix conflicts with an off-limits/skill-log decision, surface and apply; user revises prior calls when UX breaks
- [Repocards](reference_repocards.md) — read `.repocards/AGENT_GUIDE.md` before grepping source
- [PDF editor skill](reference_pdf_editor_skill.md) — load `pdf-editor-architecture` skill before editing editor folders
- [Locked paths](reference_locked_paths.md) — PreToolUse hook blocks edits to files in `.claude/LOCKED_PATHS`; ask before bypassing
- [Locked paths temp unlock](project_locked_paths_temp_unlock.md) — PdfViewerCanvas.tsx lock line currently commented (2026-07-23); needs re-lock
- [Pending editor state](project_pending_editor_state.md) — IDB pending record carries file + fabricState + extractedPages; restore MUST run before router.replace in post-signin path
- [Auth link redirect_url](project_auth_link_redirect_url.md) — login↔signup cross-nav links must forward redirect_url or users lose their pending file after auth
- [Download auto-start](feedback_download_auto_start.md) — paywall SuccessStep auto-dismisses after 2 s so queued downloads fire without a manual click
- [Session spec 2026-07-30](specs/2026-07-30-signout-edit-persistence.md) — signed-out edit → download → sign-in return: three bugs, full evidence trail
- [Session spec 2026-07-31](specs/2026-07-31-solidgate-audit.md) — client Solidgate audit: charge-auth SDK migration, React Aria dismiss fix, hard-cancel webhook
- [Session spec 2026-08-03](specs/2026-08-03-apple-pay-diagnostic.md) — Apple Pay button missing: full stack green, blocked on Solidgate-side Apple verification
