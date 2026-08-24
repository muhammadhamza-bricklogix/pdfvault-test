# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/ui-inventory.spec.ts >> PDF editor — UI inventory >> Top App Bar >> filename is shown
- Location: tests/pdf-editor/ui-inventory.spec.ts:44:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('sample.pdf').first()
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('sample.pdf').first()

```

```yaml
- button "Back to dashboard":
  - img
- button "Editor menu":
  - img
- separator
- link "Home":
  - /url: /
  - img "PDFVault"
- textbox "Document name": sample
- button "Save":
  - img
  - text: Save
- button "Undo" [disabled]:
  - img
- button "Redo" [disabled]:
  - img
- button "🌐 EN"
- button "Show me around":
  - img
- button "Search in PDF":
  - img
  - text: Search
- button "Print":
  - img
  - text: Print
- button "Share via link" [disabled]:
  - img
  - text: Share via link
- button "Download":
  - img
  - text: Done
- listbox "Page thumbnails":
  - button "Add page":
    - img
    - text: Add Page
  - option "Page 1" [selected]:
    - button "Drag to reorder page 1": ⋮⋮
    - text: "1"
  - option "Page 2":
    - button "Drag to reorder page 2": ⋮⋮
    - text: "2"
  - option "Page 3":
    - button "Drag to reorder page 3": ⋮⋮
    - text: "3"
  - status
- button "Select" [pressed]:
  - img
  - text: Select
- button "Edit":
  - img
  - text: Edit
- button "Sign":
  - img
  - text: Sign
- button "Text":
  - img
  - text: Text
- button "Draw":
  - img
  - text: Draw
- button "Highlight":
  - img
  - text: Highlight
- button "Shapes":
  - img
  - text: Shapes
- button "Eraser":
  - img
  - text: Eraser
- button "Whiteout":
  - img
  - text: Whiteout
- button "Redact":
  - img
  - text: Redact
- button "Image":
  - img
  - text: Image
- button "Watermark":
  - img
  - text: Watermark
- button "Background":
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
- button "Page No":
  - img
  - text: Page No
- button "Annotate":
  - img
  - text: Annotate
- button "Manage Pages":
  - img
  - text: Manage Pages
- img "PDF page 1 of 3"
- application "PDF editing canvas, page 1 of 3"
- button "Performance panel":
  - button "Performance panel":
    - img
