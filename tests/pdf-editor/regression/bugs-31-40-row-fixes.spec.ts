import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Covers the code-change rows from docs/fixes/PDF Composer.xlsx (31-40).
 *
 * Row 31/37 (password detection): fix is in `verify-pdf-password.ts`.
 *   Verified via a Node-level pdf.js probe that owner-password-only PDFs
 *   open without a user password AND `getPermissions()` returns a non-null
 *   bitfield — the signal `verifyPdfPassword` now uses to recognize
 *   owner-only encryption instead of falsely reporting "not-encrypted".
 *   The Remove-Password flow itself is signin-gated so can't be driven
 *   from an unauthenticated Playwright spec without extra fixture work.
 *
 * Row 32/33/36: already addressed by the 2026-09-10 (a) bake-before-tool
 *   fix (`use-flatten-editor.ts` + `CompressModal.handleCompress` dispatch
 *   `editor:build-current-bytes` with `bakeOverlays: true`). No code
 *   change needed in this branch.
 *
 * Row 34/35/39: covered by existing invariants (clearFile on id-switch,
 *   quiet getTextContent-failure toast + failedPagesRef, pdf.js
 *   PasswordException branch in `usePdfLoader`).
 *
 * Row 38 (cancel unlock modal): fix is in `PasswordModal.handleClose`.
 *   Exercised end-to-end here — upload user-password PDF, cancel the
 *   unlock-only modal, confirm the shell clears the file and redirects
 *   away.
 *
 * Row 40 (share-link + PDF password): fix is in `ViewerClient.tsx`.
 *   Exercised at the component level — the viewer catches the
 *   PasswordException on bytes-decode and surfaces a `pdf-password` UI
 *   state so the recipient can supply the PDF's own password.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES = {
  userPwd: path.join(
    __dirname,
    "..",
    "..",
    "fixtures",
    "sample-pwd-test123.pdf",
  ),
};

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("PDF Composer sheet — row 38 (cancel unlock modal)", () => {
  test("cancelling PasswordModal unlock-only clears file and routes away", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(FIXTURES.userPwd);

    // pdf.js throws PasswordException → shell auto-opens PasswordModal
    // in unlock-only variant.
    const modalHeading = page
      .getByRole("heading", { name: /Unlock PDF/i })
      .first();

    await expect(modalHeading).toBeVisible({ timeout: 15_000 });

    // Cancel without entering a password.
    await page.getByRole("button", { name: /^Cancel$/i }).first().click();

    await expect(modalHeading).toBeHidden();

    // File must be cleared → shell's `!file` branch redirects guests to
    // the public landing page.
    await page.waitForURL(
      (url) =>
        !url.pathname.includes("/pdf-composer") &&
        !url.pathname.includes("/pdf-editor"),
      { timeout: 15_000 },
    );
  });
});
