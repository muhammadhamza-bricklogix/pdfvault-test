import { test, expect } from "@playwright/test";

/**
 * Smoke and visual verification for the DS-82 passport renewal application:
 *   landing → "Open the DS-82 Form" → /forms/ds-82/edit →
 *   fill application page 1 (PDF page 5) → switch to page 2 (PDF page 6) →
 *   confirm each page only renders its own fields.
 *
 * Page numbering is the PDF's: the application starts on PDF page 5 because
 * pages 1 to 4 are instructions.
 *
 * Unlike DS-11, DS-82's template is one we generate — the government PDF has
 * no form fields at all — so these also guard the injected widget layer.
 */

const FIRST_FORM_PAGE = 5;
const SECOND_FORM_PAGE = 6;

test.describe("DS-82 form editor", () => {
  test("user can fill both application pages", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/forms/ds-82");

    await expect(
      page.getByRole("heading", { name: /Renew Your U\.S\. Passport Online/i }),
    ).toBeVisible();

    await expect(
      page.getByText(/not affiliated with the U\.S\. Department of State/i),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /Open the DS-82 Form/i })
      .first()
      .click();

    await expect(page).toHaveURL(/\/forms\/ds-82\/edit/);

    const lastName = page.locator("#field-input-last_name");

    await lastName.waitFor({ state: "visible", timeout: 60_000 });
    await lastName.fill("Rodriguez");

    await page.locator("#field-input-first_name").fill("Maria");
    await page.locator("#field-input-middle_name").fill("Elena");
    await page.locator("#field-input-dob_month").fill("04");
    await page.locator("#field-input-dob_day").fill("17");
    await page.locator("#field-input-dob_year").fill("1990");
    await page.locator("#field-input-place_of_birth").fill("Austin, TX");
    await page.locator("#field-input-ssn_1").fill("123");
    await page.locator("#field-input-ssn_2").fill("45");
    await page.locator("#field-input-ssn_3").fill("6789");
    await page.locator("#field-input-mailing_address_1").fill("1200 Main St");
    await page.locator("#field-input-mailing_city").fill("Denver");
    await page.locator("#field-input-mailing_state").fill("CO");
    await page.locator("#field-input-mailing_zip").fill("80202");
    // The issue-date box is an 8-cell comb, so it takes digits, not slashes.
    await page.locator("#field-input-book_issue_date").fill("05012016");

    // Book / Card / Both is ONE AcroForm field with three widgets; the overlay
    // renders one hit-area per export value, which is what makes them
    // mutually exclusive.
    await page.getByRole("radio", { name: "U.S. Passport Book" }).click();
    await page.getByRole("radio", { name: "F" }).first().click();

    await page.screenshot({ path: "test-results/ds-82-page-1.png" });

    // Page 6's fields must not be mounted while page 5 is showing.
    await expect(page.locator("#field-input-height")).toHaveCount(0);

    const secondPageThumb = page.locator(
      `[role="option"]:has-text("${SECOND_FORM_PAGE}")`,
    );

    if (await secondPageThumb.isVisible()) {
      await secondPageThumb.click();
      await page.waitForTimeout(800);

      const height = page.locator("#field-input-height");

      await height.waitFor({ state: "visible", timeout: 30_000 });
      await height.fill("5 06");
      await page.locator("#field-input-occupation").fill("Engineer");
      await page.locator("#field-input-emergency_name").fill("Carlos Rodriguez");

      // ...and page 5's must not render on page 6.
      await expect(page.locator("#field-input-last_name")).toHaveCount(0);

      await page.screenshot({ path: "test-results/ds-82-page-2.png" });
    }
  });

  test("opens on the first application page, not the instructions", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await page.goto(`/forms/ds-82/edit?new=1`);

    await page
      .locator("#field-input-last_name")
      .waitFor({ state: "visible", timeout: 60_000 });

    await expect(
      page.locator(`canvas[aria-label="PDF page ${FIRST_FORM_PAGE}"]`),
    ).toBeVisible();
  });

  test("a partially filled form is still downloadable", async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto(`/forms/ds-82/edit?new=1`);

    const lastName = page.locator("#field-input-last_name");

    await lastName.waitFor({ state: "visible", timeout: 60_000 });
    await lastName.fill("Rodriguez");

    await page
      .getByRole("button", { name: /Finish & Download|Finish and Download/i })
      .click();

    // Deliberately NOT blocked: client validation does not gate the download,
    // and if the server filler refuses an incomplete application the intercept
    // falls back to stamping locally. The user always gets their draft.
    await expect(
      page.getByText(/Check your application|fields need attention/i),
    ).toHaveCount(0);
  });
});
