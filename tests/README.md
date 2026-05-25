# E2E tests — PDF editor + file conversion

Manual QA suite focused on two areas: the **PDF editor** and the **file
conversion** flow. Runs against the local dev server using the system Chrome
(no Chromium download).

## Quick start

```bash
# 1. Start both servers in separate terminals
bun run dev                                         # frontend, port 3000
cd ~/Downloads/pdf-viewer-backend-main \
  && npm run start:dev                              # backend, port 7403

# 2. Run the suite (~1 min)
cd ~/pdf-viewer-app
bun run test:e2e

# 3. Read the results
open test-results/REPORT.md                         # scan-friendly summary
bun run test:e2e:report                             # full HTML report
```

## Commands

| Command                                  | What it does                                |
| ---------------------------------------- | ------------------------------------------- |
| `bun run test:e2e`                       | Run the full suite                          |
| `bun run test:e2e:ui`                    | Interactive UI mode                         |
| `bun run test:e2e:report`                | Open last HTML report                       |
| `bun run test:e2e -- --grep "Save"`      | Run tests by name                           |
| `bun run test:e2e -- pdf-editor`         | Run only the PDF-editor folder              |
| `bun run test:e2e -- conversion`         | Run only the conversion folder              |
| `node scripts/playwright-report-md.mjs`  | Regenerate the Markdown summary             |

## Folder layout

```
tests/
  README.md                 # you are here
  auth.setup.ts             # one-time Clerk sign-in, caches session
  .auth/                    # cached session (gitignored)
  .gitignore
  fixtures/                 # sample.pdf, sample.docx, sample.jpg
  helpers/
    auth.ts                 # skipIfUnauthenticated()
    editor.ts               # openSamplePdfInEditor(), waitForPdfReady(), etc.
  pdf-editor/
    tools.spec.ts           # 11 tool buttons (Select / Text / Draw / …)
    controls.spec.ts        # zoom, page nav, redo state
    save-export.spec.ts     # Save dropdown + all 8 export formats
    manage-pages.spec.ts    # Manage Pages modal opens cleanly
  conversion/
    tool-pages.spec.ts      # /tools/<slug> uploads fire POST /conversion
    tools-modal.spec.ts     # Editor → Tools modal → click tile → real page
```

## What each suite verifies

**`pdf-editor/`** — opens `~/Downloads/sample-local-pdf.pdf` in the editor
and checks the UI smoke-level:
- Every drawing tool activates without a runtime error
- Save / Export options dropdown lists all 8 formats
- Zoom + / page nav update on click
- Manage Pages modal opens

**`conversion/`** — covers the conversion pipeline:
- Direct `/tools/<slug>` upload fires `POST /conversion` with the correct
  `type=` form field (no need for backend to actually convert — that's
  covered by `scripts/smoke-test-conversions.sh`)
- Editor → Tools modal → clicking a tile routes to a real page (no 404)
- Both canonical (`pdf-to-docx`) and friendly (`pdf-to-word`) slugs are
  exercised

## Auth setup (unlocks 5 auth-gated tests)

`/tools/*` is gated by Clerk middleware, so the conversion specs need a
signed-in session. One-time setup:

1. Open http://localhost:3000/sign-up
2. Email: `e2e+clerk_test@example.com`
3. Password: `ClerkE2EPassword!23`
4. Verification code: `424242` (Clerk's magic code for `+clerk_test@` emails
   — no real inbox needed)
5. Land on the dashboard ✓

After that, `auth.setup.ts` will sign in automatically every run and cache
the session to `tests/.auth/user.json` (gitignored). Auth-gated tests will
start running on every subsequent invocation.

Override the credentials via env vars:

```bash
E2E_CLERK_EMAIL=other+clerk_test@example.com \
E2E_CLERK_PASSWORD=YourPassword123! \
bun run test:e2e
```

## Adding a new test

Drop a `*.spec.ts` file under `tests/pdf-editor/` or `tests/conversion/`.
Use existing files as templates:

- Need the editor open? `await openSamplePdfInEditor(page);`
- Need a known page count? `await waitForPdfReady(page);`
- Auth-protected? `test.beforeEach(() => skipIfUnauthenticated());`

Keep tests **brief** — one assertion per behavior. Smoke tests beat
exhaustive flows here; the goal is fast signal.

## What's NOT in the suite (intentionally)

- **Fabric canvas pixel assertions** — canvas pixels aren't in the a11y tree;
  would need image-diff snapshots. Out of scope for smoke.
- **Live CloudConvert round-trip** — covered by
  `scripts/smoke-test-conversions.sh`, which curls the backend directly.
- **Mobile viewports** — desktop Chrome only. Add a project for mobile if
  you need that signal.
- **Marketing pages, auth flows** — out of scope per current focus on
  editor + conversion only.
