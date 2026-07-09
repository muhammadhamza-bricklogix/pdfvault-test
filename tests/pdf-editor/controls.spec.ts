import { test, expect } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";

test.beforeEach(async ({ page }) => {
  await openSamplePdfInEditor(page);
  await waitForPdfReady(page);
});

test.describe("PDF editor — top-bar controls", () => {
  test("Redo button is disabled when there is nothing to redo", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: /^redo$/i }).first(),
    ).toBeDisabled();
  });

  test("Undo/Redo state updates after a canvas edit", async ({ page }) => {
    const undoButton = page.getByRole("button", { name: /^undo$/i }).first();
    const redoButton = page.getByRole("button", { name: /^redo$/i }).first();

    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeDisabled();

    // Add a small text object to the canvas to create undoable history.
    await page.getByRole("button", { name: /^text$/i }).first().click();
    // Fabric renders an upper canvas on top of the accessibility "application"
    // canvas; click the upper canvas to hit the live drawing surface.
    await page
      .locator("canvas.upper-canvas")
      .first()
      .click({ position: { x: 200, y: 200 } });
    await page.keyboard.type("QA");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();

    await undoButton.click();
    await page.waitForTimeout(200);

    await expect(redoButton).toBeEnabled();
  });

  test("Share via link is disabled when signed out", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /share via link/i }).first(),
    ).toBeDisabled();
  });
});