- alert
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | import { openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";
  4   | 
  5   | /**
  6   |  * UI inventory smoke tests for the refreshed PDF editor chrome. These are
  7   |  * breadth-first assertions: each item from the user's inventory is touched,
  8   |  * but deep behavior is left to dedicated feature specs.
  9   |  */
  10  | test.describe("PDF editor — UI inventory", () => {
  11  |   test.beforeEach(async ({ page }) => {
  12  |     await openSamplePdfInEditor(page);
  13  |     await waitForPdfReady(page);
  14  |   });
  15  | 
  16  |   test.describe("Top App Bar", () => {
  17  |     test("hamburger menu opens and lists expected items", async ({ page }) => {
  18  |       await page.getByRole("button", { name: "Editor menu" }).click();
  19  | 
  20  |       await expect(
  21  |         page.getByRole("menuitem", { name: /create new/i }),
  22  |       ).toBeVisible();
  23  |       await expect(
  24  |         page.getByRole("menuitem", { name: /open file/i }),
  25  |       ).toBeVisible();
  26  |       await expect(
  27  |         page.getByRole("menuitem", { name: /my pdfs/i }),
  28  |       ).toBeVisible();
  29  |       await expect(
  30  |         page.getByRole("menuitem", { name: /find and replace/i }),
  31  |       ).toBeVisible();
  32  |       await expect(
  33  |         page.getByRole("menuitem", { name: /version history/i }),
  34  |       ).toBeVisible();
  35  |     });
  36  | 
  37  |     test("PDFVault logo links home", async ({ page }) => {
  38  |       const homeLink = page.getByRole("link", { name: /home/i });
  39  | 
  40  |       await expect(homeLink).toBeVisible();
  41  |       await expect(homeLink).toHaveAttribute("href", "/");
  42  |     });
  43  | 
  44  |     test("filename is shown", async ({ page }) => {
  45  |       // The filename is rendered inside a span with aria-label="Document".
  46  |       const docLabel = page.locator('[aria-label="Document"]').first();
  47  | 
> 48  |       await expect(page.getByText("sample.pdf").first()).toBeVisible();
      |                                                          ^ Error: expect(locator).toBeVisible() failed
  49  |       await expect(docLabel).toContainText("sample.pdf");
  50  |     });
  51  | 
  52  |     test("Undo/Redo pill is present", async ({ page }) => {
  53  |       await expect(page.getByRole("button", { name: /^undo$/i }).first()).toBeVisible();
  54  |       await expect(page.getByRole("button", { name: /^redo$/i }).first()).toBeVisible();
  55  |     });
  56  | 
  57  |     test("Share via link button is present (sign-in gated)", async ({ page }) => {
  58  |       const shareButton = page
  59  |         .getByRole("button", { name: /share via link/i })
  60  |         .first();
  61  | 
  62  |       await expect(shareButton).toBeVisible();
  63  |       // In local mode the user is signed out, so the action is gated.
  64  |       await expect(shareButton).toBeDisabled();
  65  |     });
  66  | 
  67  |     test("Download dropdown lists all 8 formats", async ({ page }) => {
  68  |       await page.getByRole("button", { name: /^download$/i }).first().click();
  69  | 
  70  |       const formats = [
  71  |         "PDF (.pdf)",
  72  |         "Word (.docx)",
  73  |         "Excel (.xlsx)",
  74  |         "PowerPoint (.pptx)",
  75  |         "JPG image",
  76  |         "PNG image",
  77  |         "HTML",
  78  |         "Plain text (.txt)",
  79  |       ];
  80  | 
  81  |       for (const label of formats) {
  82  |         await expect(
  83  |           page.getByRole("menuitem", { name: label }).first(),
  84  |         ).toBeVisible();
  85  |       }
  86  |     });
  87  |   });
  88  | 
  89  |   test.describe("Left Sidebar", () => {
  90  |     test("thumbnails are visible and clicking page 2 jumps current page", async ({
  91  |       page,
  92  |     }) => {
  93  |       const thumbnails = page.getByRole("listbox", {
  94  |         name: /page thumbnails/i,
  95  |       });
  96  | 
  97  |       await expect(thumbnails).toBeVisible();
  98  |       await expect(page.getByRole("option", { name: /page 2/i })).toBeVisible();
  99  | 
  100 |       await page.getByRole("option", { name: /page 2/i }).click();
  101 | 
  102 |       await expect(
  103 |         page.getByRole("img", { name: /PDF page 2 of 3/i }),
  104 |       ).toBeVisible({ timeout: 5_000 });
  105 |     });
  106 | 
  107 |     test("drag handle exists and current page has active indicator", async ({
  108 |       page,
  109 |     }) => {
  110 |       await expect(
  111 |         page.getByLabel(/drag to reorder page 1/i),
  112 |       ).toBeVisible();
  113 | 
  114 |       const currentThumb = page.getByRole("option", { name: /page 1/i });
  115 | 
  116 |       await expect(currentThumb).toHaveAttribute("aria-selected", "true");
  117 |     });
  118 | 
  119 |     test("Add Page button appends a blank page", async ({ page }) => {
  120 |       await expect(
  121 |         page.getByRole("button", { name: /^add page$/i }),
  122 |       ).toBeVisible();
  123 | 
  124 |       await page.getByRole("button", { name: /^add page$/i }).click();
  125 | 
  126 |       await expect(
  127 |         page.getByRole("option", { name: /page 4/i }),
  128 |       ).toBeVisible({ timeout: 5_000 });
  129 |       await expect(
  130 |         page.getByRole("img", { name: /PDF page 4 of 4/i }),
  131 |       ).toBeVisible({ timeout: 5_000 });
  132 |     });
  133 |   });
  134 | 
  135 |   test.describe("Right Sidebar (desktop)", () => {
  136 |     test("Shapes tool shows shape properties", async ({ page }) => {
  137 |       await page.getByRole("button", { name: /^shapes$/i }).first().click();
  138 | 
  139 |       await expect(page.getByRole("heading", { name: "Shape" }).first()).toBeVisible({
  140 |         timeout: 3_000,
  141 |       });
  142 |       await expect(page.getByRole("heading", { name: "Background" }).first()).toBeVisible();
  143 |       await expect(page.getByRole("heading", { name: "Stroke" }).first()).toBeVisible();
  144 |       await expect(page.getByRole("heading", { name: "Stroke thickness" }).first()).toBeVisible();
  145 |     });
  146 | 
  147 |     test("Highlight tool shows highlight color properties", async ({ page }) => {
  148 |       await page.getByRole("button", { name: /^highlight$/i }).first().click();
```