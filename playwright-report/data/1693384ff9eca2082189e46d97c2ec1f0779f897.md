# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/ui-inventory.spec.ts >> PDF editor — UI inventory >> Top App Bar >> PDFVault logo links home
- Location: tests/pdf-editor/ui-inventory.spec.ts:37:5

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

# Page snapshot

```yaml
- generic [active]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - button "Back to dashboard" [ref=e4] [cursor=pointer]:
        - img [ref=e5]
      - button "Editor menu" [ref=e7] [cursor=pointer]:
        - img
      - separator [ref=e8]
      - link "Home" [ref=e9] [cursor=pointer]:
        - /url: /
        - img "PDFVault" [ref=e10]
      - textbox "Document name" [ref=e12]: sample
      - button "Save" [ref=e13] [cursor=pointer]:
        - img [ref=e14]
        - generic [ref=e17]: Save
      - generic [ref=e18]:
        - button "Undo" [disabled] [ref=e19]:
          - img [ref=e20]
        - button "Redo" [disabled] [ref=e23]:
          - img [ref=e24]
      - button "🌐 EN" [ref=e26] [cursor=pointer]
      - button "Show me around" [ref=e27] [cursor=pointer]:
        - img [ref=e28]
      - button "Search in PDF" [ref=e32] [cursor=pointer]:
        - img [ref=e33]
        - generic [ref=e36]: Search
      - button "Print" [ref=e37] [cursor=pointer]:
        - img [ref=e38]
        - generic [ref=e43]: Print
      - button "Share via link" [disabled] [ref=e44]:
        - img [ref=e45]
        - generic [ref=e48]: Share via link
      - button "Download" [ref=e49] [cursor=pointer]:
        - img
        - generic [ref=e50]: Done
    - generic [ref=e51]:
      - listbox "Page thumbnails" [ref=e52]:
        - button "Add page" [ref=e54] [cursor=pointer]:
          - img
          - text: Add Page
        - generic [ref=e55]:
          - option "Page 1" [selected] [ref=e57] [cursor=pointer]:
            - button "Drag to reorder page 1" [ref=e58]: ⋮⋮
            - generic [ref=e61]: "1"
          - option "Page 2" [ref=e63] [cursor=pointer]:
            - button "Drag to reorder page 2" [ref=e64]: ⋮⋮
            - generic [ref=e67]: "2"
          - option "Page 3" [ref=e69] [cursor=pointer]:
            - button "Drag to reorder page 3" [ref=e70]: ⋮⋮
            - generic [ref=e73]: "3"
        - status [ref=e74]
      - generic [ref=e75]:
        - generic [ref=e77]:
          - generic [ref=e78]:
            - button "Select" [pressed] [ref=e79] [cursor=pointer]:
              - img [ref=e80]
              - generic [ref=e82]: Select
            - button "Edit" [ref=e83] [cursor=pointer]:
              - img [ref=e84]
              - generic [ref=e86]: Edit
            - button "Sign" [ref=e87] [cursor=pointer]:
              - img [ref=e88]
              - generic [ref=e90]: Sign
            - button "Text" [ref=e91] [cursor=pointer]:
              - img [ref=e92]
              - generic [ref=e95]: Text
            - button "Draw" [ref=e96] [cursor=pointer]:
              - img [ref=e97]
              - generic [ref=e100]: Draw
            - button "Highlight" [ref=e101] [cursor=pointer]:
              - img [ref=e102]
              - generic [ref=e104]: Highlight
          - generic [ref=e105]:
            - button "Shapes" [ref=e106] [cursor=pointer]:
              - img [ref=e107]
              - generic [ref=e109]: Shapes
            - button "Eraser" [ref=e110] [cursor=pointer]:
              - img [ref=e111]
              - generic [ref=e113]: Eraser
            - button "Whiteout" [ref=e114] [cursor=pointer]:
              - img [ref=e115]
              - generic [ref=e118]: Whiteout
            - button "Redact" [ref=e119] [cursor=pointer]:
              - img [ref=e120]
              - generic [ref=e126]: Redact
            - button "Image" [ref=e127] [cursor=pointer]:
              - img [ref=e128]
              - generic [ref=e132]: Image
            - button "Watermark" [ref=e133] [cursor=pointer]:
              - img [ref=e134]
              - generic [ref=e137]: Watermark
            - button "Background" [ref=e138] [cursor=pointer]:
              - img [ref=e139]
              - generic [ref=e146]: Background
          - generic [ref=e147]:
            - button "Compress" [ref=e148] [cursor=pointer]:
              - img [ref=e149]
              - generic [ref=e151]: Compress
            - button "Secure" [ref=e152] [cursor=pointer]:
              - img [ref=e153]
              - generic [ref=e156]: Secure
            - button "Merge" [ref=e157] [cursor=pointer]:
              - img [ref=e158]
              - generic [ref=e161]: Merge
            - button "Split" [ref=e162] [cursor=pointer]:
              - img [ref=e163]
              - generic [ref=e166]: Split
            - button "Flatten" [ref=e167] [cursor=pointer]:
              - img [ref=e168]
              - generic [ref=e172]: Flatten
            - button "Extract" [ref=e173] [cursor=pointer]:
              - img [ref=e174]
              - generic [ref=e177]: Extract
            - button "Page No" [ref=e178] [cursor=pointer]:
              - img [ref=e179]
              - generic [ref=e182]: Page No
            - button "Annotate" [ref=e183] [cursor=pointer]:
              - img [ref=e184]
              - generic [ref=e187]: Annotate
          - button "Manage Pages" [ref=e189] [cursor=pointer]:
            - img [ref=e190]
            - generic [ref=e192]: Manage Pages
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
        - generic [ref=e196]:
          - img "PDF page 1 of 3" [ref=e197]
          - application "PDF editing canvas, page 1 of 3" [ref=e198]
  - generic [ref=e203] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e204]:
      - img [ref=e205]
    - generic [ref=e208]:
      - button "Open issues overlay" [ref=e209]:
        - generic [ref=e210]:
          - generic [ref=e211]: "4"
          - generic [ref=e212]: "5"
        - generic [ref=e213]:
          - text: Issue
          - generic [ref=e214]: s
      - button "Collapse issues badge" [ref=e215]:
        - img [ref=e216]
  - alert [ref=e218]
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
> 11  |   test.beforeEach(async ({ page }) => {
      |        ^ Test timeout of 30000ms exceeded while running "beforeEach" hook.
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
  48  |       await expect(page.getByText("sample.pdf").first()).toBeVisible();
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
```