import { test, expect } from "@playwright/test";

/**
 * Smoke and visual verification for the DS-11 passport application:
 *   landing → "Open the DS-11 Form" → /forms/ds-11/edit →
 *   fill page 1 (PDF page 5) → switch to page 2 (PDF page 6) →
 *   confirm the overlay only covers the applicant half of page 1 →
 *   finalize returns a download.
 *
 * Page numbering is the PDF's: the application starts on PDF page 5 because
 * pages 1 to 4 are instructions.
 */

const FIRST_FORM_PAGE = 5;
const SECOND_FORM_PAGE = 6;

test.describe("DS-11 form editor — happy path", () => {
  test("user can fill both application pages and download", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await page.goto("/forms/ds-11");

    await expect(
      page.getByRole("heading", { name: /Fill out Form DS-11 Online/i }),
    ).toBeVisible();

    await expect(
      page.getByText(/not affiliated with the U\.S\. Department of State/i),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /Open the DS-11 Form/i })
      .first()
      .click();

    await expect(page).toHaveURL(/\/forms\/ds-11\/edit/);

    const lastName = page.locator("#field-input-last_name");

    await lastName.waitFor({ state: "visible", timeout: 30_000 });
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
    await page.locator("#field-input-mailing_street").fill("1200 Main Street");
    await page.locator("#field-input-mailing_city").fill("Denver");
    await page.locator("#field-input-mailing_state").fill("CO");
    await page.locator("#field-input-mailing_zip").fill("80202");

    // Book / Card / Both is one AcroForm field with three widgets; the
    // overlay renders one hit-area per export value.
    await page.getByRole("radio", { name: "U.S. Passport Book" }).click();

    await page.getByRole("radio", { name: "M" }).first().click();

    await page.screenshot({ path: "test-results/ds-11-page-1.png" });

    // Nothing below the STOP banner is ours to fill — those boxes are
    // completed in person by the acceptance agent.
    await expect(page.locator("#field-input-parent1_last")).toHaveCount(0);

    const secondPageThumb = page.locator(
      `[role="option"]:has-text("${SECOND_FORM_PAGE}")`,
    );

    if (await secondPageThumb.isVisible()) {
      await secondPageThumb.click();
      await page.waitForTimeout(600);

      const parentLast = page.locator("#field-input-parent1_last");

      await parentLast.waitFor({ state: "visible", timeout: 15_000 });
      await parentLast.fill("Rodriguez");
      await page.locator("#field-input-parent1_first_middle").fill("Carlos A");

      // The page 5 fields must not render on page 6.
      await expect(page.locator("#field-input-last_name")).toHaveCount(0);

      await page.screenshot({ path: "test-results/ds-11-page-2.png" });
    }

    await page
      .getByRole("button", { name: /Finish & Download|Finish and Download/i })
      .click();

    const downloadPromise = page.waitForEvent("download");

    await page.getByRole("button", { name: /^Download$/i }).click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/DS-11/i);
  });

  test("blocks download until the required fields are filled", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto(`/forms/ds-11/edit?new=1`);

    const lastName = page.locator("#field-input-last_name");

    await lastName.waitFor({ state: "visible", timeout: 30_000 });
    await lastName.fill("Rodriguez");

    await page
      .getByRole("button", { name: /Finish & Download|Finish and Download/i })
      .click();
    await page.getByRole("button", { name: /^Download$/i }).click();

    await expect(page.getByText(/Check your application/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("opens on the first application page, not the instructions", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto(`/forms/ds-11/edit?new=1`);

    await page
      .locator("#field-input-last_name")
      .waitFor({ state: "visible", timeout: 30_000 });

    await expect(
      page.locator(`canvas[aria-label="PDF page ${FIRST_FORM_PAGE}"]`),
    ).toBeVisible();
  });
});
