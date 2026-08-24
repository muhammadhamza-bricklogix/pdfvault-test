# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/edge-cases.spec.ts >> PDF editor — edge cases >> ?id= with empty value redirects out of the editor
- Location: tests/pdf-editor/edge-cases.spec.ts:14:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/pdf-editor?id=", waiting until "load"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e3]:
    - generic [ref=e5]:
      - generic [ref=e7]:
        - link "PDFVault home" [ref=e8] [cursor=pointer]:
          - /url: /
          - img "PDFVault" [ref=e9]
        - button "Select language" [disabled] [ref=e11]:
          - img [ref=e12]
          - text: EN
          - img [ref=e15]
      - main [ref=e17]:
        - region "Good to see you back!" [ref=e18]:
          - heading "Good to see you back!" [level=1] [ref=e19]
          - paragraph [ref=e20]: Please enter your details below to log in.
          - button "Continue with Google" [ref=e22] [cursor=pointer]:
            - img [ref=e23]
            - text: Continue with Google
          - generic [ref=e30]: OR
          - generic [ref=e32]:
            - generic [ref=e33]: Email*
            - textbox "Email" [ref=e34]:
              - /placeholder: Enter Your Email
            - generic [ref=e35]: Password*
            - generic [ref=e36]:
              - textbox "Password" [ref=e37]:
                - /placeholder: Enter Your Password
              - button "Show password" [ref=e38]:
                - img [ref=e39]
            - generic [ref=e42]:
              - generic [ref=e43] [cursor=pointer]:
                - checkbox "Remember me" [checked] [ref=e44]
                - text: Remember me
              - link "Forgot password?" [ref=e45] [cursor=pointer]:
                - /url: /forgot-password
            - button "Log in" [ref=e46] [cursor=pointer]
          - paragraph [ref=e47]
          - paragraph [ref=e48]:
            - text: Do not have an account yet?
            - link "Sign up" [ref=e49] [cursor=pointer]:
              - /url: /sign-up
      - generic [ref=e52]:
        - generic [ref=e53]:
          - generic [ref=e54]:
            - img "PDFVault" [ref=e55]
            - paragraph [ref=e56]: A smarter, more secure place for your PDFs.
            - link "support@pdfvault.ai" [ref=e58] [cursor=pointer]:
              - /url: mailto:support@pdfvault.ai
              - img [ref=e59]
              - text: support@pdfvault.ai
          - navigation "TOOLS" [ref=e61]:
            - heading "TOOLS" [level=2] [ref=e62]
            - list [ref=e63]:
              - listitem [ref=e64]:
                - link "Edit & SIgn" [ref=e65] [cursor=pointer]:
                  - /url: /pdf-composer
              - listitem [ref=e66]:
                - link "Compress" [ref=e67] [cursor=pointer]:
                  - /url: /pdf-composer?fresh=1&tool=compress
              - listitem [ref=e68]:
                - link "Convert" [ref=e69] [cursor=pointer]:
                  - /url: /convert/pdf-to-word
          - navigation "COMPANY" [ref=e70]:
            - heading "COMPANY" [level=2] [ref=e71]
            - list [ref=e72]:
              - listitem [ref=e73]:
                - link "About Us" [ref=e74] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e75]:
                - link "Contact Us" [ref=e76] [cursor=pointer]:
                  - /url: /contact
          - navigation "LEGAL" [ref=e77]:
            - heading "LEGAL" [level=2] [ref=e78]
            - list [ref=e79]:
              - listitem [ref=e80]:
                - link "Privacy Policy" [ref=e81] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e82]:
                - link "Terms & Conditions" [ref=e83] [cursor=pointer]:
                  - /url: /terms-and-conditions
              - listitem [ref=e84]:
                - link "Subscription Terms" [ref=e85] [cursor=pointer]:
                  - /url: /subscription-terms
              - listitem [ref=e86]:
                - link "Refund Policy" [ref=e87] [cursor=pointer]:
                  - /url: /refund
              - listitem [ref=e88]:
                - link "Cookie Policy" [ref=e89] [cursor=pointer]:
                  - /url: /cookies
              - listitem [ref=e90]:
                - link "Do Not Sell" [ref=e91] [cursor=pointer]:
                  - /url: /do-not-sell
          - navigation "ACCOUNT" [ref=e92]:
            - heading "ACCOUNT" [level=2] [ref=e93]
            - list [ref=e94]:
              - listitem [ref=e95]:
                - link "Login" [ref=e96] [cursor=pointer]:
                  - /url: /sign-in
              - listitem [ref=e97]:
                - link "Register" [ref=e98] [cursor=pointer]:
                  - /url: /sign-up
        - generic [ref=e100]:
          - paragraph [ref=e101]: © 2026, PDFVault All rights reserved.
          - paragraph [ref=e102]: FLUTTWINGS INVESTMENTS LIMITED, Nicosia, Cyprus
  - button "Open Next.js Dev Tools" [ref=e108] [cursor=pointer]:
    - img [ref=e109]
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | import { FIXTURES, openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";
  4   | 
  5   | /**
  6   |  * Cross-feature edge cases that don't fit cleanly into one tool spec.
  7   |  *
  8   |  * - Keyboard delete / undo / redo
  9   |  * - Unsaved-changes warning
  10  |  * - File-size + MIME validation on upload
  11  |  * - Anonymous /pdf-editor?id=... gating
  12  |  */
  13  | test.describe("PDF editor — edge cases", () => {
  14  |   test("?id= with empty value redirects out of the editor", async ({
  15  |     page,
  16  |   }) => {
> 17  |     await page.goto("/pdf-editor?id=");
      |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  18  |     // proxy.ts: empty id → signed-out user gets sign-in, signed-in
  19  |     // user gets dashboard. Either way: not the editor.
  20  |     await expect
  21  |       .poll(() => page.url(), { timeout: 6_000 })
  22  |       .toMatch(/\/(sign-in|dashboard)/);
  23  |   });
  24  | 
  25  |   test("?id= with a bogus value redirects to sign-in (signed-out)", async ({
  26  |     page,
  27  |   }) => {
  28  |     await page.goto("/pdf-editor?id=not-a-real-doc");
  29  | 
  30  |     await expect
  31  |       .poll(() => page.url(), { timeout: 6_000 })
  32  |       .toMatch(/\/sign-in/);
  33  |     // `/pdf-editor` is a redirect alias for the canonical `/pdf-composer`
  34  |     // route (see app/(tools)/pdf-editor/page.tsx). Middleware sees the
  35  |     // rewritten URL and preserves it in `redirect_url`.
  36  |     expect(decodeURIComponent(page.url())).toMatch(
  37  |       /redirect_url=\/(pdf-editor|pdf-composer)/,
  38  |     );
  39  |   });
  40  | 
  41  |   test("Local-mode editor opens without an id", async ({ page }) => {
  42  |     await page.goto("/pdf-editor");
  43  | 
  44  |     // No sign-in redirect — bare editor URL is intentionally public.
  45  |     // `/pdf-editor` server-redirects to the canonical `/pdf-composer`.
  46  |     await expect(page).toHaveURL(/\/(pdf-editor|pdf-composer)/);
  47  |   });
  48  | 
  49  |   test("Keyboard: Escape and Delete don't crash on empty editor", async ({
  50  |     page,
  51  |   }) => {
  52  |     const errors: string[] = [];
  53  | 
  54  |     page.on("pageerror", (e) => errors.push(e.message));
  55  | 
  56  |     await page.goto("/pdf-editor");
  57  |     await page.waitForLoadState("domcontentloaded");
  58  | 
  59  |     await page.keyboard.press("Escape");
  60  |     await page.keyboard.press("Delete");
  61  |     await page.keyboard.press("Backspace");
  62  |     await page.waitForTimeout(200);
  63  | 
  64  |     expect(errors).toEqual([]);
  65  |   });
  66  | 
  67  |   test("Cmd+Z / Cmd+Shift+Z don't crash on empty editor", async ({ page }) => {
  68  |     const errors: string[] = [];
  69  | 
  70  |     page.on("pageerror", (e) => errors.push(e.message));
  71  | 
  72  |     await page.goto("/pdf-editor");
  73  |     await page.waitForLoadState("domcontentloaded");
  74  | 
  75  |     await page.keyboard.press("ControlOrMeta+z");
  76  |     await page.keyboard.press("ControlOrMeta+Shift+z");
  77  |     await page.keyboard.press("ControlOrMeta+y");
  78  |     await page.waitForTimeout(200);
  79  | 
  80  |     expect(errors).toEqual([]);
  81  |   });
  82  | 
  83  |   test("Cmd+F opens Find & Replace once a PDF is loaded", async ({ page }) => {
  84  |     await openSamplePdfInEditor(page);
  85  |     await waitForPdfReady(page);
  86  | 
  87  |     await page.keyboard.press("ControlOrMeta+f");
  88  | 
  89  |     await expect(
  90  |       page.getByRole("heading", { name: /find/i }).first(),
  91  |     ).toBeVisible({ timeout: 4_000 });
  92  | 
  93  |     await page.keyboard.press("Escape");
  94  |   });
  95  | 
  96  |   test("Uploading non-PDF + non-supported file is rejected", async ({
  97  |     page,
  98  |   }) => {
  99  |     await page.goto("/pdf-editor");
  100 | 
  101 |     // We expect either: a toast saying "unsupported", OR the conversion
  102 |     // pipeline to handle it gracefully. Neither path should crash.
  103 |     const errors: string[] = [];
  104 | 
  105 |     page.on("pageerror", (e) => errors.push(e.message));
  106 | 
  107 |     // Use a non-PDF / non-supported MIME by writing a temp file with
  108 |     // garbage extension. Playwright's setInputFiles can accept inline
  109 |     // buffers.
  110 |     await page.locator('input[type="file"]').first().setInputFiles({
  111 |       name: "garbage.bin",
  112 |       mimeType: "application/octet-stream",
  113 |       buffer: Buffer.from([0x00, 0x01, 0x02, 0x03]),
  114 |     });
  115 | 
  116 |     await page.waitForTimeout(1_500);
  117 | 
```