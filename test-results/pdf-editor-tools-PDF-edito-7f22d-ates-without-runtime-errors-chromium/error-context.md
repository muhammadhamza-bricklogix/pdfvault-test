# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/tools.spec.ts >> PDF editor — tool activation >> Eraser tool activates without runtime errors
- Location: tests/pdf-editor/tools.spec.ts:25:5

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: locator.setInputFiles: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="file"]').first()
    - locator resolved to <input type="file" class="hidden" aria-label="Drop your file here" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,image/gif,text/html,text/plain"/>

```

# Page snapshot

```yaml
- generic [active]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - link "PDFVault home" [ref=e5] [cursor=pointer]:
        - /url: /
        - img "PDFVault" [ref=e6]
    - generic [ref=e8]:
      - generic [ref=e12]:
        - generic [ref=e13]:
          - img [ref=e14]
          - img [ref=e17]
        - paragraph [ref=e18]: Drop your file here
        - button "Browse files" [ref=e19] [cursor=pointer]
        - paragraph [ref=e20]: PDF, Word, Excel, PowerPoint, Image · Up to 100 MB
      - paragraph [ref=e21]:
        - text: or
        - button "create a blank PDF" [ref=e22]
  - generic [ref=e27] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e28]:
      - img [ref=e29]
    - generic [ref=e32]:
      - button "Open issues overlay" [ref=e33]:
        - generic [ref=e34]:
          - generic [ref=e35]: "2"
          - generic [ref=e36]: "3"
        - generic [ref=e37]:
          - text: Issue
          - generic [ref=e38]: s
      - button "Collapse issues badge" [ref=e39]:
        - img [ref=e40]
  - alert [ref=e42]
```

# Test source

```ts
  1  | import type { Page } from "@playwright/test";
  2  | 
  3  | import { expect } from "@playwright/test";
  4  | import path from "node:path";
  5  | import { fileURLToPath } from "node:url";
  6  | 
  7  | const __dirname = path.dirname(fileURLToPath(import.meta.url));
  8  | 
  9  | export const FIXTURES = {
  10 |   pdf: path.join(__dirname, "..", "fixtures", "sample.pdf"),
  11 |   docx: path.join(__dirname, "..", "fixtures", "sample.docx"),
  12 |   jpg: path.join(__dirname, "..", "fixtures", "sample.jpg"),
  13 | };
  14 | 
  15 | /**
  16 |  * Opens the editor at `/pdf-editor` and uploads the sample PDF. Waits until
  17 |  * the PDF canvas is mounted — `role="img"` with a "PDF page" aria-label is
  18 |  * the most reliable ready signal because it means pdf.js has parsed the
  19 |  * document and rendered the first page. Tool buttons may already be visible
  20 |  * before the PDF is ready, so waiting on them alone can race the canvas.
  21 |  */
  22 | export async function openSamplePdfInEditor(page: Page) {
  23 |   await page.goto("/pdf-editor");
> 24 |   await page.locator('input[type="file"]').first().setInputFiles(FIXTURES.pdf);
     |   ^ Error: locator.setInputFiles: Test timeout of 30000ms exceeded.
  25 | 
  26 |   await expect(
  27 |     page.getByRole("img", { name: /PDF page/i }).first(),
  28 |   ).toBeVisible({ timeout: 15_000 });
  29 | }
  30 | 
  31 | /**
  32 |  * Waits for pdf.js to finish parsing the open document — the rendered page
  33 |  * canvas exposes its label as `PDF page X of Y`, which is available on both
  34 |  * desktop and mobile (the text-based page indicator only exists in the mobile
  35 |  * EditorInfoBar, so the canvas aria-label is the cross-layout signal).
  36 |  */
  37 | export async function waitForPdfReady(page: Page) {
  38 |   await expect
  39 |     .poll(
  40 |       async () => {
  41 |         const label = await page
  42 |           .getByRole("img", { name: /PDF page/i })
  43 |           .first()
  44 |           .getAttribute("aria-label")
  45 |           .catch(() => null);
  46 | 
  47 |         return label ?? "";
  48 |       },
  49 |       { timeout: 15_000, intervals: [200, 500, 1000] },
  50 |     )
  51 |     .toMatch(/PDF page\s+\d+\s+of\s+[1-9]\d*/i);
  52 | }
  53 | 
  54 | /**
  55 |  * Returns a promise that resolves with the form-data body of the next
  56 |  * `POST /conversion` request. Use to assert the frontend fired the expected
  57 |  * conversion type without depending on the backend response.
  58 |  */
  59 | export async function captureNextConversionRequest(
  60 |   page: Page,
  61 |   expectedType: string,
  62 | ): Promise<void> {
  63 |   const request = await page.waitForRequest(
  64 |     (req) => req.url().includes("/conversion") && req.method() === "POST",
  65 |     { timeout: 10_000 },
  66 |   );
  67 | 
  68 |   const body = request.postDataBuffer()?.toString("utf-8") ?? "";
  69 | 
  70 |   expect(body, `Conversion request body for ${expectedType}`).toContain(
  71 |     expectedType,
  72 |   );
  73 | }
  74 | 
```