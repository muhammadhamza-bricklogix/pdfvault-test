/**
 * Quick Playwright verification: mobile scroll-to-bottom auto-advances page.
 * Run: node public/QA/test-scroll-nav.mjs
 */
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_PATH = path.resolve(__dirname, "../../tests/fixtures/sample.pdf");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await ctx.newPage();

  // ── 1. Load the editor ──────────────────────────────────────────────────
  await page.goto("http://localhost:3000");
  await page.locator("text=Upload to Edit").click();
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("text=Upload to Edit").click().catch(() => {}),
  ]);
  // Restart with proper filechooser wait
  await page.goto("http://localhost:3000");
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("text=Upload to Edit").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(PDF_PATH);

  // ── 2. Wait for PDF to render ────────────────────────────────────────────
  await page.waitForSelector('canvas[role="img"][aria-label*="page 1"]', {
    timeout: 15000,
  });
  await page.waitForTimeout(1500);

  const getState = () =>
    page.evaluate(() => {
      const canvas = document.querySelector('canvas[role="img"]');
      const el = document.querySelector(".overflow-auto.bg-default-100");
      return {
        pageLabel: canvas?.getAttribute("aria-label"),
        scrollTop: el ? Math.round(el.scrollTop) : -1,
        scrollHeight: el?.scrollHeight,
        clientHeight: el?.clientHeight,
      };
    });

  const before = await getState();
  console.log("Before scroll:", before);
  console.assert(
    before.pageLabel === "PDF page 1 of 3",
    "Should start on page 1",
  );

  // ── 3. Force overflow + scroll to bottom ─────────────────────────────────
  await page.evaluate(() => {
    const el = document.querySelector(".overflow-auto.bg-default-100");
    el.style.maxHeight = "400px";
    // Scroll to bottom (triggers the onScroll handler)
    el.scrollTop = el.scrollHeight - el.clientHeight;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

  await page.waitForTimeout(1000);

  const after = await getState();
  console.log("After scroll:", after);

  // ── 4. Assertions ─────────────────────────────────────────────────────────
  const pagedForward = after.pageLabel === "PDF page 2 of 3";
  const scrollReset = after.scrollTop === 0;

  console.log(
    pagedForward
      ? "✅ PASS: Page advanced to page 2"
      : `❌ FAIL: Expected page 2, got: ${after.pageLabel}`,
  );
  console.log(
    scrollReset
      ? "✅ PASS: Scroll reset to top (scrollTop=0)"
      : `❌ FAIL: scrollTop should be 0, got: ${after.scrollTop}`,
  );

  // ── 5. Verify last page doesn't over-advance ──────────────────────────────
  // Navigate to page 3 and verify scroll-to-bottom does nothing
  await page.evaluate(() => {
    const el = document.querySelector(".overflow-auto.bg-default-100");
    el.style.maxHeight = "400px";
    el.scrollTop = el.scrollHeight - el.clientHeight;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const el = document.querySelector(".overflow-auto.bg-default-100");
    el.style.maxHeight = "400px";
    el.scrollTop = el.scrollHeight - el.clientHeight;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.waitForTimeout(800);

  const atEnd = await getState();
  console.log("At last page:", atEnd);
  const staysAtEnd = atEnd.pageLabel === "PDF page 3 of 3";
  console.log(
    staysAtEnd
      ? "✅ PASS: Stays on last page (no over-advance)"
      : `❌ FAIL: Over-advanced past last page: ${atEnd.pageLabel}`,
  );

  const allPassed = pagedForward && scrollReset && staysAtEnd;
  console.log(allPassed ? "\n✅ ALL TESTS PASSED" : "\n❌ SOME TESTS FAILED");

  await browser.close();
  process.exit(allPassed ? 0 : 1);
})();
