import { expect, test } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

/**
 * Regression: user types in a Textbox and clicks the logo (or Back / My
 * PDFs) WITHOUT clicking outside the text box first. The just-typed
 * characters must survive the save.
 *
 * Root cause of the shipped bug (PR #68, 2026-09-10): when the click
 * lands on the logo (a header button OUTSIDE the canvas root), Fabric's
 * own document-level click listener never fires `editing:exited` for
 * the canvas — so the just-typed chars stay in the live Textbox but
 * never propagate to `fabricJsonByPage` before the cloud upload.
 * Fix mirrored the `useSaveEditor.onSaveBeforeAction` block into
 * `useEditorNavigationSave.onNavigateAfterSave`: force-exit editing
 * + `flushLiveFabricPage` before `persistEditorDocument`.
 *
 * Spec dispatches `editor:navigate-after-save` directly (same event
 * that the logo / Back / My PDFs buttons dispatch) so it exercises
 * the exact code path without depending on the header layout.
 */

test.describe("PDF editor — logo click while mid-typing saves latest characters", () => {
  test("Textbox in edit mode → editor:navigate-after-save force-exits editing + flushes", async ({
    page,
  }) => {
    await page.route(
      (url) => url.pathname.endsWith("/documents/upload"),
      async (route) => {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "canary-doc-mid-typing",
            filename: "sample.pdf",
            contentType: "application/pdf",
            url: "https://example.invalid/canary.pdf",
            editorState: null,
            originalContentType: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      },
    );

    await openSamplePdfInEditor(page);
    await waitForPdfReady(page);

    await page.waitForFunction(
      () => Boolean(window.__PDF_EDITOR_TEST__?.fabricCanvas),
      undefined,
      { timeout: 15_000 },
    );

    // Add a Textbox and put it in editing mode with a canary phrase.
    // We simulate a mid-typing state by NOT firing editing:exited —
    // the text lives ONLY on the live Fabric object at this point.
    // A pre-save flush is the ONLY thing that captures it.
    await page.evaluate(async () => {
      const fc = window.__PDF_EDITOR_TEST__!.fabricCanvas;

      if (!fc) throw new Error("fabricCanvas missing at test entry");

      const fabric = await import("fabric");
      const text = new fabric.Textbox("MID-TYPING-CANARY", {
        left: 200,
        top: 200,
        fontSize: 20,
        fill: "#000000",
        width: 320,
        splitByGrapheme: true,
      });

      fc.add(text);
      fc.setActiveObject(text);
      (
        text as unknown as { enterEditing?: () => void }
      ).enterEditing?.();
      // Note: intentionally NOT firing editing:exited. This mirrors the
      // real bug scenario where the user clicks a header button while
      // the textbox is still in edit mode.
      fc.requestRenderAll();
    });

    // Verify the live Textbox is in edit mode BEFORE we fire the nav-save.
    const preNavState = await page.evaluate(() => {
      const fc = window.__PDF_EDITOR_TEST__!.fabricCanvas;
      const active = fc?.getActiveObject() as
        | { isEditing?: boolean; text?: string }
        | null;

      return {
        isEditing: Boolean(active?.isEditing),
        text: active?.text ?? null,
      };
    });

    expect(preNavState.isEditing, "textbox should be in editing mode").toBe(
      true,
    );
    expect(preNavState.text).toBe("MID-TYPING-CANARY");

    // Fire the exact event the logo button dispatches. `force: true`
    // is set because logo click sets it to bypass the "no changes"
    // short-circuit.
    const uploadResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/documents/upload"),
    );

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("editor:navigate-after-save", {
          detail: {
            url: "/dashboard",
            clearFileAfter: false, // don't wipe store so we can assert on it
            force: true,
          },
        }),
      );
    });

    await uploadResponsePromise;

    // Assertion: fabricJsonByPage for the current page must contain the
    // Textbox with "MID-TYPING-CANARY" — proves the pre-save flush ran
    // AND captured the mid-editing state.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const store = window.__PDF_EDITOR_TEST__!.getStore();
            const json = store.fabricJsonByPage.get(store.currentPage);

            if (!json) return null;

            const parsed = JSON.parse(json) as {
              objects?: Array<{ text?: string; type?: string }>;
            };
            const objs = parsed.objects ?? [];

            return objs.some((o) => o.text === "MID-TYPING-CANARY");
          }),
        { timeout: 10_000 },
      )
      .toBe(true);
  });
});
