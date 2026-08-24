# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/save-export.spec.ts >> PDF editor — Save dropdown >> Save button + Export options dropdown are present
- Location: tests/pdf-editor/save-export.spec.ts:28:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button.button--primary').filter({ hasText: /save/i }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button.button--primary').filter({ hasText: /save/i }).first()

```

```yaml
- button "Undo" [disabled]:
  - img
- button "Redo" [disabled]:
  - img
- button "Browse all tools":
  - img
- button "Save":
  - img
- button "Search":
  - img
- button "Print":
  - img
- button "Download":
  - img
- button "Share":
  - img
- button "Done":
  - img
- button "Show pages":
  - img
  - img
- img "PDF page 1 of 3"
- application "PDF editing canvas, page 1 of 3"
- button "Performance panel":
  - button "Performance panel":
    - img
- toolbar "Editor dock":
  - button "Manage pages":
    - img
    - text: Manage
  - group "Drawing tools":
    - radiogroup:
      - radio "Select" [checked]:
        - img
        - text: Select
      - radio "Edit Text":
        - img
        - text: Edit Text
      - radio "Signature":
        - img
        - text: Signature
      - radio "Add Text":
        - img
        - text: Add Text
      - radio "Draw":
        - img
        - text: Draw
      - radio "Highlight":
        - img
        - text: Highlight
      - radio "Shapes":
        - img
        - text: Shapes
      - radio "Eraser":
        - img
        - text: Eraser
      - radio "Whiteout":
        - img
        - text: Whiteout
      - radio "Redact":
        - img
        - text: Redact
      - radio "Image":
        - img
        - text: Image
      - radio "Watermark":
        - img
        - text: Watermark
      - radio "Background":
        - img
        - text: Background
  - button "Compress":
    - img
    - text: Compress
  - button "Secure":
    - img
    - text: Secure
  - button "Merge":
    - img
    - text: Merge
  - button "Split":
    - img
    - text: Split
  - button "Flatten":
    - img
    - text: Flatten
  - button "Extract":
    - img
    - text: Extract
  - button "Page No.":
    - img
    - text: Page No.
  - button "Annotation":
    - img
    - text: Annotation
- alert
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | import { openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";
  4  | 
  5  | const EXPORT_FORMATS = [
  6  |   "PDF (.pdf)",
  7  |   "Word (.docx)",
  8  |   "Excel (.xlsx)",
  9  |   "PowerPoint (.pptx)",
  10 |   "JPG image",
  11 |   "PNG image",
  12 |   "HTML",
  13 |   "Plain text (.txt)",
  14 | ];
  15 | 
  16 | /**
  17 |  * The Save button + Export options dropdown live in the mobile EditorInfoBar.
  18 |  * The desktop PvEditorTopChrome uses a Download dropdown instead.
  19 |  */
  20 | test.use({ viewport: { width: 390, height: 844 } });
  21 | 
  22 | test.beforeEach(async ({ page }) => {
  23 |   await openSamplePdfInEditor(page);
  24 |   await waitForPdfReady(page);
  25 | });
  26 | 
  27 | test.describe("PDF editor — Save dropdown", () => {
  28 |   test("Save button + Export options dropdown are present", async ({ page }) => {
  29 |     // On mobile the Save button text is visually hidden; locate by class + text.
  30 |     await expect(
  31 |       page.locator('button.button--primary', { hasText: /save/i }).first(),
> 32 |     ).toBeVisible();
     |       ^ Error: expect(locator).toBeVisible() failed
  33 |     await expect(
  34 |       page.getByRole("button", { name: /export options/i }).first(),
  35 |     ).toBeVisible();
  36 |   });
  37 | 
  38 |   test(`Export menu lists all ${EXPORT_FORMATS.length} formats`, async ({
  39 |     page,
  40 |   }) => {
  41 |     await page.getByRole("button", { name: /export options/i }).click();
  42 | 
  43 |     for (const label of EXPORT_FORMATS) {
  44 |       await expect(
  45 |         page.getByText(label, { exact: false }).first(),
  46 |       ).toBeVisible();
  47 |     }
  48 |   });
  49 | });
  50 | 
```