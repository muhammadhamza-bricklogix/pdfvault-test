# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/ui-inventory.spec.ts >> PDF editor — UI inventory >> Save / persistence smoke >> beforeunload prompt fires on unsaved changes
- Location: tests/pdf-editor/ui-inventory.spec.ts:278:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "beforeunload"
Received: null
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - link "PDFVault home" [ref=e7] [cursor=pointer]:
            - /url: /
            - img "PDFVault" [ref=e8]
          - navigation "Primary" [ref=e9]:
            - button "All Tools" [ref=e10]:
              - text: All Tools
              - img [ref=e11]
            - link "Edit" [ref=e13] [cursor=pointer]:
              - /url: /pdf-composer
            - link "Convert" [ref=e14] [cursor=pointer]:
              - /url: /convert/pdf-to-word
            - link "Compress" [ref=e15] [cursor=pointer]:
              - /url: /pdf-composer?tool=compress
        - generic [ref=e16]:
          - button "Select language" [ref=e19]:
            - img [ref=e20]
            - text: EN
            - img [ref=e23]
          - link "Login" [ref=e25] [cursor=pointer]:
            - /url: /sign-in
          - link "Get started" [ref=e26] [cursor=pointer]:
            - /url: /sign-up
    - main [ref=e27]:
      - region "A smarter, more secure home for every PDF." [ref=e28]:
        - generic [ref=e29]:
          - heading "A smarter, more secure home for every PDF." [level=1] [ref=e30]:
            - text: A smarter, more secure
            - text: home for every PDF.
          - paragraph [ref=e31]: Sign, edit, protect and much more. Keep important documents in one secure workspace without losing track of files that matter.
        - generic [ref=e33]:
          - generic [ref=e35]:
            - button "Upload a file. Drop a file here, or activate to browse." [ref=e36] [cursor=pointer]:
              - img
              - button "Choose File" [ref=e37]
              - generic [ref=e38]:
                - heading "Drop your file here to get started" [level=2] [ref=e39]
                - paragraph [ref=e40]: Upload a PDF or import from your cloud storage.
                - paragraph [ref=e41]: Supports PDF, DOC, DOCX, JPG, JPEG, PNG
                - button "Choose File" [ref=e42]
              - paragraph [ref=e43]
            - generic [ref=e44]:
              - button "Upload from Google drive" [ref=e45] [cursor=pointer]:
                - text: Upload from Google drive
                - img [ref=e46]
              - button "Upload from device" [ref=e53] [cursor=pointer]:
                - text: Upload from device
                - img [ref=e54]
          - list [ref=e57]:
            - listitem [ref=e58]:
              - img [ref=e59]
              - text: Secure document storage
            - listitem [ref=e62]:
              - img [ref=e63]
              - text: Edit in your browser
            - listitem [ref=e66]:
              - img [ref=e67]
              - text: Personal file library
      - region "Get started in three simple steps" [ref=e70]:
        - generic [ref=e71]:
          - generic [ref=e72]:
            - heading "Get started in three simple steps" [level=2] [ref=e73]
            - paragraph [ref=e74]: From upload to a securely saved document, PDFVault makes it easy to handle every PDF in one place.
          - list [ref=e75]:
            - listitem [ref=e76]:
              - heading "Bring in your document" [level=3] [ref=e77]
              - paragraph [ref=e78]: Upload from your device or import directly from Google Drive or Microsoft OneDrive.
            - listitem [ref=e79]:
              - heading "Make it yours" [level=3] [ref=e80]
              - paragraph [ref=e81]: Edit, convert, compress, protect, organize, or sign your document with the tools you need.
            - listitem [ref=e82]:
              - heading "Save it to your vault" [level=3] [ref=e83]
              - paragraph [ref=e84]: Keep the latest version in your personal document library, ready whenever you need it again.
      - region "Every tool you need to work with PDFs in one place" [ref=e85]:
        - generic [ref=e86]:
          - generic [ref=e87]:
            - heading "Every tool you need to work with PDFs in one place" [level=2] [ref=e88]:
              - generic [ref=e89]:
                - text: Every tool you need to work
                - text: with PDFs in one place
            - paragraph [ref=e90]: Every tool you need to use PDFs, at your fingertips. All are 100% FREE and easy to use! Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks.
          - tablist "Tool categories" [ref=e92]:
            - tab "Edit & Sign" [selected] [ref=e93] [cursor=pointer]
            - tab "Convert to PDF" [ref=e94] [cursor=pointer]
            - tab "Compress PDF" [ref=e95] [cursor=pointer]
            - tab "Convert from PDF" [ref=e96] [cursor=pointer]
            - tab "Others" [ref=e97] [cursor=pointer]
          - list [ref=e98]:
            - listitem [ref=e99]:
              - link "PDF Composer Revise text and objects inline with our full in-browser PDF composer." [ref=e100] [cursor=pointer]:
                - /url: /pdf-composer
                - heading "PDF Composer" [level=3] [ref=e102]
                - paragraph [ref=e103]: Revise text and objects inline with our full in-browser PDF composer.
                - img [ref=e105]
            - listitem [ref=e107]:
              - link "Sign & Watermark Sign and watermark with vector strokes." [ref=e108] [cursor=pointer]:
                - /url: /pdf-composer?tool=watermark
                - heading "Sign & Watermark" [level=3] [ref=e110]
                - paragraph [ref=e111]: Sign and watermark with vector strokes.
                - img [ref=e113]
            - listitem [ref=e115]:
              - link "Organize Pages Reorder, insert, and rotate thumbnails until the flow is right." [ref=e116] [cursor=pointer]:
                - /url: /pdf-composer?tool=manage
                - heading "Organize Pages" [level=3] [ref=e118]
                - paragraph [ref=e119]: Reorder, insert, and rotate thumbnails until the flow is right.
                - img [ref=e121]
            - listitem [ref=e123]:
              - link "Split & Extract Pages Pull out the pages you need or split a long file into lighter ones." [ref=e124] [cursor=pointer]:
                - /url: /pdf-composer?tool=split
                - heading "Split & Extract Pages" [level=3] [ref=e126]
                - paragraph [ref=e127]: Pull out the pages you need or split a long file into lighter ones.
                - img [ref=e129]
            - listitem [ref=e131]:
              - link "Password Protect Lock your PDF with a password so only intended readers get in." [ref=e132] [cursor=pointer]:
                - /url: /pdf-composer?tool=password
                - heading "Password Protect" [level=3] [ref=e134]
                - paragraph [ref=e135]: Lock your PDF with a password so only intended readers get in.
                - img [ref=e137]
            - listitem [ref=e139]:
              - link "Unlock PDF Remove encryption when you have the right credentials." [ref=e140] [cursor=pointer]:
                - /url: /pdf-composer?tool=unlock
                - heading "Unlock PDF" [level=3] [ref=e142]
                - paragraph [ref=e143]: Remove encryption when you have the right credentials.
                - img [ref=e145]
            - listitem [ref=e147]:
              - link "Rotate Pages Fix upside-down scans or mixed-orientation bundles in seconds." [ref=e148] [cursor=pointer]:
                - /url: /pdf-composer?tool=manage
                - heading "Rotate Pages" [level=3] [ref=e150]
                - paragraph [ref=e151]: Fix upside-down scans or mixed-orientation bundles in seconds.
                - img [ref=e153]
            - listitem [ref=e155]:
              - link "Delete Pages Drop extras, blanks, or outdated sections without re-exporting." [ref=e156] [cursor=pointer]:
                - /url: /pdf-composer?tool=manage
                - heading "Delete Pages" [level=3] [ref=e158]
                - paragraph [ref=e159]: Drop extras, blanks, or outdated sections without re-exporting.
                - img [ref=e161]
      - generic [ref=e166]:
        - heading "Edit and manage PDF documents with ease" [level=2] [ref=e167]
        - link "Create your free vault" [ref=e168] [cursor=pointer]:
          - /url: /sign-up
          - text: Create your free vault
          - img [ref=e169]
    - contentinfo [ref=e171]:
      - generic [ref=e172]:
        - generic [ref=e173]:
          - generic [ref=e174]:
            - img "PDFVault" [ref=e175]
            - paragraph [ref=e176]: A smarter, more secure place for your PDFs.
            - link "support@pdfvault.ai" [ref=e178] [cursor=pointer]:
              - /url: mailto:support@pdfvault.ai
              - img [ref=e179]
              - text: support@pdfvault.ai
          - navigation "TOOLS" [ref=e181]:
            - heading "TOOLS" [level=2] [ref=e182]
            - list [ref=e183]:
              - listitem [ref=e184]:
                - link "Edit & SIgn" [ref=e185] [cursor=pointer]:
                  - /url: /pdf-composer
              - listitem [ref=e186]:
                - link "Compress" [ref=e187] [cursor=pointer]:
                  - /url: /pdf-composer?tool=compress
              - listitem [ref=e188]:
                - link "Convert" [ref=e189] [cursor=pointer]:
                  - /url: /convert/pdf-to-word
          - navigation "COMPANY" [ref=e190]:
            - heading "COMPANY" [level=2] [ref=e191]
            - list [ref=e192]:
              - listitem [ref=e193]:
                - link "Contact Us" [ref=e194] [cursor=pointer]:
                  - /url: /contact
          - navigation "LEGAL" [ref=e195]:
            - heading "LEGAL" [level=2] [ref=e196]
            - list [ref=e197]:
              - listitem [ref=e198]:
                - link "Privacy" [ref=e199] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e200]:
                - link "Terms & Condition" [ref=e201] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e202]:
                - link "Refund Policy" [ref=e203] [cursor=pointer]:
                  - /url: /refund
              - listitem [ref=e204]:
                - link "Cookies" [ref=e205] [cursor=pointer]:
                  - /url: /cookies
              - listitem [ref=e206]:
                - link "Do Not Sell" [ref=e207] [cursor=pointer]:
                  - /url: /do-not-sell
          - navigation "ACCOUNT" [ref=e208]:
            - heading "ACCOUNT" [level=2] [ref=e209]
            - list [ref=e210]:
              - listitem [ref=e211]:
                - link "Login" [ref=e212] [cursor=pointer]:
                  - /url: /sign-in
              - listitem [ref=e213]:
                - link "Register" [ref=e214] [cursor=pointer]:
                  - /url: /sign-up
        - paragraph [ref=e217]: © 2026, PDFVault All rights reserved.
  - alert [ref=e218]
