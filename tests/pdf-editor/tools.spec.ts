import { test, expect } from "@playwright/test";

import { openSamplePdfInEditor } from "../helpers/editor";

const TOOLS = [
  "Select",
  "Text",
  "Draw",
  "Highlight",
  "Shapes",
  "Eraser",
  "Whiteout",
  "Signature",
  "Image",
  "Watermark",
  "Background",
];

test.beforeEach(async ({ page }) => {
  await openSamplePdfInEditor(page);
});

test.describe("PDF editor — tool activation", () => {
  for (const tool of TOOLS) {
    test(`${tool} tool activates without runtime errors`, async ({ page }) => {
      const errors: string[] = [];

      page.on("pageerror", (e) => errors.push(e.message));

      // HeroUI ToggleButtonGroup with selectionMode="single" renders as a
      // radiogroup — each tool is a radio, not a button.
      await page
        .getByRole("radio", { name: new RegExp(`^${tool}$`, "i") })
        .first()
        .click();

      await page.waitForTimeout(250);

      // Best-effort: close any modal the tool opened (signature draws one).
      await page.keyboard.press("Escape").catch(() => {});

      expect(errors, `pageerror after activating ${tool}`).toEqual([]);
    });
  }
});
