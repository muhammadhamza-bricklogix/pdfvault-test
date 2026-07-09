# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/edit-text-export.spec.ts >> PDF editor — Edit Text >> Rotated page edge case >> modified source text survives PDF export on rotated pages
- Location: tests/pdf-editor/edit-text-export.spec.ts:250:5

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 1000
Received:   872
```

# Page snapshot

```yaml
- generic:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - button "Editor menu" [ref=e4] [cursor=pointer]:
        - img
      - separator [ref=e5]
      - link "Home" [ref=e6] [cursor=pointer]:
        - /url: /
        - img "PDFVault" [ref=e7]
      - generic "Document" [ref=e9]: rotated-sample.pdf
      - generic [ref=e10]:
        - button "Undo" [ref=e11] [cursor=pointer]:
          - img [ref=e12]
        - button "Redo" [disabled] [ref=e15]:
          - img [ref=e16]
      - button "Share via link" [disabled] [ref=e18]:
        - img [ref=e19]
        - text: Share via link
      - button "Download" [ref=e22] [cursor=pointer]:
        - text: Download
        - img
    - generic [ref=e23]:
      - generic [ref=e24]:
        - button "Select" [ref=e25] [cursor=pointer]:
          - img [ref=e26]
          - generic [ref=e28]: Select
        - button "Edit" [active] [pressed] [ref=e29] [cursor=pointer]:
          - img [ref=e30]
          - generic [ref=e32]: Edit
        - button "Sign" [ref=e33] [cursor=pointer]:
          - img [ref=e34]
          - generic [ref=e36]: Sign
        - button "Text" [ref=e37] [cursor=pointer]:
          - img [ref=e38]
          - generic [ref=e41]: Text
        - button "Draw" [ref=e42] [cursor=pointer]:
          - img [ref=e43]
          - generic [ref=e46]: Draw
        - button "Highlight" [ref=e47] [cursor=pointer]:
          - img [ref=e48]
          - generic [ref=e50]: Highlight
      - generic [ref=e51]:
        - button "Shapes" [ref=e52] [cursor=pointer]:
          - img [ref=e53]
          - generic [ref=e55]: Shapes
        - button "Eraser" [ref=e56] [cursor=pointer]:
          - img [ref=e57]
          - generic [ref=e60]: Eraser
        - button "Whiteout" [ref=e61] [cursor=pointer]:
          - img [ref=e62]
          - generic [ref=e65]: Whiteout
        - button "Redact" [ref=e66] [cursor=pointer]:
          - img [ref=e67]
          - generic [ref=e73]: Redact
        - button "Image" [ref=e74] [cursor=pointer]:
          - img [ref=e75]
          - generic [ref=e79]: Image
        - button "Watermark" [ref=e80] [cursor=pointer]:
          - img [ref=e81]
          - generic [ref=e84]: Watermark
        - button "Background" [ref=e85] [cursor=pointer]:
          - img [ref=e86]
          - generic [ref=e93]: Background
      - generic [ref=e94]:
        - button "Compress" [ref=e95] [cursor=pointer]:
          - img [ref=e96]
          - generic [ref=e98]: Compress
        - button "Secure" [ref=e99] [cursor=pointer]:
          - img [ref=e100]
          - generic [ref=e103]: Secure
        - button "Merge" [ref=e104] [cursor=pointer]:
          - img [ref=e105]
          - generic [ref=e108]: Merge
        - button "Split" [ref=e109] [cursor=pointer]:
          - img [ref=e110]
          - generic [ref=e113]: Split
        - button "Flatten" [ref=e114] [cursor=pointer]:
          - img [ref=e115]
          - generic [ref=e119]: Flatten
        - button "Extract" [ref=e120] [cursor=pointer]:
          - img [ref=e121]
          - generic [ref=e124]: Extract
        - button "Page No" [ref=e125] [cursor=pointer]:
          - img [ref=e126]
          - generic [ref=e129]: Page No
        - button "Annotate" [ref=e130] [cursor=pointer]:
          - img [ref=e131]
          - generic [ref=e134]: Annotate
      - button "Manage Pages" [ref=e136] [cursor=pointer]:
        - img [ref=e137]
        - generic [ref=e139]: Manage Pages
    - generic [ref=e140]:
      - listbox "Page thumbnails" [ref=e141]:
        - button "Add page" [ref=e142] [cursor=pointer]:
          - img
          - text: Add Page
        - option "Page 1" [selected] [ref=e145] [cursor=pointer]:
          - generic [ref=e148]: "1"
      - generic [ref=e152]:
        - img "PDF page 1 of 1" [ref=e153]
        - application "PDF editing canvas, page 1 of 1" [ref=e155]
      - button "Performance panel" [ref=e158] [cursor=pointer]:
        - button "Performance panel" [ref=e159]:
          - img
  - button "Open Next.js Dev Tools" [ref=e165] [cursor=pointer]:
    - generic [ref=e168]:
      - text: Compiling
      - generic [ref=e169]:
        - generic [ref=e170]: .
        - generic [ref=e171]: .
        - generic [ref=e172]: .
  - alert [ref=e173]
  - region "1 notification.":
    - list:
      - listitem:
        - alertdialog "Exported" [ref=e174]:
          - img [ref=e176]
          - alert [ref=e178]:
            - generic [ref=e179]: Exported
            - generic [ref=e180]: Your edited PDF has been downloaded.
          - button "Close":
            - img
