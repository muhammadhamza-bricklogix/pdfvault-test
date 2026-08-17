import { expect, test } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";

/**
 * UI inventory smoke tests for the refreshed PDF editor chrome. These are
 * breadth-first assertions: each item from the user's inventory is touched,
 * but deep behavior is left to dedicated feature specs.
 */
test.describe("PDF editor — UI inventory", () => {
  test.beforeEach(async ({ page }) => {
    await openSamplePdfInEditor(page);
    await waitForPdfReady(page);
  });

  test.describe("Top App Bar", () => {
    test("hamburger menu opens and lists expected items", async ({ page }) => {
      await page.getByRole("button", { name: "Editor menu" }).click();

      await expect(
        page.getByRole("menuitem", { name: /create new/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("menuitem", { name: /open file/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("menuitem", { name: /my pdfs/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("menuitem", { name: /find and replace/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("menuitem", { name: /version history/i }),
      ).toBeVisible();
    });

    test("PDFVault logo links home", async ({ page }) => {
      const homeLink = page.getByRole("link", { name: /home/i });

      await expect(homeLink).toBeVisible();
      await expect(homeLink).toHaveAttribute("href", "/");
    });

    test("filename is shown", async ({ page }) => {
      // The filename is rendered inside a span with aria-label="Document".
      const docLabel = page.locator('[aria-label="Document"]').first();

      await expect(page.getByText("sample.pdf").first()).toBeVisible();
      await expect(docLabel).toContainText("sample.pdf");
    });

    test("Undo/Redo pill is present", async ({ page }) => {
      await expect(page.getByRole("button", { name: /^undo$/i }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /^redo$/i }).first()).toBeVisible();
    });

    test("Share via link button is present (sign-in gated)", async ({ page }) => {
      const shareButton = page
        .getByRole("button", { name: /share via link/i })
        .first();

      await expect(shareButton).toBeVisible();
      // In local mode the user is signed out, so the action is gated.
      await expect(shareButton).toBeDisabled();
    });

    test("Download dropdown lists all 8 formats", async ({ page }) => {
      await page.getByRole("button", { name: /^download$/i }).first().click();

      const formats = [
        "PDF (.pdf)",
        "Word (.docx)",
        "Excel (.xlsx)",
        "PowerPoint (.pptx)",
        "JPG image",
        "PNG image",
        "HTML",
        "Plain text (.txt)",
      ];

      for (const label of formats) {
        await expect(
          page.getByRole("menuitem", { name: label }).first(),
        ).toBeVisible();
      }
    });
  });

  test.describe("Left Sidebar", () => {
    test("thumbnails are visible and clicking page 2 jumps current page", async ({
      page,
    }) => {
      const thumbnails = page.getByRole("listbox", {
        name: /page thumbnails/i,
      });

      await expect(thumbnails).toBeVisible();
      await expect(page.getByRole("option", { name: /page 2/i })).toBeVisible();

      await page.getByRole("option", { name: /page 2/i }).click();

      await expect(
        page.getByRole("img", { name: /PDF page 2 of 3/i }),
      ).toBeVisible({ timeout: 5_000 });
    });

    test("drag handle exists and current page has active indicator", async ({
      page,
    }) => {
      await expect(
        page.getByLabel(/drag to reorder page 1/i),
      ).toBeVisible();

      const currentThumb = page.getByRole("option", { name: /page 1/i });

      await expect(currentThumb).toHaveAttribute("aria-selected", "true");
    });

    test("Add Page button appends a blank page", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: /^add page$/i }),
      ).toBeVisible();

      await page.getByRole("button", { name: /^add page$/i }).click();

      await expect(
        page.getByRole("option", { name: /page 4/i }),
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        page.getByRole("img", { name: /PDF page 4 of 4/i }),
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe("Right Sidebar (desktop)", () => {
    test("Shapes tool shows shape properties", async ({ page }) => {
      await page.getByRole("button", { name: /^shapes$/i }).first().click();

      await expect(page.getByRole("heading", { name: "Shape" }).first()).toBeVisible({
        timeout: 3_000,
      });
      await expect(page.getByRole("heading", { name: "Background" }).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Stroke" }).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Stroke thickness" }).first()).toBeVisible();
    });

    test("Highlight tool shows highlight color properties", async ({ page }) => {
      await page.getByRole("button", { name: /^highlight$/i }).first().click();

      await expect(
        page.getByRole("heading", { name: "Highlight Color" }).first(),
      ).toBeVisible({ timeout: 3_000 });
      await expect(page.getByLabel(/yellow highlight/i)).toBeVisible();
    });

    test("Watermark tool shows watermark config", async ({ page }) => {
      await page.getByRole("button", { name: /^watermark$/i }).first().click();

      await expect(
        page.getByRole("heading", { name: "Type" }).first(),
      ).toBeVisible({ timeout: 3_000 });
      await expect(
        page.getByRole("textbox", { name: "Watermark text" }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Opacity" }).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Position" }).first()).toBeVisible();
    });

    test("Background tool shows background image config", async ({ page }) => {
      await page.getByRole("button", { name: /^background$/i }).first().click();

      await expect(
        page.getByRole("heading", { name: "Image" }).first(),
      ).toBeVisible({ timeout: 3_000 });
      await expect(
        page.getByRole("button", { name: /upload image/i }).first(),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Fit" }).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Opacity" }).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Pages" }).first()).toBeVisible();
    });
  });

  test.describe("Modals reachable from hamburger/toolbar", () => {
    async function assertOpensWithoutErrors(
      page: import("@playwright/test").Page,
      headingPattern: RegExp,
      opener: () => Promise<void>,
    ) {
      const errors: string[] = [];

      page.on("pageerror", (e) => {
        if (e.message === "Transition was skipped") return;
        errors.push(e.message);
      });

      await opener();
      await expect(
        page.getByRole("heading", { name: headingPattern }).first(),
      ).toBeVisible({ timeout: 6_000 });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);

      expect(errors).toEqual([]);
    }

    test("Create New opens CreatePdfModal", async ({ page }) => {
      await assertOpensWithoutErrors(page, /create.*pdf/i, async () => {
        await page.getByRole("button", { name: "Editor menu" }).click();
        await page.getByRole("menuitem", { name: /create new/i }).click();
      });
    });

    test("Find and Replace opens FindReplaceModal", async ({ page }) => {
      await assertOpensWithoutErrors(page, /find.*replace/i, async () => {
        await page.getByRole("button", { name: "Editor menu" }).click();
        await page.getByRole("menuitem", { name: /find and replace/i }).click();
      });
    });

    test("Compress toolbar button opens CompressModal", async ({ page }) => {
      await assertOpensWithoutErrors(page, /compress pdf/i, async () => {
        await page.getByRole("button", { name: /^compress$/i }).first().click();
      });
    });

    test("Secure toolbar button opens PasswordModal", async ({ page }) => {
      await assertOpensWithoutErrors(page, /password protect/i, async () => {
        await page.getByRole("button", { name: /^secure$/i }).first().click();
      });
    });

    test("Page No toolbar button opens PageNumbersModal", async ({ page }) => {
      await assertOpensWithoutErrors(page, /add page numbers/i, async () => {
        await page.getByRole("button", { name: /^page no$/i }).first().click();
      });
    });

    test("Annotate toolbar button opens AnnotationsModal", async ({ page }) => {
      await assertOpensWithoutErrors(page, /annotations/i, async () => {
        await page.getByRole("button", { name: /^annotate$/i }).first().click();
      });
    });

    test("Split toolbar button still opens SplitPdfModal", async ({ page }) => {
      await assertOpensWithoutErrors(page, /split pdf/i, async () => {
        await page.getByRole("button", { name: /^split$/i }).first().click();
      });
    });
  });

  test.describe("Keyboard shortcuts", () => {
    test("Cmd+F opens Find & Replace", async ({ page }) => {
      await page.keyboard.press("ControlOrMeta+f");

      await expect(
        page.getByRole("heading", { name: /find.*replace/i }).first(),
      ).toBeVisible({ timeout: 4_000 });

      await page.keyboard.press("Escape");
    });

    test("Cmd+Z / Cmd+Y don't crash", async ({ page }) => {
      const errors: string[] = [];

      page.on("pageerror", (e) => errors.push(e.message));

      await page.keyboard.press("ControlOrMeta+z");
      await page.keyboard.press("ControlOrMeta+Shift+z");
      await page.keyboard.press("ControlOrMeta+y");
      await page.waitForTimeout(200);

      expect(errors).toEqual([]);
    });
  });

  test.describe("Save / persistence smoke", () => {
    test("beforeunload prompt fires on unsaved changes", async ({ page }) => {
      // Drive the editor into a dirty state without relying on user gestures.
      await page.evaluate(() => {
        window.__PDF_EDITOR_TEST__?.getStore().markDocumentDirty();
      });

      let dialogType: string | null = null;

      page.once("dialog", async (dialog) => {
        dialogType = dialog.type();
        await dialog.dismiss();
      });

      // Navigation is intentionally aborted by the beforeunload prompt; the
      // dialog is what we care about, so swallow the navigation error.
      await page.goto("/").catch(() => undefined);

      // Give the event handler a moment to fire.
      await page.waitForTimeout(500);
      expect(dialogType).toBe("beforeunload");
    });
  });
});
