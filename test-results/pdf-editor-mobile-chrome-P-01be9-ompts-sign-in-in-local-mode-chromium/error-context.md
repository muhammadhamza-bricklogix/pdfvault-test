# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/mobile-chrome.spec.ts >> PDF editor — mobile chrome >> Save button is visible and prompts sign-in in local mode
- Location: tests/pdf-editor/mobile-chrome.spec.ts:74:3

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
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | import { openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";
  4   | 
  5   | /**
  6   |  * Mobile chrome layout checks. The editor switches to EditorInfoBar + canvas +
  7   |  * BottomDock below the `lg` breakpoint (1024px). A 390x844 viewport exercises
  8   |  * this path end-to-end.
  9   |  */
  10  | test.use({ viewport: { width: 390, height: 844 } });
  11  | 
  12  | test.describe("PDF editor — mobile chrome", () => {
  13  |   test.beforeEach(async ({ page }) => {
  14  |     await openSamplePdfInEditor(page);
  15  |     await waitForPdfReady(page);
  16  |   });
  17  | 
  18  |   test("EditorInfoBar shows hamburger, filename, Save, page nav + zoom", async ({
  19  |     page,
  20  |   }) => {
  21  |     await expect(page.getByRole("button", { name: "Editor menu" })).toBeVisible();
  22  |     // Filename text is visually hidden on small screens but present in the DOM.
  23  |     await expect(page.getByText("sample.pdf").first()).toHaveCount(1);
  24  |     await expect(page.locator('button.button--primary', { hasText: /save/i }).first()).toBeVisible();
  25  |     await expect(page.getByRole("button", { name: /previous page/i }).first()).toBeVisible();
  26  |     await expect(page.getByRole("button", { name: /next page/i }).first()).toBeVisible();
  27  |     await expect(page.getByRole("button", { name: /zoom in/i }).first()).toBeVisible();
  28  |     await expect(page.getByRole("button", { name: /zoom out/i }).first()).toBeVisible();
  29  |   });
  30  | 
  31  |   test("BottomDock is visible with Undo, Redo, tool strip, Manage Pages", async ({
  32  |     page,
  33  |   }) => {
  34  |     const dock = page.getByRole("group", { name: "Drawing tools" });
  35  | 
  36  |     await expect(dock).toBeVisible({ timeout: 5_000 });
  37  |     // Undo/Redo live in the dock but outside the Drawing tools group.
  38  |     await expect(page.getByRole("button", { name: /^undo$/i }).first()).toBeVisible();
  39  |     await expect(page.getByRole("button", { name: /^redo$/i }).first()).toBeVisible();
  40  |     // The tool strip renders icon-only toggle radios inside the dock.
  41  |     await expect(dock.getByRole("radio", { name: /^edit text$/i }).first()).toBeVisible();
  42  |     await expect(dock.getByRole("radio", { name: /^draw$/i }).first()).toBeVisible();
  43  |     await expect(
  44  |       page.getByRole("button", { name: /^manage pages$/i }).first(),
  45  |     ).toBeVisible();
  46  |   });
  47  | 
  48  |   test("Watermark opens a mobile properties modal", async ({ page }) => {
  49  |     await page.getByRole("group", { name: "Drawing tools" })
  50  |       .getByRole("radio", { name: /^watermark$/i })
  51  |       .first()
  52  |       .click();
  53  | 
  54  |     await expect(
  55  |       page.getByRole("heading", { name: "Watermark" }).first(),
  56  |     ).toBeVisible({ timeout: 4_000 });
  57  |     await expect(page.getByRole("textbox", { name: "Watermark text" })).toBeVisible();
  58  |   });
  59  | 
  60  |   test("Background opens a mobile properties modal", async ({ page }) => {
  61  |     await page.getByRole("group", { name: "Drawing tools" })
  62  |       .getByRole("radio", { name: /^background$/i })
  63  |       .first()
  64  |       .click();
  65  | 
  66  |     await expect(
  67  |       page.getByRole("heading", { name: "Background image" }).first(),
  68  |     ).toBeVisible({ timeout: 4_000 });
  69  |     await expect(
  70  |       page.getByRole("button", { name: /upload image/i }).first(),
  71  |     ).toBeVisible();
  72  |   });
  73  | 
  74  |   test("Save button is visible and prompts sign-in in local mode", async ({
  75  |     page,
  76  |   }) => {
  77  |     const errors: string[] = [];
  78  | 
  79  |     page.on("pageerror", (e) => {
  80  |       if (e.message === "Transition was skipped") return;
  81  |       errors.push(e.message);
  82  |     });
  83  | 
  84  |     const saveButton = page.locator('button.button--primary', { hasText: /save/i }).first();
  85  | 
  86  |     // Save stays enabled for signed-out users on purpose — a silently
  87  |     // disabled button used to make people think Save was broken.
  88  |     // Instead, clicking fires the sign-in confirm modal (invariant #4 in
  89  |     // CLAUDE.md).
> 90  |     await expect(saveButton).toBeVisible();
      |                              ^ Error: expect(locator).toBeVisible() failed
  91  |     await expect(saveButton).toBeEnabled();
  92  | 
  93  |     await saveButton.click();
  94  |     await expect(
  95  |       page.getByRole("heading", { name: /sign in/i }).first(),
  96  |     ).toBeVisible({ timeout: 4_000 });
  97  | 
  98  |     expect(errors).toEqual([]);
  99  |   });
  100 | });
  101 | 
```