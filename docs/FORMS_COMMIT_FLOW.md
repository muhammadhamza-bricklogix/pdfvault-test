# Forms work — commit flow and cherry-pick guide

Tracking doc for the W-9, 1099-NEC and DS-11 work, written so a new branch can
be cut from `main` later and the right commits picked onto it.

Last updated: **2026-10-04**

---

## 1. Where everything lives right now

| Work | Branch | Status |
| --- | --- | --- |
| W-9 + 1099-NEC + the shared save architecture | `main` | **Already merged** via PR #206 (`7d247c2`) |
| DS-11 (the form itself, plus parity with the other two) | `feature/PDF-89` | Not on `main` yet |

The important consequence: **the W-9 and 1099-NEC work does not need cherry-picking
any more.** It is already in `main`. Only the DS-11 chain is outstanding.

### How the W-9 / 1099-NEC work reached `main`

It went through `review/zaid-PDF-91`, which was merged into `main` as PR #206.
Note that `review/zaid-PDF-91` carried *re-committed* versions of the original
1099-NEC commits, not the originals from staging. That is why `git cherry` still
reports the staging-era 1099 commits on `feature/PDF-89` as "not upstream" even
though their content is effectively in `main`. **Do not re-pick them** — you would
be re-applying an older generation of the same work on top of the newer one.

---

## 2. The DS-11 chain — what to cherry-pick

In this order, onto a fresh branch from `main`:

| # | Commit | Date | What it is |
| --- | --- | --- | --- |
| 1 | `76780ba` | 2026-10-03 | `feat(ds-11): add Form DS-11 online passport application` — the whole feature: routes, landing page, editor page, schema, client stamper, validation, preview scroller |
| 2 | `6b55d55` | 2026-10-03 | `feat(landing): list Form DS-11 in the All Tools catalog` |
| 3 | `48a15d0` | 2026-10-04 | `feat(ds-11): give DS-11 the same save behaviour as the W-9 and 1099-NEC` |
| 4 | `aaa8878` | 2026-10-04 | `fix(ds-11): make the page-2 name and date of birth editable` |
| 5 | `be7969c` | 2026-10-04 | `feat(forms): downloaded PDFs stay editable` — not DS-11-only; it touches all three stampers, but it is on this branch and not on `main`, so it has to come along |

```bash
git checkout main
git pull
git checkout -b feature/ds-11-on-main
git cherry-pick 76780ba 6b55d55 48a15d0 aaa8878 be7969c
```

`be7969c` also edits `stamp-w9-client.ts` and `stamp-nec-client.ts`, which `main`
already has, so expect it to apply cleanly but review it — it reverses the
flattening that PR #206 introduced.

### Conflicts to expect

Commits 1 and 2 were authored before `main` had the 1099-NEC catalog entries, so
the shared registries will conflict. In every case the resolution is a **union** —
keep both the DS-11 entry and the 1099-NEC entry:

- `lib/shared/constants/routes.ts`
- `lib/shared/constants/landing-tools.ts`
- `lib/shared/constants/home-tool-grid.ts`
- `components/shared/forms-modal.tsx`
- `components/sections/dashboard/pv-forms-grid.tsx`
- `components/shared/navigation/site-navbar.tsx`
- `components/shared/navigation/language-switcher.tsx`
- `messages/landing/*.json` (6 locales — keep both the DS-11 key and `forms1099Nec`)

Commits 3 and 4 touch only `Ds11*` files plus `ds-11-schema.ts` /
`stamp-ds11-client.ts`, so they should apply cleanly.

### Do NOT pick these

They are the staging-era 1099-NEC commits whose work is already in `main` in a
newer form, plus unrelated landing/paywall/mobile work that reaches `main` through
staging on its own:

```
7d9ea76  feat: add IRS Form 1099-NEC tax form editor and validation workflow
ba377cb  fix: eagerly restore pending form state on bootstrap ...
26da687  fix(1099-nec): wire save, validation, paywall preview and dashboard resume
d0bf023  fix(1099-nec): scope drafts per recipient and keep edits after download
0943aca  fix(1099-nec): allow partial save, scale overlay text with zoom ...
c7b1115  fix(1099-nec): match W-9 save behaviour, even out overlay type ...
e5e79c1  fix(landing): add i18n key for the 1099-NEC All Tools entry
```

---

## 3. What is already in `main` (via PR #206)

For reference — this is the work you do **not** need to pick.

| Commit | What it is |
| --- | --- |
| `d9e1729` | `fix(w-9): stop a queued save undoing "Save as a new file"` |
| `77823cc` | `Fix resume filename and W-9 guard` — resumed row's name lands on the editor File |
| `2357689` | `Fix 1099-NEC mirror and draft save flow` — all-four-copies stamping, read-only copies, W-9 flattening, partial downloads |

