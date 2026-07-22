import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Probe for the 2026-07-22 / 2026-07-23 Edit-Text visual regressions.
 * User reported that clicking the "Edit" toolbar tool made every source
 * text run visibly grow (~16 %) and re-wrap onto a second hidden line
 * that painted over the block below.
 *
 * Root cause of the growth: Fabric Textbox defaults `lineHeight` to
 * 1.16. Fix: force `lineHeight: 1` in `use-edit-text-mode.ts`, matching
 * pdf.js's cap-height paint.
 *
 * This spec drives the exact document the user reported
 * (`public/Back-end_infrastructure.pdf`, mirrored into `tests/fixtures/`
 * for hermetic runs). It asserts every extracted overlay is a single
 * visual line whose rendered height stays within 4 % of the extracted
 * block height — a safeguard against the ~16 % drift we saw before the
 * fix.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(
  __dirname,
  "..",
  "fixtures",
  "back-end-infrastructure.pdf",
);

test.use({ storageState: { cookies: [], origins: [] } });

test("Edit-Text overlays match source paint (no size growth, no wrap)", async ({
  page,
}) => {
  await page.goto("/pdf-composer");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);

  await expect(
    page.getByRole("img", { name: /PDF page/i }).first(),
  ).toBeVisible({ timeout: 20_000 });

  // Wait until the harness has the store + canvas ready.
  await page.waitForFunction(
    () =>
      !!window.__PDF_EDITOR_TEST__?.fabricCanvas &&
      !!window.__PDF_EDITOR_TEST__?.getStore?.(),
    { timeout: 20_000 },
  );

  // Fire the Edit toolbar tool. The `select` gate at
  // `use-edit-text-mode.ts` runs on `activeTool === "editText"`, so
  // flip the store value directly to keep the probe independent of
  // toolbar-DOM changes.
  await page.evaluate(() => {
    window.__PDF_EDITOR_TEST__!.getStore().setActiveTool("editText");
  });

  // Wait for the page to land in `extractedPages` — that's the flag
  // `useEditTextMode` sets after IText objects are on the canvas.
  await page.waitForFunction(
    () => {
      const store = window.__PDF_EDITOR_TEST__?.getStore();

      if (!store) return false;

      return store.extractedPages.has(
        store.getSourcePageIndex(store.currentPage),
      );
    },
    { timeout: 20_000 },
  );

  // Read every `editModeText` overlay's rendered geometry back out.
  // Fabric exposes `_textLines` after `initDimensions` runs; each entry
  // is one visually rendered line. `.height` on the object is the
  // Textbox's total rendered height. `.fontSize` is what we authored.
  // `originalHeight` is `block.height`, the pdf.js cap-height.
  const overlays = await page.evaluate(() => {
    const canvas = window.__PDF_EDITOR_TEST__!.fabricCanvas!;

    return canvas
      .getObjects()
      .filter((o) => (o as any).editorType === "editModeText")
      .map((o) => {
        const any = o as {
          text: string;
          fontSize: number;
          height: number;
          originalHeight?: number;
          originalWidth?: number;
          width?: number;
          _textLines?: string[];
          lineHeight?: number;
        };

        return {
          text: (any.text ?? "").slice(0, 60),
          fontSize: any.fontSize,
          renderedHeight: any.height,
          sourceHeight: any.originalHeight ?? any.fontSize,
          sourceWidth: any.originalWidth,
          boxWidth: any.width,
          lines: any._textLines?.length ?? 1,
          lineHeight: any.lineHeight ?? 1,
        };
      });
  });

  console.log(
    `[edit-text-probe] extracted overlays: ${overlays.length} (fixture: Back-end_infrastructure.pdf)`,
  );

  const sample = overlays.slice(0, 4).map((o) => ({
    text: o.text,
    fontSize: o.fontSize,
    box: o.boxWidth,
    src: o.sourceWidth,
    lines: o.lines,
  }));

  console.log("[edit-text-probe] first-4 overlays:", JSON.stringify(sample));

  expect(overlays.length, "extraction produced overlays").toBeGreaterThan(5);

  // No hidden second line — the "text collapses / stacks when Edit
  // activates" bug from 2026-07-22.
  const multiline = overlays.filter((o) => o.lines > 1);

  if (multiline.length > 0) {
    console.log(
      "[edit-text-probe] MULTILINE overlays:",
      multiline.map((o) => `"${o.text}" lines=${o.lines}`).join(" | "),
    );
  }
  expect(
    multiline.length,
    "no extracted overlay should render on more than one line",
  ).toBe(0);

  // No visible size growth — the 2026-07-23 lineHeight bug. The Fabric
  // rendered height should sit within 4 % of the source cap-height for
  // upright text. Allow a small slack for antialias rounding.
  const grew = overlays.filter(
    (o) => o.renderedHeight > o.sourceHeight * 1.04,
  );

  if (grew.length > 0) {
    console.log(
      "[edit-text-probe] GROWN overlays:",
      grew
        .slice(0, 8)
        .map(
          (o) =>
            `"${o.text}" rendered=${o.renderedHeight.toFixed(1)} source=${o.sourceHeight.toFixed(1)}`,
        )
        .join(" | "),
    );
  }
  expect(
    grew.length,
    "no extracted overlay should render taller than 104 % of the source cap-height",
  ).toBe(0);

  // Author-side sanity: every overlay should carry lineHeight: 1.
  const wrongLineHeight = overlays.filter((o) => Math.abs(o.lineHeight - 1) > 0.001);

  expect(
    wrongLineHeight.length,
    "all extracted overlays should carry lineHeight: 1",
  ).toBe(0);
});
