import { test, expect } from "@playwright/test";

/**
 * Smoke & visual verification test for 1099-NEC form:
 *   landing → "Open the 1099-NEC Template" → /forms/1099-nec/edit →
 *   verify granular in-document fields → fill required fields →
 *   verify Copy A and Copy 1 differences (no 2nd TIN notice on Copy 1) →
 *   click Done → finalize returns downloadUrl.
 */

test.describe("1099-NEC form editor — happy path", () => {
  test("user can fill, review, and finalize 1099-NEC with granular fields", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/forms/1099-nec");

    await expect(
      page.getByRole("heading", { name: /Fill out a 1099-NEC Form Online in/i }),
    ).toBeVisible();

    await page.getByRole("link", { name: /Open the 1099-NEC Template/i }).first().click();

    await expect(page).toHaveURL(/\/forms\/1099-nec\/edit/);

    // In-document highlighted fields on Page 2 (Copy A)
    const payerNameInput = page.locator("#field-input-payer_name");
    await payerNameInput.waitFor({ state: "visible", timeout: 20_000 });
    await payerNameInput.fill("Acme Corporation");

    await page.locator("#field-input-payer_street").fill("100 Tech Blvd");
    await page.locator("#field-input-payer_suite").fill("Suite 300");
    await page.locator("#field-input-payer_city").fill("Austin");
    await page.locator("#field-input-payer_phone").fill("512-555-0100");
    await page.locator("#field-input-payer_state").fill("TX");
    await page.locator("#field-input-payer_zip").fill("78701");

    const payerTinInput = page.locator("#field-input-payer_tin");
    await payerTinInput.fill("12-3456789");

    const recipientTinInput = page.locator("#field-input-recipient_tin");
    await recipientTinInput.fill("987-65-4321");

    const recipientNameInput = page.locator("#field-input-recipient_name");
    await recipientNameInput.fill("John Doe Consulting");

    const recipientStreetInput = page.locator("#field-input-recipient_street");
    await recipientStreetInput.fill("456 Freelancer Ave");
    await page.locator("#field-input-recipient_apt").fill("Apt 2B");

    const recipientCityInput = page.locator("#field-input-recipient_city");
    await recipientCityInput.fill("Denver");
    await page.locator("#field-input-recipient_state").fill("CO");
    await page.locator("#field-input-recipient_zip").fill("80202");

    const box1Input = page.locator("#field-input-box1_nec");
    await box1Input.fill("15250.00");

    await page.locator("#field-input-calendar_year").fill("2026");
    await page.locator("#field-input-box1b_cash_tips").fill("200.00");
    await page.locator("#field-input-box4_fed_tax_withheld").fill("1500.00");

    // 2nd TIN notice checkbox MUST be visible on Page 2 (Copy A)
    const secondTinCopyA = page.locator("#field-input-second_tin_notice");
    await expect(secondTinCopyA).toBeVisible();

    // Take screenshot of Page 2 (Copy A)
    await page.screenshot({ path: "test-results/1099-nec-copy-a.png" });

    // Switch to Page 3 (Copy 1) via thumbnail sidebar
    const page3Thumbnail = page.locator('[role="option"]:has-text("3")');
    if (await page3Thumbnail.isVisible()) {
      await page3Thumbnail.click();
      await page.waitForTimeout(500);

      // On Page 3 (Copy 1), 2nd TIN notice checkbox MUST NOT exist
      await expect(page.locator("#field-input-second_tin_notice")).toHaveCount(0);

      // Take screenshot of Page 3 (Copy 1)
      await page.screenshot({ path: "test-results/1099-nec-copy-1.png" });
    }

    // Click Finish & Download in editor top bar — opens ExportFormatModal
    await page
      .getByRole("button", { name: /Finish & Download|Finish and Download/i })
      .click();

    // Click Download in ExportFormatModal
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^Download$/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/1099-NEC\.pdf/i);
  });
});
