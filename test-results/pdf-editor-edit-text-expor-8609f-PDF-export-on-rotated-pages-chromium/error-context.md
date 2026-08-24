# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/edit-text-export.spec.ts >> PDF editor — Edit Text >> Rotated page edge case >> modified source text survives PDF export on rotated pages
- Location: tests/pdf-editor/edit-text-export.spec.ts:250:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForEvent: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for event "download"
============================================================
```

# Page snapshot

```yaml
- generic:
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
      - textbox "Document name" [ref=e12]: rotated-sample
      - button "Save" [ref=e13] [cursor=pointer]:
        - img [ref=e14]
        - generic [ref=e17]: Save
      - generic [ref=e18]:
        - button "Undo" [ref=e19] [cursor=pointer]:
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
        - option "Page 1" [selected] [ref=e57] [cursor=pointer]:
          - img "Page 1 preview" [ref=e59]
          - generic [ref=e60]: "1"
      - generic [ref=e61]:
        - generic [ref=e63]:
          - generic [ref=e64]:
            - button "Select" [ref=e65] [cursor=pointer]:
              - img [ref=e66]
              - generic [ref=e68]: Select
            - button "Edit" [pressed] [ref=e69] [cursor=pointer]:
              - img [ref=e70]
              - generic [ref=e72]: Edit
            - button "Sign" [ref=e73] [cursor=pointer]:
              - img [ref=e74]
              - generic [ref=e76]: Sign
            - button "Text" [ref=e77] [cursor=pointer]:
              - img [ref=e78]
              - generic [ref=e81]: Text
            - button "Draw" [ref=e82] [cursor=pointer]:
              - img [ref=e83]
              - generic [ref=e86]: Draw
            - button "Highlight" [ref=e87] [cursor=pointer]:
              - img [ref=e88]
              - generic [ref=e90]: Highlight
          - generic [ref=e91]:
            - button "Shapes" [ref=e92] [cursor=pointer]:
              - img [ref=e93]
              - generic [ref=e95]: Shapes
            - button "Eraser" [ref=e96] [cursor=pointer]:
              - img [ref=e97]
              - generic [ref=e99]: Eraser
            - button "Whiteout" [ref=e100] [cursor=pointer]:
              - img [ref=e101]
              - generic [ref=e104]: Whiteout
            - button "Redact" [ref=e105] [cursor=pointer]:
              - img [ref=e106]
              - generic [ref=e112]: Redact
            - button "Image" [ref=e113] [cursor=pointer]:
              - img [ref=e114]
              - generic [ref=e118]: Image
            - button "Watermark" [ref=e119] [cursor=pointer]:
              - img [ref=e120]
              - generic [ref=e123]: Watermark
            - button "Background" [ref=e124] [cursor=pointer]:
              - img [ref=e125]
              - generic [ref=e132]: Background
          - generic [ref=e133]:
            - button "Compress" [ref=e134] [cursor=pointer]:
              - img [ref=e135]
              - generic [ref=e137]: Compress
            - button "Secure" [ref=e138] [cursor=pointer]:
              - img [ref=e139]
              - generic [ref=e142]: Secure
            - button "Merge" [ref=e143] [cursor=pointer]:
              - img [ref=e144]
              - generic [ref=e147]: Merge
            - button "Split" [ref=e148] [cursor=pointer]:
              - img [ref=e149]
              - generic [ref=e152]: Split
            - button "Flatten" [ref=e153] [cursor=pointer]:
              - img [ref=e154]
              - generic [ref=e158]: Flatten
            - button "Extract" [ref=e159] [cursor=pointer]:
              - img [ref=e160]
              - generic [ref=e163]: Extract
            - button "Page No" [ref=e164] [cursor=pointer]:
              - img [ref=e165]
              - generic [ref=e168]: Page No
            - button "Annotate" [ref=e169] [cursor=pointer]:
              - img [ref=e170]
              - generic [ref=e173]: Annotate
          - button "Manage Pages" [ref=e175] [cursor=pointer]:
            - img [ref=e176]
            - generic [ref=e178]: Manage Pages
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
        - generic [ref=e182]:
          - img "PDF page 1 of 1" [ref=e183]
          - application "PDF editing canvas, page 1 of 1" [ref=e185]
          - region "Text formatting" [ref=e187]:
            - button "Close text formatting" [ref=e188] [cursor=pointer]:
              - img [ref=e189]
            - generic [ref=e191]:
              - generic [ref=e192]:
                - generic [ref=e193]: Font
                - generic [ref=e194]:
                  - button "Select an item Font family" [ref=e195] [cursor=pointer]:
                    - generic [ref=e196]: Select an item
                    - img [ref=e197]
                  - combobox [ref=e201]
              - generic [ref=e202]:
                - generic [ref=e203]: Size
                - generic [ref=e204]:
                  - button "24 Font size" [ref=e205] [cursor=pointer]:
                    - generic [ref=e206]: "24"
                    - img [ref=e207]
                  - combobox [ref=e211]
              - generic [ref=e212]:
                - generic [ref=e213]: Style
                - toolbar "Text style" [ref=e214]:
                  - button "Bold" [ref=e215] [cursor=pointer]:
                    - img
                  - button "Italic" [ref=e216] [cursor=pointer]:
                    - img
              - generic [ref=e217]:
                - generic [ref=e218]: Alignment
                - radiogroup "Text alignment" [ref=e219]:
                  - radio "Align left" [checked] [ref=e220] [cursor=pointer]:
                    - img
                  - radio "Align center" [ref=e221] [cursor=pointer]:
                    - img
                  - radio "Align right" [ref=e222] [cursor=pointer]:
                    - img
              - generic [ref=e223]:
                - generic [ref=e224]: Color
                - generic [ref=e225]:
                  - 'button "Set color #000000" [pressed] [ref=e226] [cursor=pointer]'
                  - 'button "Set color #FFFFFF" [ref=e227] [cursor=pointer]'
                  - 'button "Set color #EF4444" [ref=e228] [cursor=pointer]'
                  - 'button "Set color #F59E0B" [ref=e229] [cursor=pointer]'
                  - 'button "Set color #10B981" [ref=e230] [cursor=pointer]'
                  - 'button "Set color #3B82F6" [ref=e231] [cursor=pointer]'
                  - 'button "Set color #8B5CF6" [ref=e232] [cursor=pointer]'
                  - 'button "Set color #EC4899" [ref=e233] [cursor=pointer]'
                  - 'button "Set color #6B7280" [ref=e234] [cursor=pointer]'
                  - 'button "Set color #7C2D12" [ref=e235] [cursor=pointer]'
                  - button "More colors More colors" [ref=e237] [cursor=pointer]:
                    - button "More colors" [ref=e238]
                    - generic [ref=e239]: More colors
      - button "Performance panel" [ref=e241] [cursor=pointer]:
        - button "Performance panel" [ref=e242]:
          - img
  - generic [ref=e247] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e248]:
      - img [ref=e249]
    - generic [ref=e252]:
      - button "Open issues overlay" [ref=e253]:
        - generic [ref=e254]:
          - generic [ref=e255]: "6"
          - generic [ref=e256]: "7"
        - generic [ref=e257]:
          - text: Issue
          - generic [ref=e258]: s
      - button "Collapse issues badge" [ref=e259]:
        - img [ref=e260]
  - alert [ref=e262]
  - generic [ref=e263]:
    - generic:
      - generic:
        - button "Dismiss"
      - dialog "Sign up to download" [active] [ref=e264]:
        - button "Close" [ref=e265] [cursor=pointer]:
          - img
        - heading "Sign up to download" [level=2] [ref=e267]
        - paragraph [ref=e269]: Create an account and we'll bring you back to finish the download right where you left off.
        - generic [ref=e270]:
          - button "Cancel" [ref=e271] [cursor=pointer]
          - button "Sign up & continue" [ref=e272] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import {
  3   |   PDFDocument,
  4   |   StandardFonts,
  5   |   degrees,
  6   |   rgb,
  7   | } from "pdf-lib";
  8   | import fs from "node:fs";
  9   | import path from "node:path";
  10  | import { fileURLToPath } from "node:url";
  11  | 
  12  | import { openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";
  13  | 
  14  | const __filename = fileURLToPath(import.meta.url);
  15  | const __dirname = path.dirname(__filename);
  16  | 
  17  | const EDITED_MARKER = "PDFEDITS_QA_EDITED_";
  18  | 
  19  | function armEditTextAndWait(page: import("@playwright/test").Page) {
  20  |   return page.waitForFunction(
  21  |     () => {
  22  |       const store = window.__PDF_EDITOR_TEST__?.getStore();
  23  | 
  24  |       if (!store) return false;
  25  | 
  26  |       return store.extractedPages.has(
  27  |         store.getSourcePageIndex(store.currentPage),
  28  |       );
  29  |     },
  30  |     { timeout: 15_000 },
  31  |   );
  32  | }
  33  | 
  34  | async function replaceFirstEditText(
  35  |   page: import("@playwright/test").Page,
  36  |   editedText: string,
  37  | ) {
  38  |   await page.evaluate(
  39  |     ({ editedText }) => {
  40  |       const canvas = window.__PDF_EDITOR_TEST__!.fabricCanvas!;
  41  |       const obj = canvas
  42  |         .getObjects()
  43  |         .find((o) => (o as any).editorType === "editModeText") as any;
  44  | 
  45  |       if (!obj) {
  46  |         throw new Error("No editModeText overlay found on the canvas");
  47  |       }
  48  | 
  49  |       canvas.setActiveObject(obj);
  50  |       obj.text = editedText;
  51  |       obj.setCoords();
  52  |       canvas.discardActiveObject();
  53  |       canvas.renderAll();
  54  |     },
  55  |     { editedText },
  56  |   );
  57  | }
  58  | 
  59  | async function exportPdfDownload(
  60  |   page: import("@playwright/test").Page,
  61  | ): Promise<string> {
  62  |   const [download] = await Promise.all([
> 63  |     page.waitForEvent("download"),
      |          ^ Error: page.waitForEvent: Test timeout of 30000ms exceeded.
  64  |     page.evaluate(() =>
  65  |       window.dispatchEvent(
  66  |         new CustomEvent("editor:export", { detail: { format: "pdf" } }),
  67  |       )
  68  |     ),
  69  |   ]);
  70  | 
  71  |   const downloadPath = await download.path();
  72  | 
  73  |   if (!downloadPath) {
  74  |     throw new Error("PDF export download did not produce a file path");
  75  |   }
  76  | 
  77  |   return downloadPath;
  78  | }
  79  | 
  80  | test.describe("PDF editor — Edit Text", () => {
  81  |   // Export / mocked-save specs do not need a real Clerk session.
  82  |   test.use({ storageState: undefined });
  83  | 
  84  |   test.describe("Sample PDF (upright pages)", () => {
  85  |     test.beforeEach(async ({ page }) => {
  86  |       await openSamplePdfInEditor(page);
  87  |       await waitForPdfReady(page);
  88  |     });
  89  | 
  90  |     test("modified source text survives PDF export", async ({ page }) => {
  91  |       await page.getByRole("button", { name: /^edit$/i }).first().click();
  92  |       await armEditTextAndWait(page);
  93  | 
  94  |       const editedText = `${EDITED_MARKER}${Date.now()}`;
  95  |       await replaceFirstEditText(page, editedText);
  96  | 
  97  |       const liveText = await page.evaluate(() => {
  98  |         const canvas = window.__PDF_EDITOR_TEST__!.fabricCanvas!;
  99  |         const obj = canvas
  100 |           .getObjects()
  101 |           .find((o) => (o as any).editorType === "editModeText") as any;
  102 | 
  103 |         return obj?.text ?? "";
  104 |       });
  105 | 
  106 |       expect(liveText).toBe(editedText);
  107 | 
  108 |       const downloadPath = await exportPdfDownload(page);
  109 |       const stats = fs.statSync(downloadPath);
  110 | 
  111 |       expect(stats.size).toBeGreaterThan(1_000);
  112 | 
  113 |       const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  114 |       const data = new Uint8Array(fs.readFileSync(downloadPath));
  115 |       const doc = await getDocument({ data }).promise;
  116 | 
  117 |       expect(doc.numPages).toBe(3);
  118 |     });
  119 | 
  120 |     test("save uploads merged PDF + editorState with edited text", async ({
  121 |       page,
  122 |     }) => {
  123 |       await page.evaluate(() => {
  124 |         window.__PDF_EDITOR_TEST__!.getStore().setIsSignedIn(true);
  125 |       });
  126 | 
  127 |       await page.getByRole("button", { name: /^edit$/i }).first().click();
  128 |       await armEditTextAndWait(page);
  129 | 
  130 |       const editedText = `${EDITED_MARKER}SAVE_${Date.now()}`;
  131 |       await replaceFirstEditText(page, editedText);
  132 | 
  133 |       type Captured = {
  134 |         fileBytes: Buffer;
  135 |         editorState: string;
  136 |       };
  137 | 
  138 |       let captured: Captured | null = null;
  139 |       const fakeDocument = {
  140 |         id: "pdfedits-qa-doc-id",
  141 |         filename: "sample.pdf",
  142 |         contentType: "application/pdf",
  143 |         sizeBytes: 0,
  144 |         status: "READY",
  145 |         pageCount: 3,
  146 |         version: 1,
  147 |         url: "http://localhost:3000/fake-doc-url",
  148 |         editorState: null,
  149 |         createdAt: new Date().toISOString(),
  150 |         updatedAt: new Date().toISOString(),
  151 |       };
  152 | 
  153 |       await page.route("**/documents/upload", async (route) => {
  154 |         const request = route.request();
  155 |         const contentType = (await request.headerValue("content-type")) ?? "";
  156 |         const body = request.postDataBuffer();
  157 | 
  158 |         if (request.method() !== "POST" || !body) {
  159 |           await route.continue();
  160 | 
  161 |           return;
  162 |         }
  163 | 
```