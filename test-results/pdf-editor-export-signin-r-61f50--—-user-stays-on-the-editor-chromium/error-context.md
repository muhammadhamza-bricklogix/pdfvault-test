# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/export-signin-redirect.spec.ts >> Editor export — signed-out flow >> non-PDF export as signed-out can be cancelled from the modal — user stays on the editor
- Location: tests/pdf-editor/export-signin-redirect.spec.ts:93:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/pdf-composer", waiting until "load"

```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | import path from "node:path";
  3   | import { fileURLToPath } from "node:url";
  4   | 
  5   | const __dirname = path.dirname(fileURLToPath(import.meta.url));
  6   | const SAMPLE_PDF = path.join(__dirname, "..", "fixtures", "sample.pdf");
  7   | 
  8   | // Force anonymous — this spec exercises the signed-out export gate.
  9   | test.use({ storageState: { cookies: [], origins: [] } });
  10  | 
  11  | test.describe("Editor export — signed-out flow", () => {
  12  |   test("PDF export as signed-out DOES NOT redirect (client-side only, no auth needed)", async ({
  13  |     page,
  14  |   }) => {
  15  |     await page.goto("/pdf-composer");
  16  | 
  17  |     await page
  18  |       .locator('input[type="file"]')
  19  |       .first()
  20  |       .setInputFiles(SAMPLE_PDF);
  21  | 
  22  |     await expect(
  23  |       page.getByRole("img", { name: /PDF page/i }).first(),
  24  |     ).toBeVisible({ timeout: 20_000 });
  25  | 
  26  |     const downloadTrigger = page
  27  |       .getByRole("button", { name: /^(download|export options)$/i })
  28  |       .first();
  29  | 
  30  |     await downloadTrigger.click();
  31  |     await page.locator('[role="menuitem"][data-key="pdf"]').first().click();
  32  | 
  33  |     // PDF export is client-side only — should NOT bounce to sign-in.
  34  |     // Give the redirect a chance to (not) happen.
  35  |     await page.waitForTimeout(1000);
  36  |     expect(page.url()).not.toContain("/sign-in");
  37  |     expect(page.url()).toContain("/pdf-composer");
  38  |   });
  39  | 
  40  |   test("non-PDF export as signed-out opens the Sign-In confirm modal, and confirming redirects to /sign-in with the export in the return URL", async ({
  41  |     page,
  42  |   }) => {
  43  |     await page.goto("/pdf-composer");
  44  | 
  45  |     await page
  46  |       .locator('input[type="file"]')
  47  |       .first()
  48  |       .setInputFiles(SAMPLE_PDF);
  49  | 
  50  |     await expect(
  51  |       page.getByRole("img", { name: /PDF page/i }).first(),
  52  |     ).toBeVisible({ timeout: 20_000 });
  53  | 
  54  |     const downloadTrigger = page
  55  |       .getByRole("button", { name: /^(download|export options)$/i })
  56  |       .first();
  57  | 
  58  |     await downloadTrigger.click();
  59  |     await page
  60  |       .locator('[role="menuitem"][data-key="docx"]')
  61  |       .first()
  62  |       .click();
  63  | 
  64  |     // Sign-in prompt modal should appear (not an immediate redirect).
  65  |     const promptHeading = page.getByRole("heading", {
  66  |       name: /Sign in to download/i,
  67  |     });
  68  | 
  69  |     await expect(promptHeading).toBeVisible({ timeout: 5_000 });
  70  | 
  71  |     // URL still on /pdf-composer — no redirect until user confirms.
  72  |     expect(page.url()).toContain("/pdf-composer");
  73  |     expect(page.url()).not.toContain("/sign-in");
  74  | 
  75  |     // Confirm → redirect to /sign-in with correct redirect_url.
  76  |     await page
  77  |       .getByRole("button", { name: /Sign in & continue/i })
  78  |       .click();
  79  | 
  80  |     await expect(page).toHaveURL(/\/sign-in\?redirect_url=/, {
  81  |       timeout: 10_000,
  82  |     });
  83  | 
  84  |     const currentUrl = new URL(page.url());
  85  |     const returnTo = decodeURIComponent(
  86  |       currentUrl.searchParams.get("redirect_url") ?? "",
  87  |     );
  88  | 
  89  |     expect(returnTo).toContain("/pdf-composer");
  90  |     expect(returnTo).toContain("export=docx");
  91  |   });
  92  | 
  93  |   test("non-PDF export as signed-out can be cancelled from the modal — user stays on the editor", async ({
  94  |     page,
  95  |   }) => {
> 96  |     await page.goto("/pdf-composer");
      |                ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  97  | 
  98  |     await page
  99  |       .locator('input[type="file"]')
  100 |       .first()
  101 |       .setInputFiles(SAMPLE_PDF);
  102 | 
  103 |     await expect(
  104 |       page.getByRole("img", { name: /PDF page/i }).first(),
  105 |     ).toBeVisible({ timeout: 20_000 });
  106 | 
  107 |     await page
  108 |       .getByRole("button", { name: /^(download|export options)$/i })
  109 |       .first()
  110 |       .click();
  111 |     await page
  112 |       .locator('[role="menuitem"][data-key="docx"]')
  113 |       .first()
  114 |       .click();
  115 | 
  116 |     await expect(
  117 |       page.getByRole("heading", { name: /Sign in to download/i }),
  118 |     ).toBeVisible({ timeout: 5_000 });
  119 | 
  120 |     await page.getByRole("button", { name: /^Cancel$/i }).click();
  121 | 
  122 |     // Modal dismisses, user is still on /pdf-composer with the file
  123 |     // loaded — no redirect happened.
  124 |     await expect(
  125 |       page.getByRole("heading", { name: /Sign in to download/i }),
  126 |     ).not.toBeVisible({ timeout: 3_000 });
  127 |     expect(page.url()).toContain("/pdf-composer");
  128 |     expect(page.url()).not.toContain("/sign-in");
  129 |   });
  130 | });
  131 | 
```