```

# Test source

```ts
  166 |         const editorStatePart = parts.editorState;
  167 | 
  168 |         if (!filePart || !editorStatePart) {
  169 |           await route.continue();
  170 | 
  171 |           return;
  172 |         }
  173 | 
  174 |         captured = {
  175 |           fileBytes: filePart.data,
  176 |           editorState: editorStatePart.data.toString("utf-8"),
  177 |         };
  178 | 
  179 |         fakeDocument.sizeBytes = captured.fileBytes.length;
  180 | 
  181 |         await route.fulfill({
  182 |           body: JSON.stringify(fakeDocument),
  183 |           contentType: "application/json",
  184 |           status: 200,
  185 |         });
  186 |       });
  187 | 
  188 |       await page.evaluate(() =>
  189 |         window.dispatchEvent(new CustomEvent("editor:save")),
  190 |       );
  191 | 
  192 |       await page.waitForFunction(
  193 |         () =>
  194 |           window.__PDF_EDITOR_TEST__?.getStore().currentDocumentId ===
  195 |           "pdfedits-qa-doc-id",
  196 |         { timeout: 15_000 },
  197 |       );
  198 | 
  199 |       expect(captured).not.toBeNull();
  200 | 
  201 |       const parsedState = JSON.parse(captured!.editorState);
  202 | 
  203 |       expect(parsedState.v).toBe(1);
  204 |       expect(parsedState.extractedPages).toContain(1);
  205 | 
  206 |       const page1Json = JSON.parse(parsedState.fabricJsonByPage["1"]);
  207 |       const editedObject = page1Json.objects.find(
  208 |         (o: any) => o.editorType === "editModeText",
  209 |       );
  210 | 
  211 |       expect(editedObject).toBeTruthy();
  212 |       expect(editedObject.text).toBe(editedText);
  213 |       expect(editedObject.originalText).not.toBe(editedText);
  214 | 
  215 |       const originalSize = fs.statSync("tests/fixtures/sample.pdf").size;
  216 | 
  217 |       expect(captured!.fileBytes.length).toBeGreaterThan(1_000);
  218 |       expect(captured!.fileBytes.length).not.toBe(originalSize);
  219 |     });
  220 |   });
  221 | 
  222 |   test.describe("Rotated page edge case", () => {
  223 |     const rotatedFixture = path.join(
  224 |       __dirname,
  225 |       "..",
  226 |       "fixtures",
  227 |       "rotated-sample.pdf",
  228 |     );
  229 | 
  230 |     test.beforeEach(async () => {
  231 |       const pdfDoc = await PDFDocument.create();
  232 |       const pdfPage = pdfDoc.addPage([612, 792]);
  233 | 
  234 |       pdfPage.setRotation(degrees(90));
  235 | 
  236 |       const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  237 |       const { height } = pdfPage.getSize();
  238 | 
  239 |       pdfPage.drawText("Rotated editable text", {
  240 |         color: rgb(0, 0, 0),
  241 |         font,
  242 |         size: 24,
  243 |         x: 50,
  244 |         y: height / 2,
  245 |       });
  246 | 
  247 |       fs.writeFileSync(rotatedFixture, await pdfDoc.save());
  248 |     });
  249 | 
  250 |     test("modified source text survives PDF export on rotated pages", async ({
  251 |       page,
  252 |     }) => {
  253 |       await page.goto("/pdf-editor");
  254 |       await page.locator('input[type="file"]').setInputFiles(rotatedFixture);
  255 |       await waitForPdfReady(page);
  256 | 
  257 |       await page.getByRole("button", { name: /^edit$/i }).first().click();
  258 |       await armEditTextAndWait(page);
  259 | 
  260 |       const editedText = `${EDITED_MARKER}ROT_${Date.now()}`;
  261 |       await replaceFirstEditText(page, editedText);
  262 | 
  263 |       const downloadPath = await exportPdfDownload(page);
  264 |       const stats = fs.statSync(downloadPath);
  265 | 
> 266 |       expect(stats.size).toBeGreaterThan(1_000);
      |                          ^ Error: expect(received).toBeGreaterThan(expected)
  267 | 
  268 |       const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  269 |       const data = new Uint8Array(fs.readFileSync(downloadPath));
  270 |       const doc = await getDocument({ data }).promise;
  271 | 
  272 |       expect(doc.numPages).toBe(1);
  273 | 
  274 |       const exportedPage = await doc.getPage(1);
  275 |       const viewport = exportedPage.getViewport({ scale: 1 });
  276 | 
  277 |       // Source was portrait MediaBox 612×792 with /Rotate 90, so pdf.js
  278 |       // exposes it as a landscape viewport 792×612. The merge pipeline must
  279 |       // keep that same visual orientation in the exported file.
  280 |       expect(viewport.width).toBeCloseTo(792, 0);
  281 |       expect(viewport.height).toBeCloseTo(612, 0);
  282 |       expect(exportedPage.rotate).toBe(0);
  283 |     });
  284 |   });
  285 | });
  286 | 
  287 | function parseMultipart(
  288 |   buffer: Buffer,
  289 |   contentType: string,
  290 | ): Record<string, { filename?: string; data: Buffer }> {
  291 |   const boundaryMatch = contentType.match(/boundary=([^;\s]+)/);
  292 | 
  293 |   if (!boundaryMatch) return {};
  294 | 
  295 |   const boundary = "--" + boundaryMatch[1]!.replace(/^["']|["']$/g, "");
  296 |   const bodyText = buffer.toString("binary");
  297 |   const parts: Record<string, { filename?: string; data: Buffer }> = {};
  298 |   const segments = bodyText.split(boundary);
  299 | 
  300 |   for (const segment of segments) {
  301 |     const trimmed = segment.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
  302 | 
  303 |     if (!trimmed || trimmed === "--") continue;
  304 | 
  305 |     const splitIndex = trimmed.indexOf("\r\n\r\n");
  306 | 
  307 |     if (splitIndex === -1) continue;
  308 | 
  309 |     const headers = trimmed.slice(0, splitIndex);
  310 |     const rawBody = trimmed.slice(splitIndex + 4);
  311 |     const nameMatch = headers.match(/name="([^"]+)"/);
  312 |     const filenameMatch = headers.match(/filename="([^"]*)"/);
  313 | 
  314 |     if (nameMatch) {
  315 |       parts[nameMatch[1]!] = {
  316 |         filename: filenameMatch?.[1],
  317 |         data: Buffer.from(rawBody, "binary"),
  318 |       };
  319 |     }
  320 |   }
  321 | 
  322 |   return parts;
  323 | }
  324 | 
```