```

# Test source

```ts
  197 |       await opener();
  198 |       await expect(
  199 |         page.getByRole("heading", { name: headingPattern }).first(),
  200 |       ).toBeVisible({ timeout: 6_000 });
  201 |       await page.keyboard.press("Escape");
  202 |       await page.waitForTimeout(200);
  203 | 
  204 |       expect(errors).toEqual([]);
  205 |     }
  206 | 
  207 |     test("Create New opens CreatePdfModal", async ({ page }) => {
  208 |       await assertOpensWithoutErrors(page, /create.*pdf/i, async () => {
  209 |         await page.getByRole("button", { name: "Editor menu" }).click();
  210 |         await page.getByRole("menuitem", { name: /create new/i }).click();
  211 |       });
  212 |     });
  213 | 
  214 |     test("Find and Replace opens FindReplaceModal", async ({ page }) => {
  215 |       await assertOpensWithoutErrors(page, /find.*replace/i, async () => {
  216 |         await page.getByRole("button", { name: "Editor menu" }).click();
  217 |         await page.getByRole("menuitem", { name: /find and replace/i }).click();
  218 |       });
  219 |     });
  220 | 
  221 |     test("Compress toolbar button opens CompressModal", async ({ page }) => {
  222 |       await assertOpensWithoutErrors(page, /compress pdf/i, async () => {
  223 |         await page.getByRole("button", { name: /^compress$/i }).first().click();
  224 |       });
  225 |     });
  226 | 
  227 |     test("Secure toolbar button opens PasswordModal", async ({ page }) => {
  228 |       await assertOpensWithoutErrors(page, /password protect/i, async () => {
  229 |         await page.getByRole("button", { name: /^secure$/i }).first().click();
  230 |       });
  231 |     });
  232 | 
  233 |     test("Page No toolbar button opens PageNumbersModal", async ({ page }) => {
  234 |       await assertOpensWithoutErrors(page, /add page numbers/i, async () => {
  235 |         await page.getByRole("button", { name: /^page no$/i }).first().click();
  236 |       });
  237 |     });
  238 | 
  239 |     test("Annotate toolbar button opens AnnotationsModal", async ({ page }) => {
  240 |       await assertOpensWithoutErrors(page, /annotations/i, async () => {
  241 |         await page.getByRole("button", { name: /^annotate$/i }).first().click();
  242 |       });
  243 |     });
  244 | 
  245 |     test("Split toolbar button still opens SplitPdfModal", async ({ page }) => {
  246 |       await assertOpensWithoutErrors(page, /split pdf/i, async () => {
  247 |         await page.getByRole("button", { name: /^split$/i }).first().click();
  248 |       });
  249 |     });
  250 |   });
  251 | 
  252 |   test.describe("Keyboard shortcuts", () => {
  253 |     test("Cmd+F opens Find & Replace", async ({ page }) => {
  254 |       await page.keyboard.press("ControlOrMeta+f");
  255 | 
  256 |       await expect(
  257 |         page.getByRole("heading", { name: /find.*replace/i }).first(),
  258 |       ).toBeVisible({ timeout: 4_000 });
  259 | 
  260 |       await page.keyboard.press("Escape");
  261 |     });
  262 | 
  263 |     test("Cmd+Z / Cmd+Y don't crash", async ({ page }) => {
  264 |       const errors: string[] = [];
  265 | 
  266 |       page.on("pageerror", (e) => errors.push(e.message));
  267 | 
  268 |       await page.keyboard.press("ControlOrMeta+z");
  269 |       await page.keyboard.press("ControlOrMeta+Shift+z");
  270 |       await page.keyboard.press("ControlOrMeta+y");
  271 |       await page.waitForTimeout(200);
  272 | 
  273 |       expect(errors).toEqual([]);
  274 |     });
  275 |   });
  276 | 
  277 |   test.describe("Save / persistence smoke", () => {
  278 |     test("beforeunload prompt fires on unsaved changes", async ({ page }) => {
  279 |       // Drive the editor into a dirty state without relying on user gestures.
  280 |       await page.evaluate(() => {
  281 |         window.__PDF_EDITOR_TEST__?.getStore().markDocumentDirty();
  282 |       });
  283 | 
  284 |       let dialogType: string | null = null;
  285 | 
  286 |       page.once("dialog", async (dialog) => {
  287 |         dialogType = dialog.type();
  288 |         await dialog.dismiss();
  289 |       });
  290 | 
  291 |       // Navigation is intentionally aborted by the beforeunload prompt; the
  292 |       // dialog is what we care about, so swallow the navigation error.
  293 |       await page.goto("/").catch(() => undefined);
  294 | 
  295 |       // Give the event handler a moment to fire.
  296 |       await page.waitForTimeout(500);
> 297 |       expect(dialogType).toBe("beforeunload");
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  298 |     });
  299 |   });
  300 | });
  301 | 
```