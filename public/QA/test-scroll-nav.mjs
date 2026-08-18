/**
 * Playwright verification with console log capture.
 * Run: node public/QA/test-scroll-nav.mjs
 */
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_PATH = path.resolve(__dirname, "../../tests/fixtures/sample.pdf");

let passed = 0;
let failed = 0;
const logs = [];

function assert(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ FAIL: ${label}`); failed++; }
}

async function loadEditor(page) {
  await page.goto("http://localhost:3000");
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("text=Upload to Edit").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(PDF_PATH);
  await page.waitForSelector('canvas[role="img"][aria-label*="page 1"]', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

const getState = (page) =>
  page.evaluate(() => {
    const canvas = document.querySelector('canvas[role="img"]');
    const el = document.querySelector(".overflow-auto.bg-default-100");
    return {
      pageLabel: canvas?.getAttribute("aria-label"),
      scrollTop: el ? Math.round(el.scrollTop) : -1,
      scrollHeight: el?.scrollHeight ?? 0,
      clientHeight: el?.clientHeight ?? 0,
    };
  });

// Force overflow and dispatch a scroll event
const scrollToBottom = (page) =>
  page.evaluate(() => {
    const el = document.querySelector(".overflow-auto.bg-default-100");
    if (!el) return;
    el.style.maxHeight = "400px";
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

// Simulate a swipe via document-level touch events (matching the new implementation)
const swipe = (page, dx, dy) =>
  page.evaluate(([dx, dy]) => {
    const el = document.querySelector(".overflow-auto.bg-default-100");
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    const mkTouch = (x, y) =>
      new Touch({ identifier: 1, target: el, clientX: x, clientY: y, screenX: x, screenY: y });
    document.dispatchEvent(
      new TouchEvent("touchstart", { touches: [mkTouch(cx, cy)], changedTouches: [mkTouch(cx, cy)], bubbles: true }),
    );
    document.dispatchEvent(
      new TouchEvent("touchend", { touches: [], changedTouches: [mkTouch(cx + dx, cy + dy)], bubbles: true }),
    );
  }, [dx, dy]);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  });
  const page = await ctx.newPage();

  // Capture [PDFedits] console logs
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[PDFedits]")) {
      logs.push(text);
      console.log("  LOG:", text);
    }
  });

  await loadEditor(page);

  console.log("\n── Init logs ──────────────────────────────────");
  await page.waitForTimeout(500);

  // ── Test 1: Scroll to bottom → next page ──────────────────────────────
  console.log("\nTest 1: scroll-to-bottom → next page");
  assert((await getState(page)).pageLabel === "PDF page 1 of 3", "starts on page 1");
  await scrollToBottom(page);
  await page.waitForTimeout(1000);
  const t1 = await getState(page);
  assert(t1.pageLabel === "PDF page 2 of 3", `advanced to page 2 (got: ${t1.pageLabel})`);
  assert(t1.scrollTop === 0, `scroll reset (got: ${t1.scrollTop})`);

  // ── Test 2: Pull-down at top → prev page ──────────────────────────────
  console.log("\nTest 2: pull-down at top → prev page");
  await page.waitForTimeout(300);
  await swipe(page, 0, 100);
  await page.waitForTimeout(800);
  const t2 = await getState(page);
  assert(t2.pageLabel === "PDF page 1 of 3", `back to page 1 (got: ${t2.pageLabel})`);

  // ── Test 3: Swipe left → next page ────────────────────────────────────
  console.log("\nTest 3: swipe-left → next page");
  await page.waitForTimeout(300);
  await swipe(page, -80, 0);
  await page.waitForTimeout(800);
  const t3 = await getState(page);
  assert(t3.pageLabel === "PDF page 2 of 3", `swipe-left → page 2 (got: ${t3.pageLabel})`);

  // ── Test 4: Swipe right → prev page ───────────────────────────────────
  console.log("\nTest 4: swipe-right → prev page");
  await page.waitForTimeout(300);
  await swipe(page, 80, 0);
  await page.waitForTimeout(800);
  const t4 = await getState(page);
  assert(t4.pageLabel === "PDF page 1 of 3", `swipe-right → page 1 (got: ${t4.pageLabel})`);

  // ── Test 5: No over-advance past last page ─────────────────────────────
  console.log("\nTest 5: stops at last page");
  await scrollToBottom(page); await page.waitForTimeout(600);
  await scrollToBottom(page); await page.waitForTimeout(600);
  await scrollToBottom(page); await page.waitForTimeout(600);
  const t5 = await getState(page);
  assert(t5.pageLabel === "PDF page 3 of 3", `stays on page 3 (got: ${t5.pageLabel})`);

  console.log(`\n${"─".repeat(45)}`);
  console.log(failed === 0 ? `✅ ALL ${passed} TESTS PASSED` : `❌ ${failed} FAILED / ${passed + failed} total`);

  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})();