Plus the earlier chain that built the save architecture itself: fresh-start forms,
editable filename, the Replace / Save-as-new prompt, `resolve-filename-conflict`,
the cached `library-filename-index`, autosave, and save-before-navigate.

---

## 4. Branch topology

```
main (7d247c2)  ──  PR #206 merged review/zaid-PDF-91
  │                 => W-9 + 1099-NEC + save architecture
  │
  └── feature/PDF-89
        ├── 76780ba  DS-11 feature
        ├── 6b55d55  DS-11 in All Tools
        ├── da362e6  MERGE: brought the save architecture onto this branch
        │            (same content as PR #206 — do not pick, it is a merge)
        ├── 48a15d0  DS-11 save parity
        └── aaa8878  DS-11 page-2 header editable
```

`da362e6` is a merge commit that pulled `review/zaid-PDF-91` into `feature/PDF-89`
so DS-11 had the save architecture to build on. On a branch cut from `main` that
architecture is already present, so this merge is **not** picked.

### Safety tags created during that merge

| Tag | Points at |
| --- | --- |
| `backup/pdf-89-pre-merge` | `6b55d55` — `feature/PDF-89` before the merge |
| `backup/review-local-pre-pull` | the local `review/zaid-PDF-91` tip before it was reset to origin |

---

## 5. Backend

The backend is a separate repo (`pdf-viewer-backend`) and tracks its own branches.

- The **DS-11 filler** (`src/form-templates/form-fillers/ds-11.filler.ts`) exists
  **only on `feature/PDF-89`**. It is not on `review/zaid-PDF-91` and not in the
  backend's `main`.
- The W-9 and 1099-NEC fillers are present on both.
- The 1099-NEC filler already stamps **all four copies** and flattens; the W-9
  filler flattens too.
- DS-11 also needs its template row seeded, or the template lookup 404s.

**To test DS-11 end to end the backend must be on `feature/PDF-89`.** On any other
branch `finalizeFormSession` has no DS-11 filler, so the frontend falls back to the
local client stamper (which works, but is not the server-stamped path).

---

## 6. Open items

- [ ] **W-9 download filename.** `W9FinalizeIntercept` hardcodes
      `link.download = "w-9.pdf"` and opens a cross-origin presigned URL with
      `target="_blank"`, where the `download` attribute is ignored — so the file
      lands with the server's name instead of the one chosen in the export modal.
      The 1099-NEC already does this correctly (fetch → Blob → named object URL);
      the fix is to copy that shape.
- [x] **Editable downloads** — done in `be7969c`, for the **client** stampers.
      Option 3 from §7 was chosen: Copy A editable, the other copies read-only
      with Acrobat calculate actions, limitation accepted.
- [ ] **Backend fillers still flatten.** `w9.filler.ts:371` and
      `1099-nec.filler.ts:565` both call `form.flatten()`, so a server-stamped
      download is still read-only. They need the same treatment as `be7969c`,
      including unsetting Copy A's ReadOnly flag and adding the calculate
      actions. Until then, only the client-stamped path produces an editable PDF.
- [ ] **Backend `fillPageTwoHeader`** needs the same "typed value wins" change
      that `stamp-ds11-client.ts` received in `aaa8878`, otherwise a
      server-stamped DS-11 will overwrite a user-typed page-2 header.
- [ ] DS-11 template seeding on staging.

---

## 7. Known constraint — 1099-NEC editable copies

The 1099-NEC has four copies of the same form (Copy A on page 2, then Copy 1,
Copy B and Copy 2 on pages 3, 4 and 6). The desired behaviour is: in the
downloaded PDF, edit Copy A and have the change appear on the other three.

In a PDF this is not freely achievable:

- A field's value is shared across **all widgets of the same field**. Making one
  edit propagate therefore requires the four copies to be **one field with four
  widgets**, not four separate fields.
- `ReadOnly` is a **field** flag, not a widget flag. So if the four copies share a
  field in order to share a value, they necessarily share their editability too —
  "Copy A editable, the rest read-only but auto-updating" cannot be expressed.
- The only way to get that exact behaviour is PDF-level JavaScript, which Acrobat
  honours but Chrome, Edge, Firefox and macOS Preview all ignore.

Practical options:

1. **Merge the four copies into one field each** — edit any copy, all four update,
   works in every viewer. Trade-off: the black copies are editable too.
2. **Copy A editable, other copies flattened** — the black copies are frozen at
   whatever was stamped at download time and do not follow later edits.
3. **PDF JavaScript** — matches the request exactly but only in Acrobat.

**Chosen: option 3**, with the limitation understood and accepted. Implemented in
`be7969c`. Because non-Acrobat viewers ignore the scripts, every value is still
stamped onto all four copies at download time, so the carbon copies are correct
there — they just stop following later edits to Copy A.
