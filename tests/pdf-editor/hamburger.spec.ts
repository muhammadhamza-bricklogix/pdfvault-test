import { expect, test } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";

/**
 * Coverage for the hamburger Editor menu in the new PvEditorTopChrome. The
 * menu now contains only file-level / navigation items; document actions
 * (Compress, Secure, Split, Page Numbers, Annotate, Flatten) moved to the
 * floating pill toolbar and are covered by `ui-inventory.spec.ts`.
 */
test.describe("PDF editor — hamburger menu", () => {
  test.beforeEach(async ({ page }) => {
    await openSamplePdfInEditor(page);
    await waitForPdfReady(page);
  });

  async function openMenu(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: "Editor menu" }).click();
    await expect(
      page.getByRole("menuitem", { name: /create new/i }),
    ).toBeVisible({ timeout: 3_000 });
  }

  test("lists all five menu items", async ({ page }) => {
    await openMenu(page);

    await expect(
      page.getByRole("menuitem", { name: /create new/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /open file/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /my pdfs/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /find and replace/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /version history/i }),
    ).toBeVisible();
  });

  test("Create New opens the create-PDF modal", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (e) => {
      if (e.message === "Transition was skipped") return;
      errors.push(e.message);
    });

    await openMenu(page);
    await page.getByRole("menuitem", { name: /create new/i }).click();

    await expect(
      page.getByRole("heading", { name: /create.*pdf/i }).first(),
    ).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press("Escape");

    expect(errors).toEqual([]);
  });

  test("Find and Replace opens the find/replace modal", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (e) => {
      if (e.message === "Transition was skipped") return;
      errors.push(e.message);
    });

    await openMenu(page);
    await page.getByRole("menuitem", { name: /find and replace/i }).click();

    await expect(
      page.getByRole("heading", { name: /find.*replace/i }).first(),
    ).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press("Escape");

    expect(errors).toEqual([]);
  });

  test("My PDFs item is gated when signed out — opens the sign-in confirm modal", async ({
    page,
  }) => {
    await openMenu(page);
    await page.getByRole("menuitem", { name: /^my pdfs$/i }).click();

    await expect(
      page.getByRole("heading", { name: /sign in required/i }).first(),
    ).toBeVisible({ timeout: 4_000 });
    await expect(
      page.getByRole("button", { name: /sign in.*continue/i }).first(),
    ).toBeVisible();

    // Cancel keeps the user on the editor.
    await page.getByRole("button", { name: /cancel/i }).first().click();
    expect(page.url()).toMatch(/\/(pdf-editor|pdf-composer)/);
  });

  test("Version History is gated when signed out — opens the sign-in confirm modal", async ({
    page,
  }) => {
    await openMenu(page);
    await page.getByRole("menuitem", { name: /version history/i }).click();

    await expect(
      page.getByRole("heading", { name: /sign in required/i }).first(),
    ).toBeVisible({ timeout: 4_000 });
    await page.getByRole("button", { name: /cancel/i }).first().click();
    expect(page.url()).toMatch(/\/(pdf-editor|pdf-composer)/);
  });
});
