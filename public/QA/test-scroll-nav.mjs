/**
 * Playwright verification: mobile page navigation via scroll + swipe gestures.
 * Run: node public/QA/test-scroll-nav.mjs
 */
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_PATH = path.resolve(__dirname, "../../tests/fixtures/sample.pdf");

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function loadEditor(page) {
  await page.goto("http://localhost:3000");
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("text=Upload to Edit").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(PDF_PATH);
  await page.waitForSelector('canvas[role="img"][aria-label*="page 1"]', { timeout: 15000 });
  await page.waitForTimeout(1500);
}

function getState(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas[role="img"]');
    const el = document.querySelector(".overflow-auto.bg-default-100");
    return {
      pageLabel: canvas?.getAttribute("aria-label"),
      scrollTop: el ? Math.round(el.scrollTop) : -1,
      scrollHeight: el?.scrollHeight ?? 0,
      clientHeight: el?.clientHeight ?? 0,
    };
  });
}

// Force overflow so scroll events fire, then scroll to bottom
function scrollToBottom(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".overflow-auto.bg-default-100");
    el.style.maxHeight = "400px";
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
}

// Simulate a touch swipe on the scroll container
function swipe(page, dx, dy) {
  return page.evaluate(
    ([dx, dy]) => {
      const el = document.querySelector(".overflow-auto.bg-default-100");
      const cx = el.clientWidth / 2;
      const cy = el.clientHeight / 2;
      const mkTouch = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y, screenX: x, screenY: y });
      el.dispatchEvent(new TouchEvent("touchstart", { touches: [mkTouch(cx, cy)], changedTouches: [mkTouch(cx, cy)], bubbles: true }));
      el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [mkTouch(cx + dx, cy + dy)], bubbles: true }));
    },
    [dx, dy],
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 size
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await ctx.newPage();

  await loadEditor(page);

  // ── Test 1: Scroll to bottom → next page ─────────────────────────────────
  console.log("\nTest 1: Scroll-to-bottom auto-advances to next page");
  const t1before = await getState(page);
  assert(t1before.pageLabel === "PDF page 1 of 3", `starts on page 1 (got: ${t1before.pageLabel})`);
  await scrollToBottom(page);
  await page.waitForTimeout(800);
  const t1after = await getState(page);
  assert(t1after.pageLabel === "PDF page 2 of 3", `advanced to page 2 (got: ${t1after.pageLabel})`);
  assert(t1after.scrollTop === 0, `scroll reset to 0 (got: ${t1after.scrollTop})`);

  // ── Test 2: Pull-down at top → previous page ──────────────────────────────
  console.log("\nTest 2: Pull-down at top → previous page");
  await page.waitForTimeout(400);
  const t2before = await getState(page);
  assert(t2before.pageLabel === "PDF page 2 of 3", `on page 2 (got: ${t2before.pageLabel})`);
  // Swipe DOWN (finger moves down = pull down) at top of scroll container
  await swipe(page, 0, 100);
  await page.waitForTimeout(800);
  const t2after = await getState(page);
  assert(t2after.pageLabel === "PDF page 1 of 3", `went back to page 1 (got: ${t2after.pageLabel})`);

  // ── Test 3: Swipe LEFT → next page ───────────────────────────────────────
  console.log("\nTest 3: Swipe left → next page");
  await page.waitForTimeout(400);
  assert((await getState(page)).pageLabel === "PDF page 1 of 3", "on page 1");
  await swipe(page, -80, 0); // finger moves left
  await page.waitForTimeout(800);
  const t3after = await getState(page);
  assert(t3after.pageLabel === "PDF page 2 of 3", `swipe-left → page 2 (got: ${t3after.pageLabel})`);

  // ── Test 4: Swipe RIGHT → previous page ──────────────────────────────────
  console.log("\nTest 4: Swipe right → previous page");
  await page.waitForTimeout(400);
  assert((await getState(page)).pageLabel === "PDF page 2 of 3", "on page 2");
  await swipe(page, 80, 0); // finger moves right
  await page.waitForTimeout(800);
  const t4after = await getState(page);
  assert(t4after.pageLabel === "PDF page 1 of 3", `swipe-right → page 1 (got: ${t4after.pageLabel})`);

  // ── Test 5: No over-advance past last page ────────────────────────────────
  console.log("\nTest 5: Stops at last page (no over-advance)");
  await scrollToBottom(page); await page.waitForTimeout(600); // page 1 → 2
  await scrollToBottom(page); await page.waitForTimeout(600); // page 2 → 3
  await scrollToBottom(page); await page.waitForTimeout(600); // page 3 → stays
  const t5 = await getState(page);
  assert(t5.pageLabel === "PDF page 3 of 3", `stays on page 3 (got: ${t5.pageLabel})`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(45)}`);
  console.log(
    failed === 0
      ? `✅ ALL ${passed} TESTS PASSED`
      : `❌ ${failed} FAILED / ${passed + failed} total`,
  );

  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})();
