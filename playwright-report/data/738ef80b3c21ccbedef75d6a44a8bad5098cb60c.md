# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-editor/offline.spec.ts >> Offline — banner + IDB schema >> OfflineBanner appears when the context goes offline
- Location: tests/pdf-editor/offline.spec.ts:22:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

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
              - img [ref=e11]
              - text: All Tools
              - img [ref=e13]
            - link "Edit" [ref=e15] [cursor=pointer]:
              - /url: /pdf-composer
            - link "Convert" [ref=e16] [cursor=pointer]:
              - /url: /convert/pdf-to-word
            - link "Compress" [ref=e17] [cursor=pointer]:
              - /url: /pdf-composer?fresh=1&tool=compress
            - button "Forms" [ref=e18]
        - button "Select language" [disabled] [ref=e22]:
          - img [ref=e23]
          - text: EN
          - img [ref=e26]
    - main [ref=e28]:
      - region "Edit, sign, or convert any PDF in seconds" [ref=e29]:
        - generic [ref=e30]:
          - heading "Edit, sign, or convert any PDF in seconds" [level=1] [ref=e31]
          - paragraph [ref=e32]: Sign, edit, protect and much more. Keep important documents in one secure workspace without losing track of files that matter.
        - generic [ref=e34]:
          - button "Upload a file. Drop a file here, or activate to browse." [ref=e36] [cursor=pointer]:
            - img
            - button "Choose File" [ref=e37]
            - generic [ref=e38]:
              - heading "Drag & drop file to edit" [level=2] [ref=e39]
              - generic [ref=e42]: OR
              - button "Upload to Edit" [ref=e44]
              - paragraph [ref=e45]: Size upto 100 MB
            - paragraph [ref=e46]
          - link "Trustpilot" [ref=e50] [cursor=pointer]:
            - /url: https://www.trustpilot.com/review/pdfvault.ai
          - paragraph [ref=e51]:
            - text: By uploading a file, you agree to our
            - link "Terms and Conditions" [ref=e52] [cursor=pointer]:
              - /url: /terms-and-conditions
            - text: and acknowledge our
            - link "Privacy Policy" [ref=e53] [cursor=pointer]:
              - /url: /privacy
            - text: .
      - region "Get started in three simple steps" [ref=e54]:
        - generic [ref=e55]:
          - generic [ref=e56]:
            - heading "Get started in three simple steps" [level=2] [ref=e57]
            - paragraph [ref=e58]: From upload to a securely saved document, PDFVault makes it easy to handle every PDF in one place.
          - list [ref=e59]:
            - listitem [ref=e60]:
              - heading "Bring in your document" [level=3] [ref=e61]
              - paragraph [ref=e62]: Upload from your device.
            - listitem [ref=e63]:
              - heading "Make it yours" [level=3] [ref=e64]
              - paragraph [ref=e65]: Edit, convert, compress, protect, organize, or sign your document with the tools you need.
            - listitem [ref=e66]:
              - heading "Save it to your vault" [level=3] [ref=e67]
              - paragraph [ref=e68]: Keep the latest version in your personal document library, ready whenever you need it again.
      - region "Every tool you need to work with PDFs in one place" [ref=e69]:
        - generic [ref=e70]:
          - generic [ref=e71]:
            - heading "Every tool you need to work with PDFs in one place" [level=2] [ref=e72]:
              - generic [ref=e73]:
                - text: Every tool you need to work
                - text: with PDFs in one place
            - paragraph [ref=e74]: Every tool you need to use PDFs, at your fingertips. Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks.
          - tablist "Tool categories" [ref=e76]:
            - tab "PDF Composer" [selected] [ref=e77] [cursor=pointer]
            - tab "Convert to PDF" [ref=e78] [cursor=pointer]
            - tab "Compress PDF" [ref=e79] [cursor=pointer]
            - tab "Convert from PDF" [ref=e80] [cursor=pointer]
            - tab "Others" [ref=e81] [cursor=pointer]
          - list [ref=e82]:
            - listitem [ref=e83]:
              - link "Edit Revise text and objects inline with our full in-browser PDF composer." [ref=e84] [cursor=pointer]:
                - /url: /pdf-composer?fresh=1
                - heading "Edit" [level=3] [ref=e86]
                - paragraph [ref=e87]: Revise text and objects inline with our full in-browser PDF composer.
                - img [ref=e89]
            - listitem [ref=e91]:
              - link "Sign Add your signature with vector strokes." [ref=e92] [cursor=pointer]:
                - /url: /pdf-composer?fresh=1&tool=watermark
                - heading "Sign" [level=3] [ref=e94]
                - paragraph [ref=e95]: Add your signature with vector strokes.
                - img [ref=e97]
            - listitem [ref=e99]:
              - link "Organize Pages Reorder, insert, and rotate thumbnails until the flow is right." [ref=e100] [cursor=pointer]:
                - /url: /pdf-composer?fresh=1&tool=manage
                - heading "Organize Pages" [level=3] [ref=e102]
                - paragraph [ref=e103]: Reorder, insert, and rotate thumbnails until the flow is right.
                - img [ref=e105]
            - listitem [ref=e107]:
              - link "Split & Extract Pages Pull out the pages you need or split a long file into lighter ones." [ref=e108] [cursor=pointer]:
                - /url: /pdf-composer?fresh=1&tool=split
                - heading "Split & Extract Pages" [level=3] [ref=e110]
                - paragraph [ref=e111]: Pull out the pages you need or split a long file into lighter ones.
                - img [ref=e113]
            - listitem [ref=e115]:
              - link "Password Protect Lock your PDF with a password so only intended readers get in." [ref=e116] [cursor=pointer]:
                - /url: /pdf-composer?fresh=1&tool=password
                - heading "Password Protect" [level=3] [ref=e118]
                - paragraph [ref=e119]: Lock your PDF with a password so only intended readers get in.
                - img [ref=e121]
            - listitem [ref=e123]:
              - link "Unlock PDF Remove encryption when you have the right credentials." [ref=e124] [cursor=pointer]:
                - /url: /pdf-composer?fresh=1&tool=unlock
                - heading "Unlock PDF" [level=3] [ref=e126]
                - paragraph [ref=e127]: Remove encryption when you have the right credentials.
                - img [ref=e129]
            - listitem [ref=e131]:
              - link "Rotate Pages Fix upside-down scans or mixed-orientation bundles in seconds." [ref=e132] [cursor=pointer]:
                - /url: /pdf-composer?fresh=1&tool=manage
                - heading "Rotate Pages" [level=3] [ref=e134]
                - paragraph [ref=e135]: Fix upside-down scans or mixed-orientation bundles in seconds.
                - img [ref=e137]
            - listitem [ref=e139]:
              - link "Delete Pages Drop extras, blanks, or outdated sections without re-exporting." [ref=e140] [cursor=pointer]:
                - /url: /pdf-composer?fresh=1&tool=manage
                - heading "Delete Pages" [level=3] [ref=e142]
                - paragraph [ref=e143]: Drop extras, blanks, or outdated sections without re-exporting.
                - img [ref=e145]
      - generic [ref=e150]:
        - heading "Edit and manage PDF documents with ease" [level=2] [ref=e151]
        - link "Create your free vault" [ref=e152] [cursor=pointer]:
          - /url: /sign-up
          - text: Create your free vault
          - img [ref=e153]
      - region "See what people are saying about PDFVault." [ref=e155]:
        - generic [ref=e156]:
          - heading "See what people are saying about PDFVault." [level=2] [ref=e158]
          - link "Trustpilot" [ref=e161] [cursor=pointer]:
            - /url: https://www.trustpilot.com/review/pdfvault.ai
      - region "Frequently Asked Questions" [ref=e162]:
        - generic [ref=e163]:
          - heading "Frequently Asked Questions" [level=2] [ref=e165]
          - tablist "FAQ categories" [ref=e166]:
            - tab "Getting Started" [selected] [ref=e167]
            - tab "Pricing & Billing" [ref=e168]
            - tab "Cancellations & Refunds" [ref=e169]
            - tab "Privacy & Security" [ref=e170]
            - tab "Tools & Features" [ref=e171]
          - tabpanel "Getting Started" [ref=e172]:
            - list [ref=e173]:
              - listitem [ref=e174]:
                - button "What is PDFVault?" [ref=e175]:
                  - generic [ref=e176]: What is PDFVault?
                  - img [ref=e178]
                - region "What is PDFVault?":
                  - generic: PDFVault is an all-in-one website for everyday document work — converting, editing, signing, compressing, merging, splitting, and more. Core tools are free to use, with no account required.
              - listitem [ref=e180]:
                - button "Do I need an account to use PDFVault?" [ref=e181]:
                  - generic [ref=e182]: Do I need an account to use PDFVault?
                  - img [ref=e184]
                - region "Do I need an account to use PDFVault?":
                  - generic: No. Core tools are available without an account. Creating an account lets you save files to your vault and access premium features like downloading edited or converted files.
              - listitem [ref=e186]:
                - button "What file types does PDFVault support?" [ref=e187]:
                  - generic [ref=e188]: What file types does PDFVault support?
                  - img [ref=e190]
                - region "What file types does PDFVault support?":
                  - generic: PDFVault works with PDF files as well as common formats like Word, Excel, PowerPoint, and images (JPG, PNG), which can be converted to and from PDF.
          - generic [ref=e192]:
            - heading "Still have questions?" [level=3] [ref=e193]
            - paragraph [ref=e194]:
              - text: Reach out any time at
              - link "support@pdfvault.ai" [ref=e195] [cursor=pointer]:
                - /url: mailto:support@pdfvault.ai
              - text: or visit our
              - link "Contact Us" [ref=e196] [cursor=pointer]:
                - /url: /contact
              - text: page.
    - contentinfo [ref=e197]:
      - generic [ref=e198]:
        - generic [ref=e199]:
          - generic [ref=e200]:
            - img "PDFVault" [ref=e201]
            - paragraph [ref=e202]: A smarter, more secure place for your PDFs.
            - link "support@pdfvault.ai" [ref=e204] [cursor=pointer]:
              - /url: mailto:support@pdfvault.ai
              - img [ref=e205]
              - text: support@pdfvault.ai
          - navigation "TOOLS" [ref=e207]:
            - heading "TOOLS" [level=2] [ref=e208]
            - list [ref=e209]:
              - listitem [ref=e210]:
                - link "Edit & SIgn" [ref=e211] [cursor=pointer]:
                  - /url: /pdf-composer
              - listitem [ref=e212]:
                - link "Compress" [ref=e213] [cursor=pointer]:
                  - /url: /pdf-composer?fresh=1&tool=compress
              - listitem [ref=e214]:
                - link "Convert" [ref=e215] [cursor=pointer]:
                  - /url: /convert/pdf-to-word
          - navigation "COMPANY" [ref=e216]:
            - heading "COMPANY" [level=2] [ref=e217]
            - list [ref=e218]:
              - listitem [ref=e219]:
                - link "About Us" [ref=e220] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e221]:
                - link "Contact Us" [ref=e222] [cursor=pointer]:
                  - /url: /contact
          - navigation "LEGAL" [ref=e223]:
            - heading "LEGAL" [level=2] [ref=e224]
            - list [ref=e225]:
              - listitem [ref=e226]:
                - link "Privacy Policy" [ref=e227] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e228]:
                - link "Terms & Conditions" [ref=e229] [cursor=pointer]:
                  - /url: /terms-and-conditions
              - listitem [ref=e230]:
                - link "Subscription Terms" [ref=e231] [cursor=pointer]:
                  - /url: /subscription-terms
              - listitem [ref=e232]:
                - link "Refund Policy" [ref=e233] [cursor=pointer]:
                  - /url: /refund
              - listitem [ref=e234]:
                - link "Cookie Policy" [ref=e235] [cursor=pointer]:
                  - /url: /cookies
              - listitem [ref=e236]:
                - link "Do Not Sell" [ref=e237] [cursor=pointer]:
                  - /url: /do-not-sell
          - navigation "ACCOUNT" [ref=e238]:
            - heading "ACCOUNT" [level=2] [ref=e239]
            - list [ref=e240]:
              - listitem [ref=e241]:
                - link "Login" [ref=e242] [cursor=pointer]:
                  - /url: /sign-in
              - listitem [ref=e243]:
                - link "Register" [ref=e244] [cursor=pointer]:
                  - /url: /sign-up
        - generic [ref=e246]:
          - paragraph [ref=e247]: © 2026, PDFVault All rights reserved.
          - paragraph [ref=e248]: FLUTTWINGS INVESTMENTS LIMITED, Nicosia, Cyprus
  - button "Open Next.js Dev Tools" [ref=e254] [cursor=pointer]:
    - generic [ref=e257]:
      - text: Compiling
      - generic [ref=e258]:
        - generic [ref=e259]: .
        - generic [ref=e260]: .
        - generic [ref=e261]: .
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | /**
  4   |  * Coverage for the IndexedDB offline-viewing cache.
  5   |  *
  6   |  * Two surfaces:
  7   |  *   - `OfflineBanner` mounted at the root of every route via providers.
  8   |  *   - The per-user IDB schema (documents + pdfBytes + meta stores).
  9   |  *
  10  |  * The dashboard / editor cache-read paths require an authenticated
  11  |  * Clerk session, so they're documented in the QA test plan for manual
  12  |  * runs. These specs verify the parts we CAN drive without a real
  13  |  * user-id, which is most of the safety net.
  14  |  */
  15  | test.describe("Offline — banner + IDB schema", () => {
  16  |   test("OfflineBanner is absent while online", async ({ page }) => {
  17  |     await page.goto("/");
  18  |     // role="status" matches the banner's accessibility node.
  19  |     await expect(page.locator('[role="status"]').first()).toHaveCount(0);
  20  |   });
  21  | 
  22  |   test("OfflineBanner appears when the context goes offline", async ({
  23  |     page,
  24  |     context,
  25  |   }) => {
> 26  |     await page.goto("/");
      |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  27  |     await context.setOffline(true);
  28  | 
  29  |     // The hook uses useSyncExternalStore against window 'offline' events,
  30  |     // so the banner appears on the next tick.
  31  |     await expect(page.locator('[role="status"]').first()).toBeVisible({
  32  |       timeout: 3_000,
  33  |     });
  34  |     await expect(page.locator('[role="status"]').first()).toContainText(
  35  |       /viewing cached documents only/i,
  36  |     );
  37  |     await context.setOffline(false);
  38  |   });
  39  | 
  40  |   test("Banner mounts on auth routes too (proves global mount)", async ({
  41  |     page,
  42  |     context,
  43  |   }) => {
  44  |     await page.goto("/sign-in");
  45  |     await context.setOffline(true);
  46  |     await expect(page.locator('[role="status"]').first()).toBeVisible({
  47  |       timeout: 3_000,
  48  |     });
  49  |     await context.setOffline(false);
  50  |   });
  51  | 
  52  |   test("IDB schema works in this Chrome (open + put + get)", async ({
  53  |     page,
  54  |   }) => {
  55  |     await page.goto("/");
  56  | 
  57  |     const result = await page.evaluate(async () => {
  58  |       const dbName = "pdfedits-offline-e2e-test";
  59  |       const drop = (name: string) =>
  60  |         new Promise<void>((resolve) => {
  61  |           const r = indexedDB.deleteDatabase(name);
  62  | 
  63  |           r.onsuccess = r.onerror = r.onblocked = () => resolve();
  64  |         });
  65  | 
  66  |       await drop(dbName);
  67  | 
  68  |       const db = await new Promise<IDBDatabase>((resolve, reject) => {
  69  |         const r = indexedDB.open(dbName, 1);
  70  | 
  71  |         r.onupgradeneeded = () => {
  72  |           const d = r.result;
  73  | 
  74  |           d.createObjectStore("documents", { keyPath: "id" });
  75  |           d.createObjectStore("pdfBytes", { keyPath: "id" });
  76  |           d.createObjectStore("meta", { keyPath: "key" });
  77  |         };
  78  |         r.onsuccess = () => resolve(r.result);
  79  |         r.onerror = () => reject(r.error);
  80  |       });
  81  | 
  82  |       // put + get round-trip.
  83  |       await new Promise<void>((resolve, reject) => {
  84  |         const tx = db.transaction(
  85  |           ["documents", "pdfBytes"],
  86  |           "readwrite",
  87  |         );
  88  | 
  89  |         tx.objectStore("documents").put({
  90  |           id: "doc-A",
  91  |           filename: "alpha.pdf",
  92  |           cachedAt: 1,
  93  |         });
  94  |         const blob = new Blob(["%PDF-1.4 fake"], {
  95  |           type: "application/pdf",
  96  |         });
  97  | 
  98  |         tx.objectStore("pdfBytes").put({
  99  |           id: "doc-A",
  100 |           blob,
  101 |           filename: "alpha.pdf",
  102 |           contentType: "application/pdf",
  103 |           cachedAt: 1,
  104 |           bytes: blob.size,
  105 |         });
  106 |         tx.oncomplete = () => resolve();
  107 |         tx.onerror = () => reject(tx.error);
  108 |       });
  109 | 
  110 |       const restored = await new Promise<unknown>((resolve, reject) => {
  111 |         const tx = db.transaction("documents", "readonly");
  112 |         const req = tx.objectStore("documents").get("doc-A");
  113 | 
  114 |         tx.oncomplete = () => resolve(req.result);
  115 |         tx.onerror = () => reject(tx.error);
  116 |       });
  117 | 
  118 |       db.close();
  119 |       await drop(dbName);
  120 | 
  121 |       return restored as { id: string; filename: string };
  122 |     });
  123 | 
  124 |     expect(result.id).toBe("doc-A");
  125 |     expect(result.filename).toBe("alpha.pdf");
  126 |   });
```