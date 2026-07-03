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
Received:   873
```

# Page snapshot

```yaml
- generic:
  - generic [ref=e2]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - button "Editor menu" [ref=e6] [cursor=pointer]:
          - img
        - separator [ref=e7]
        - button "Browse all tools" [ref=e8] [cursor=pointer]:
          - img
          - generic [ref=e9]: Tools
      - generic [ref=e10]:
        - generic [ref=e11]: rotated-sample.pdf
        - separator [ref=e12]
        - generic [ref=e13]:
          - button "Previous page" [disabled]: ‹
          - generic [ref=e14]: Page 1 of 1
          - button "Next page" [disabled]: ›
      - generic [ref=e15]:
        - generic [ref=e17]:
          - button "Zoom out" [ref=e18] [cursor=pointer]: −
          - generic [ref=e19]: 100%
          - button "Zoom in" [ref=e20] [cursor=pointer]: +
        - separator [ref=e21]
        - group [ref=e22]:
          - button "Save" [disabled]:
            - img
            - generic: Save
          - button "Export options" [ref=e23] [cursor=pointer]:
            - img
        - separator [ref=e24]
        - button "Switch to dark mode" [ref=e25] [cursor=pointer]:
          - img
    - generic [ref=e26]:
      - toolbar "History actions" [ref=e27]:
        - group [ref=e28]:
          - button "Undo" [ref=e29] [cursor=pointer]:
            - img
            - generic [ref=e30]: Undo
          - button "Redo" [disabled]:
            - img
            - generic: Redo
      - separator [ref=e31]
      - toolbar "Drawing tools" [ref=e32]:
        - radiogroup [ref=e33]:
          - radio "Select" [ref=e34] [cursor=pointer]:
            - img
            - generic [ref=e35]: Select
          - radio "Edit Text" [checked] [active] [ref=e36] [cursor=pointer]:
            - img
            - generic [ref=e37]: Edit Text
          - radio "Signature" [ref=e38] [cursor=pointer]:
            - img
            - generic [ref=e39]: Signature
          - radio "Text" [ref=e40] [cursor=pointer]:
            - img
            - generic [ref=e41]: Text
          - radio "Draw" [ref=e42] [cursor=pointer]:
            - img
            - generic [ref=e43]: Draw
          - radio "Highlight" [ref=e44] [cursor=pointer]:
            - img
            - generic [ref=e45]: Highlight
          - radio "Shapes" [ref=e46] [cursor=pointer]:
            - img
            - generic [ref=e47]: Shapes
          - radio "Eraser" [ref=e48] [cursor=pointer]:
            - img
            - generic [ref=e49]: Eraser
          - radio "Whiteout" [ref=e50] [cursor=pointer]:
            - img
            - generic [ref=e51]: Whiteout
          - radio "Redact" [ref=e52] [cursor=pointer]:
            - img
            - generic [ref=e53]: Redact
          - radio "Image" [ref=e54] [cursor=pointer]:
            - img
            - generic [ref=e55]: Image
          - radio "Watermark" [ref=e56] [cursor=pointer]:
            - img
            - generic [ref=e57]: Watermark
          - radio "Background" [ref=e58] [cursor=pointer]:
            - img
            - generic [ref=e59]: Background
      - separator [ref=e60]
      - button "Manage Pages" [ref=e61] [cursor=pointer]:
        - img
        - generic [ref=e62]: Manage Pages
    - generic [ref=e63]:
      - listbox "Page thumbnails" [ref=e64]:
        - option "Page 1" [selected] [ref=e67] [cursor=pointer]:
          - generic [ref=e70]: "1"
      - generic [ref=e74]:
        - img "PDF page 1 of 1" [ref=e75]
        - application "PDF editing canvas, page 1 of 1" [ref=e77]
      - button "Performance panel" [ref=e81] [cursor=pointer]:
        - button "Performance panel" [ref=e82]:
          - img
  - button "Open Next.js Dev Tools" [ref=e88] [cursor=pointer]:
    - generic [ref=e91]:
      - text: Compiling
      - generic [ref=e92]:
        - generic [ref=e93]: .
        - generic [ref=e94]: .
        - generic [ref=e95]: .
  - alert [ref=e96]
  - region "1 notification.":
    - list:
      - listitem:
        - alertdialog "Exported" [ref=e97]:
          - img [ref=e99]
          - alert [ref=e101]:
            - generic [ref=e102]: Exported
            - generic [ref=e103]: Your edited PDF has been downloaded.
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
  257 |       await page.getByRole("radio", { name: /Edit Text/i }).click();
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