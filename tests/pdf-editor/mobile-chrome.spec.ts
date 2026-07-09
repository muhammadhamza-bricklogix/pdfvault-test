import { expect, test } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";

/**
 * Mobile chrome layout checks. The editor switches to EditorInfoBar + canvas +
 * BottomDock below the `lg` breakpoint (1024px). A 390x844 viewport exercises
 * this path end-to-end.
 */
test.use({ viewport: { width: 390, height: 844 } });

test.describe("PDF editor — mobile chrome", () => {
  test.beforeEach(async ({ page }) => {
    await openSamplePdfInEditor(page);
    await waitForPdfReady(page);
  });

  test("EditorInfoBar shows hamburger, filename, Save, page nav + zoom", async ({
    page,
  }) => {
    await expect(page.getByRole("button", { name: "Editor menu" })).toBeVisible();
    // Filename text is visually hidden on small screens but present in the DOM.
    await expect(page.getByText("sample.pdf").first()).toHaveCount(1);
    await expect(page.locator('button.button--primary', { hasText: /save/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /previous page/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /next page/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /zoom in/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /zoom out/i }).first()).toBeVisible();
  });

  test("BottomDock is visible with Undo, Redo, tool strip, Manage Pages", async ({
    page,
  }) => {
    const dock = page.getByRole("group", { name: "Drawing tools" });

    await expect(dock).toBeVisible({ timeout: 5_000 });
    // Undo/Redo live in the dock but outside the Drawing tools group.
    await expect(page.getByRole("button", { name: /^undo$/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^redo$/i }).first()).toBeVisible();
    // The tool strip renders icon-only toggle radios inside the dock.
    await expect(dock.getByRole("radio", { name: /^edit text$/i }).first()).toBeVisible();
    await expect(dock.getByRole("radio", { name: /^draw$/i }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^manage pages$/i }).first(),
    ).toBeVisible();
  });

  test("Watermark opens a mobile properties modal", async ({ page }) => {
    await page.getByRole("group", { name: "Drawing tools" })
      .getByRole("radio", { name: /^watermark$/i })
      .first()
      .click();

    await expect(
      page.getByRole("heading", { name: "Watermark" }).first(),
    ).toBeVisible({ timeout: 4_000 });
    await expect(page.getByRole("textbox", { name: "Watermark text" })).toBeVisible();
  });

  test("Background opens a mobile properties modal", async ({ page }) => {
    await page.getByRole("group", { name: "Drawing tools" })
      .getByRole("radio", { name: /^background$/i })
      .first()
      .click();

    await expect(
      page.getByRole("heading", { name: "Background image" }).first(),
    ).toBeVisible({ timeout: 4_000 });
    await expect(
      page.getByRole("button", { name: /upload image/i }).first(),
    ).toBeVisible();
  });

  test("Save button is visible and disabled in local mode", async ({
    page,
  }) => {
    const errors: string[] = [];

    page.on("pageerror", (e) => {
      if (e.message === "Transition was skipped") return;
      errors.push(e.message);
    });

    const saveButton = page.locator('button.button--primary', { hasText: /save/i }).first();

    await expect(saveButton).toBeVisible();
    // In local mode the button is disabled because the user isn't signed in;
    // we still assert it can be located and the editor stays stable.
    await expect(saveButton).toBeDisabled();

    expect(errors).toEqual([]);
  });
});
