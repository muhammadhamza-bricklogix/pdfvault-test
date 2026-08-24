# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/ui-inventory.spec.ts >> PDF editor — UI inventory >> Keyboard shortcuts >> Cmd+F opens Find & Replace
- Location: tests/pdf-editor/ui-inventory.spec.ts:253:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /find.*replace/i }).first()
Expected: visible
Timeout: 4000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 4000ms
  - waiting for getByRole('heading', { name: /find.*replace/i }).first()

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
  158 | 
  159 |       await expect(
  160 |         page.getByRole("heading", { name: "Type" }).first(),
  161 |       ).toBeVisible({ timeout: 3_000 });
  162 |       await expect(
  163 |         page.getByRole("textbox", { name: "Watermark text" }),
  164 |       ).toBeVisible();
  165 |       await expect(page.getByRole("heading", { name: "Opacity" }).first()).toBeVisible();
  166 |       await expect(page.getByRole("heading", { name: "Position" }).first()).toBeVisible();
  167 |     });
  168 | 
  169 |     test("Background tool shows background image config", async ({ page }) => {
  170 |       await page.getByRole("button", { name: /^background$/i }).first().click();
  171 | 
  172 |       await expect(
  173 |         page.getByRole("heading", { name: "Image" }).first(),
  174 |       ).toBeVisible({ timeout: 3_000 });
  175 |       await expect(
  176 |         page.getByRole("button", { name: /upload image/i }).first(),
  177 |       ).toBeVisible();
  178 |       await expect(page.getByRole("heading", { name: "Fit" }).first()).toBeVisible();
  179 |       await expect(page.getByRole("heading", { name: "Opacity" }).first()).toBeVisible();
  180 |       await expect(page.getByRole("heading", { name: "Pages" }).first()).toBeVisible();
  181 |     });
  182 |   });
  183 | 
  184 |   test.describe("Modals reachable from hamburger/toolbar", () => {
  185 |     async function assertOpensWithoutErrors(
  186 |       page: import("@playwright/test").Page,
  187 |       headingPattern: RegExp,
  188 |       opener: () => Promise<void>,
  189 |     ) {
  190 |       const errors: string[] = [];
  191 | 
  192 |       page.on("pageerror", (e) => {
  193 |         if (e.message === "Transition was skipped") return;
  194 |         errors.push(e.message);
  195 |       });
  196 | 
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
> 258 |       ).toBeVisible({ timeout: 4_000 });
      |         ^ Error: expect(locator).toBeVisible() failed
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
  297 |       expect(dialogType).toBe("beforeunload");
  298 |     });
  299 |   });
  300 | });
  301 | 
```