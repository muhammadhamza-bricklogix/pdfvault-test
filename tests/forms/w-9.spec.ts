import { test, expect } from "@playwright/test";

/**
 * Happy-path smoke for the W-9 editor:
 *   landing → "Fill Out W-9 Now" → fill required fields →
 *   sign via Type tab → click Done → finalize returns a downloadUrl.
 *
 * The session/finalize endpoints live on the backend (forms.service.ts).
 * If the backend isn't responding yet the test will fail at session start
 * with a clear "Couldn't start the form" toast — that's the right signal.
 */

test.describe("W-9 editor — happy path", () => {
  test("user can fill, sign, and finalize", async ({ page }) => {
    await page.goto("/forms/w-9");

    await expect(
      page.getByRole("heading", { name: /Fill Out W-9 Form Online/i }),
    ).toBeVisible();

    await page.getByRole("link", { name: /^Fill Out W-9 Now$/i }).click();

    await expect(page).toHaveURL(/\/forms\/w-9\/edit/);

    // Sidebar mirrors the schema; fill Name (f1_01).
    const nameInput = page.locator("#sidebar-f1_01");

    await nameInput.waitFor({ state: "visible", timeout: 20_000 });
    await nameInput.fill("Test User");

    // Pick the "Individual" classification.
    await page.getByRole("radio", { name: /Individual/i }).click();

    // Enter SSN.
    const ssnInput = page.locator("#sidebar-ssn");

    await ssnInput.fill("123456789");

    // Pick a date.
    const dateInput = page.locator("#sidebar-signature_date");

    await dateInput.fill("2026-05-25");

    // Open signature modal via the sidebar trigger.
    await page.getByRole("button", { name: /Add signature/i }).click();
    await page.getByRole("tab", { name: /^Type$/i }).click();
    await page.getByPlaceholder(/Type your full name/i).fill("Test User");
    await page.getByRole("button", { name: /Apply signature/i }).click();

    await expect(
      page.getByRole("button", { name: /Edit signature/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Click Done — pre-flight validation should pass, then generate.
    await page.getByRole("button", { name: /^Done$/i }).click();
    await page.getByRole("button", { name: /^Generate PDF$/i }).click();

    await expect(
      page.getByRole("heading", { name: /Your W-9 is ready/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: /Download PDF/i })).toBeVisible();
  });
});
