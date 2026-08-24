# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/toolbar-overflow.spec.ts >> PDF editor — toolbar overflow at 1280x720 >> Select and Manage Pages buttons are clipped from viewport
- Location: tests/pdf-editor/toolbar-overflow.spec.ts:20:3

# Error details

```
Error: expect(locator).not.toBeInViewport() failed

Locator:  getByRole('button', { name: /^select$/i }).first()
Expected: not in viewport
Received: in viewport
Timeout:  5000ms

Call log:
  - Expect "not toBeInViewport" with timeout 5000ms
  - waiting for getByRole('button', { name: /^select$/i }).first()
    13 × locator resolved to <button type="button" aria-label="Select" aria-pressed="true" class="group flex h-auto min-w-[56px] cursor-pointer flex-col items-center gap-0.5 rounded-[10px] px-2 py-1.5 text-[10px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 bg-[var(--color-accent)]/12 text-[var(--color-accent)] ring-1 ring-inset ring-[var(--color-accent)]/40">…</button>
       - unexpected value "viewport ratio 1"

```

```yaml
- button "Select" [pressed]:
  - img
  - text: Select
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | import { openSamplePdfInEditor } from "../helpers/editor";
  4  | 
  5  | /**
  6  |  * Regression coverage for the new editor toolbar layout bug: at the default
  7  |  * 1280x720 Playwright Desktop Chrome viewport the leftmost (Select, Edit)
  8  |  * and rightmost (Manage Pages) tool buttons are horizontally clipped and
  9  |  * unreachable by click. The desktop project in playwright.config.ts therefore
  10 |  * runs at 1920x1080; this spec intentionally uses the smaller viewport to
  11 |  * document and guard the issue.
  12 |  */
  13 | test.describe("PDF editor — toolbar overflow at 1280x720", () => {
  14 |   test.use({ viewport: { width: 1280, height: 720 } });
  15 | 
  16 |   test.beforeEach(async ({ page }) => {
  17 |     await openSamplePdfInEditor(page);
  18 |   });
  19 | 
  20 |   test("Select and Manage Pages buttons are clipped from viewport", async ({
  21 |     page,
  22 |   }) => {
  23 |     const selectButton = page.getByRole("button", { name: /^select$/i }).first();
  24 |     const managePagesButton = page
  25 |       .getByRole("button", { name: /^manage pages$/i })
  26 |       .first();
  27 | 
  28 |     await expect(selectButton).toBeVisible();
> 29 |     await expect(selectButton).not.toBeInViewport();
     |                                    ^ Error: expect(locator).not.toBeInViewport() failed
  30 | 
  31 |     await expect(managePagesButton).toBeVisible();
  32 |     await expect(managePagesButton).not.toBeInViewport();
  33 |   });
  34 | });
  35 | 
```