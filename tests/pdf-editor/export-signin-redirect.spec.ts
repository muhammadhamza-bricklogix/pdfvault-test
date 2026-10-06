import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PDF = path.join(__dirname, "..", "fixtures", "sample.pdf");

// Force anonymous — this spec exercises the signed-out export gate.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Editor export — signed-out flow", () => {
  test("PDF export as signed-out DOES NOT redirect (client-side only, no auth needed)", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    const downloadTrigger = page
      .getByRole("button", { name: /^(download|export options)$/i })
      .first();

    await downloadTrigger.click();
    await page.locator('[role="menuitem"][data-key="pdf"]').first().click();

    // PDF export is client-side only — should NOT bounce to sign-in.
    // Give the redirect a chance to (not) happen.
    await page.waitForTimeout(1000);
    expect(page.url()).not.toContain("/sign-in");
    expect(page.url()).toContain("/pdf-composer");
  });

  test("non-PDF export as signed-out opens the Sign-In confirm modal, and confirming redirects to /sign-in with the export in the return URL", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    const downloadTrigger = page
      .getByRole("button", { name: /^(download|export options)$/i })
      .first();

    await downloadTrigger.click();
    await page
      .locator('[role="menuitem"][data-key="docx"]')
      .first()
      .click();

    // Sign-in prompt modal should appear (not an immediate redirect).
    const promptHeading = page.getByRole("heading", {
      name: /Sign in to download/i,
    });

    await expect(promptHeading).toBeVisible({ timeout: 5_000 });

    // URL still on /pdf-composer — no redirect until user confirms.
    expect(page.url()).toContain("/pdf-composer");
    expect(page.url()).not.toContain("/sign-in");

    // Confirm → redirect to /sign-in with correct redirect_url.
    await page
      .getByRole("button", { name: /Sign in & continue/i })
      .click();

    await expect(page).toHaveURL(/\/sign-in\?redirect_url=/, {
      timeout: 10_000,
    });

    const currentUrl = new URL(page.url());
    const returnTo = decodeURIComponent(
      currentUrl.searchParams.get("redirect_url") ?? "",
    );

    expect(returnTo).toContain("/pdf-composer");
    expect(returnTo).toContain("export=docx");
  });

  test("non-PDF export as signed-out can be cancelled from the modal — user stays on the editor", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole("button", { name: /^(download|export options)$/i })
      .first()
      .click();
    await page
      .locator('[role="menuitem"][data-key="docx"]')
      .first()
      .click();

    await expect(
      page.getByRole("heading", { name: /Sign in to download/i }),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: /^Cancel$/i }).click();

    // Modal dismisses, user is still on /pdf-composer with the file
    // loaded — no redirect happened.
    await expect(
      page.getByRole("heading", { name: /Sign in to download/i }),
    ).not.toBeVisible({ timeout: 3_000 });
    expect(page.url()).toContain("/pdf-composer");
    expect(page.url()).not.toContain("/sign-in");
  });

  // QA PDF-287 (regression guard — paywall misses on first return).
  //
  // Full-flow Playwright coverage is blocked by Clerk's inability
  // to be fully mocked (fake tickets are rejected, real tickets
  // can't be synthesised in-browser). This guard checks the
  // observable JS surface instead: the hydrator Step 4 effect
  // reads `isSignedIn` from `useAuth()`, and when the URL carries
  // a `?id=` marker (post-signin return from `runAutoSignup`) it
  // must NOT fire `editor:export` until `isSignedIn === true`.
  //
  // Manual repro (requires staging Clerk account on a real device):
  //   1. Signed-out → upload a PDF → Edit → Done → Download → DOCX.
  //   2. EmailFirstModal opens. Submit a fresh email.
  //   3. `runAutoSignup` finishes → `window.location.assign(
  //      "/pdf-composer?id=X&export=docx")`.
  //   4. Expect: paywall opens on this FIRST return.
  //   5. Before fix: EmailFirstModal re-dispatched on the return,
  //      paywall only opens on the SECOND manual Download click.
  //
  // Code-level guard here: the hydrator source must contain the
  // gate that reads `isSignedIn` when `isPostSigninReturn`. If a
  // future refactor drops this check the test fails and names the
  // regression explicitly. Not a substitute for manual QA — just
  // the fastest-possible static tripwire.
  test("PDF-287: hydrator Step 4 source must gate the auto-launch on `isSignedIn` when `?id=` is in URL", async ({
    page,
  }) => {
    const response = await page.request.get(
      "http://localhost:3001/_next/static/..",
      { failOnStatusCode: false },
    );
    // Expected: dev server reachable. Not strict — the hydrator
    // source is read from the filesystem via a `page.evaluate` of
    // a fetch to the compiled bundle below.
    expect(response.status()).toBeGreaterThanOrEqual(200);

    // Fetch the hydrator source from the running dev server via its
    // static file route. In production the file is compiled, so
    // this test is dev-only — use the environment variable
    // `PLAYWRIGHT_SKIP_SOURCE_GUARDS=1` to skip in CI builds.
    if (process.env.PLAYWRIGHT_SKIP_SOURCE_GUARDS === "1") {
      test.skip();
    }

    const fs = await import("node:fs/promises");
    const file = await fs.readFile(
      path.join(
        __dirname,
        "..",
        "..",
        "components",
        "shared",
        "pending-editor-file-hydrator.tsx",
      ),
      "utf8",
    );

    // Must contain the gate the fix introduced.
    expect(file, "hydrator must declare an `isPostSigninReturn` signal").toMatch(
      /isPostSigninReturn\s*=/,
    );
    expect(
      file,
      "hydrator Step 4 must bail when post-signin return AND !isSignedIn",
    ).toMatch(/isPostSigninReturn\s*&&\s*!isSignedIn/);
  });

  test("PDF-287: useExportEditor source must defer when `?id=` is in URL and signedIn is false", async ({}) => {
    if (process.env.PLAYWRIGHT_SKIP_SOURCE_GUARDS === "1") {
      test.skip();
    }
    const fs = await import("node:fs/promises");
    const file = await fs.readFile(
      path.join(
        __dirname,
        "..",
        "..",
        "lib",
        "client",
        "hooks",
        "pdf-editor",
        "use-export-editor.ts",
      ),
      "utf8",
    );

    expect(
      file,
      "handleExport must defer when a post-signin ?id= is present and signedIn is still false",
    ).toMatch(/inPostSigninReturn\s*=\s*search\.includes\("id="\)/);
    expect(
      file,
      "defer counter must reset once signedIn flips to true",
    ).toMatch(/signedInDeferAttemptsRef\.current\s*=\s*0/);
  });
});
