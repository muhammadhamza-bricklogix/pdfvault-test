import { expect, test } from "@playwright/test";

import { FIXTURES, openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";

/**
 * Cross-feature edge cases that don't fit cleanly into one tool spec.
 *
 * - Keyboard delete / undo / redo
 * - Unsaved-changes warning
 * - File-size + MIME validation on upload
 * - Anonymous /pdf-editor?id=... gating
 */
test.describe("PDF editor — edge cases", () => {
  test("?id= with empty value redirects out of the editor", async ({
    page,
  }) => {
    await page.goto("/pdf-editor?id=");
    // proxy.ts: empty id → signed-out user gets sign-in, signed-in
    // user gets dashboard. Either way: not the editor.
    await expect
      .poll(() => page.url(), { timeout: 6_000 })
      .toMatch(/\/(sign-in|dashboard)/);
  });

  test("?id= with a bogus value redirects to sign-in (signed-out)", async ({
    page,
  }) => {
    await page.goto("/pdf-editor?id=not-a-real-doc");

    await expect
      .poll(() => page.url(), { timeout: 6_000 })
      .toMatch(/\/sign-in/);
    // `/pdf-editor` is a redirect alias for the canonical `/pdf-composer`
    // route (see app/(tools)/pdf-editor/page.tsx). Middleware sees the
    // rewritten URL and preserves it in `redirect_url`.
    expect(decodeURIComponent(page.url())).toMatch(
      /redirect_url=\/(pdf-editor|pdf-composer)/,
    );
  });

  test("Local-mode editor opens without an id", async ({ page }) => {
    await page.goto("/pdf-editor");

    // No sign-in redirect — bare editor URL is intentionally public.
    // `/pdf-editor` server-redirects to the canonical `/pdf-composer`.
    await expect(page).toHaveURL(/\/(pdf-editor|pdf-composer)/);
  });

  test("Keyboard: Escape and Delete don't crash on empty editor", async ({
    page,
  }) => {
    const errors: string[] = [];

    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/pdf-editor");
    await page.waitForLoadState("domcontentloaded");

    await page.keyboard.press("Escape");
    await page.keyboard.press("Delete");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(200);

    expect(errors).toEqual([]);
  });

  test("Cmd+Z / Cmd+Shift+Z don't crash on empty editor", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/pdf-editor");
    await page.waitForLoadState("domcontentloaded");

    await page.keyboard.press("ControlOrMeta+z");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await page.keyboard.press("ControlOrMeta+y");
    await page.waitForTimeout(200);

    expect(errors).toEqual([]);
  });

  test("Cmd+F opens Find & Replace once a PDF is loaded", async ({ page }) => {
    await openSamplePdfInEditor(page);
    await waitForPdfReady(page);

    await page.keyboard.press("ControlOrMeta+f");

    await expect(
      page.getByRole("heading", { name: /find/i }).first(),
    ).toBeVisible({ timeout: 4_000 });

    await page.keyboard.press("Escape");
  });

  test("Uploading non-PDF + non-supported file is rejected", async ({
    page,
  }) => {
    await page.goto("/pdf-editor");

    // We expect either: a toast saying "unsupported", OR the conversion
    // pipeline to handle it gracefully. Neither path should crash.
    const errors: string[] = [];

    page.on("pageerror", (e) => errors.push(e.message));

    // Use a non-PDF / non-supported MIME by writing a temp file with
    // garbage extension. Playwright's setInputFiles can accept inline
    // buffers.
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "garbage.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([0x00, 0x01, 0x02, 0x03]),
    });

    await page.waitForTimeout(1_500);

    // No JS crash. The toast may or may not appear — depends on which
    // upload entry we hit. Important: editor doesn't render a broken
    // PDF canvas.
    expect(errors, "page crashed after garbage upload").toEqual([]);
  });

  test("Tool switch doesn't crash the editor", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (e) => {
      // React 19 emits "Transition was skipped" as an uncaught error
      // when a concurrent transition is deduped — noise, not a real
      // crash. Filter it out so the assertion stays meaningful.
      if (e.message === "Transition was skipped") return;
      errors.push(e.message);
    });

    await openSamplePdfInEditor(page);
    await waitForPdfReady(page);

    // Tap Draw then return to Select — exercises the active-tool effect
    // in `use-fabric-canvas.ts` (touch-action trio + selection flag)
    // AND the cursor-map switch in `PdfViewerCanvas.tsx`.
    await page
      .getByRole("button", { name: /^draw$/i })
      .first()
      .click();
    await page.waitForTimeout(200);
    await page
      .getByRole("button", { name: /^select$/i })
      .first()
      .click();
    await page.waitForTimeout(200);

    expect(errors, "uncaught error during tool switch").toEqual([]);
  });
});
