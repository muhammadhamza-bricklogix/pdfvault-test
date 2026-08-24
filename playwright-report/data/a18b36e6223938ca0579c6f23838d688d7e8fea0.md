# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/save-export.spec.ts >> PDF editor — Save dropdown >> Export menu lists all 8 formats
- Location: tests/pdf-editor/save-export.spec.ts:38:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /export options/i })

```

# Page snapshot

```yaml
- generic [active]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - generic [ref=e6]:
            - button "Undo" [disabled]:
              - img
            - button "Redo" [disabled]:
              - img
          - button "Browse all tools" [ref=e7] [cursor=pointer]:
            - img
        - generic [ref=e8]:
          - button "Save" [ref=e9] [cursor=pointer]:
            - img
          - button "Search" [ref=e10] [cursor=pointer]:
            - img
          - button "Print" [ref=e11] [cursor=pointer]:
            - img
          - button "Download" [ref=e12] [cursor=pointer]:
            - img
          - button "Share" [ref=e13] [cursor=pointer]:
            - img
          - button "Done" [ref=e14] [cursor=pointer]:
            - img
      - button "Show pages" [ref=e16] [cursor=pointer]:
        - img
        - img
    - generic [ref=e17]:
      - generic:
        - search:
          - img
          - textbox:
            - /placeholder: Search in PDF…
          - generic:
            - button [disabled]:
              - img
            - button [disabled]:
              - img
          - button:
            - img
      - generic [ref=e21]:
        - img "PDF page 1 of 3" [ref=e22]
        - application "PDF editing canvas, page 1 of 3" [ref=e24]
      - button "Performance panel" [ref=e27] [cursor=pointer]:
        - button "Performance panel" [ref=e28]:
          - img
    - toolbar "Editor dock" [ref=e29]:
      - generic [ref=e30]:
        - button "Manage pages" [ref=e31] [cursor=pointer]:
          - img
          - generic [ref=e32]: Manage
        - generic [ref=e33]:
          - group "Drawing tools" [ref=e34]:
            - radiogroup [ref=e35]:
              - radio "Select" [checked] [ref=e36] [cursor=pointer]:
                - img
                - generic [ref=e37]: Select
              - radio "Edit Text" [ref=e38] [cursor=pointer]:
                - img
                - generic [ref=e39]: Edit Text
              - radio "Signature" [ref=e40] [cursor=pointer]:
                - img
                - generic [ref=e41]: Signature
              - radio "Add Text" [ref=e42] [cursor=pointer]:
                - img
                - generic [ref=e43]: Add Text
              - radio "Draw" [ref=e44] [cursor=pointer]:
                - img
                - generic [ref=e45]: Draw
              - radio "Highlight" [ref=e46] [cursor=pointer]:
                - img
                - generic [ref=e47]: Highlight
              - radio "Shapes" [ref=e48] [cursor=pointer]:
                - img
                - generic [ref=e49]: Shapes
              - radio "Eraser" [ref=e50] [cursor=pointer]:
                - img
                - generic [ref=e51]: Eraser
              - radio "Whiteout" [ref=e52] [cursor=pointer]:
                - img
                - generic [ref=e53]: Whiteout
              - radio "Redact" [ref=e54] [cursor=pointer]:
                - img
                - generic [ref=e55]: Redact
              - radio "Image" [ref=e56] [cursor=pointer]:
                - img
                - generic [ref=e57]: Image
              - radio "Watermark" [ref=e58] [cursor=pointer]:
                - img
                - generic [ref=e59]: Watermark
              - radio "Background" [ref=e60] [cursor=pointer]:
                - img
                - generic [ref=e61]: Background
          - button "Compress" [ref=e62]:
            - img [ref=e63]
            - generic [ref=e65]: Compress
          - button "Secure" [ref=e66]:
            - img [ref=e67]
            - generic [ref=e70]: Secure
          - button "Merge" [ref=e71]:
            - img [ref=e72]
            - generic [ref=e75]: Merge
          - button "Split" [ref=e76]:
            - img [ref=e77]
            - generic [ref=e80]: Split
          - button "Flatten" [ref=e81]:
            - img [ref=e82]
            - generic [ref=e86]: Flatten
          - button "Extract" [ref=e87]:
            - img [ref=e88]
            - generic [ref=e91]: Extract
          - button "Page No." [ref=e92]:
            - img [ref=e93]
            - generic [ref=e96]: Page No.
          - button "Annotation" [ref=e97]:
            - img [ref=e98]
            - generic [ref=e101]: Annotation
  - generic [ref=e106] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e107]:
      - img [ref=e108]
    - generic [ref=e111]:
      - button "Open issues overlay" [ref=e112]:
        - generic [ref=e113]:
          - generic [ref=e114]: "4"
          - generic [ref=e115]: "5"
        - generic [ref=e116]:
          - text: Issue
          - generic [ref=e117]: s
      - button "Collapse issues badge" [ref=e118]:
        - img [ref=e119]
  - alert [ref=e121]
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
  32 |     ).toBeVisible();
  33 |     await expect(
  34 |       page.getByRole("button", { name: /export options/i }).first(),
  35 |     ).toBeVisible();
  36 |   });
  37 | 
  38 |   test(`Export menu lists all ${EXPORT_FORMATS.length} formats`, async ({
  39 |     page,
  40 |   }) => {
> 41 |     await page.getByRole("button", { name: /export options/i }).click();
     |                                                                 ^ Error: locator.click: Test timeout of 30000ms exceeded.
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