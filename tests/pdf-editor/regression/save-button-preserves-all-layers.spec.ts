import { expect, test } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

/**
 * Regression: signed-in user clicks the Save button and every layer they
 * added (shape + text + drawing path) survives the save round-trip.
 *
 * We stub the backend `POST /documents/upload` response so this spec is
 * deterministic and doesn't create a real doc row in the test user's
 * library on every run. The stub returns a plausible `Document` payload
 * so `applyPostSaveReset` fires cleanly (swaps `store.file` to the
 * "saved bytes" and marks `hasUnsavedChanges: false`) — that's the
 * client-side surface this spec guards.
 *
 * Failure signals to the user (all of them are real regressions we
 * shipped and fixed this month):
 *   • Save button pressed → nothing uploaded (persistEditorDocument
 *     short-circuited on a stale `hasUnsavedChanges: false`).
 *   • Save uploaded stale bytes (flushLiveFabricPage skipped, live
 *     canvas not flushed to fabricJsonByPage).
 *   • `applyPostSaveReset` failed to fire → store.hasUnsavedChanges
 *     stays true → next save loops with duplicated overlays.
 */

test.describe("PDF editor — Save button preserves all layers", () => {
  test("shape + textbox + drawing survive Save button + applyPostSaveReset", async ({
    page,
  }) => {
    // Stub the backend so this spec doesn't hit prod / staging and
    // doesn't need a running backend. `POST /documents/upload` must
    // return a Document shape with id, filename, url etc.; the
    // relevant fields for the client's applyPostSaveReset flow are
    // just `id` + `filename`, but we return a fuller shape so any
    // downstream consumer (SaveStatusChip, etc.) doesn't crash on a
    // missing field.
    await page.route(
      (url) => url.pathname.endsWith("/documents/upload"),
      async (route) => {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "canary-doc-id-regression",
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

    // Add three canary overlays via the test harness. Each carries a
    // unique `editorType` so the post-save assertion can spot them
    // even if their spatial coords drift by 1-2 pt due to Fabric
    // internals.
    await page.evaluate(async () => {
      const fc = window.__PDF_EDITOR_TEST__!.fabricCanvas;

      if (!fc) throw new Error("fabricCanvas missing at test entry");

      const fabric = await import("fabric");
      const rect = new fabric.Rect({
        left: 200,
        top: 200,
        width: 100,
        height: 60,
        fill: "red",
      });

      (rect as unknown as { editorType?: string }).editorType = "canaryRect";

      const text = new fabric.Textbox("REGRESSION-CANARY-SAVE", {
        left: 200,
        top: 320,
        fontSize: 20,
        fill: "#000000",
        width: 320,
        splitByGrapheme: true,
      });

      (text as unknown as { editorType?: string }).editorType = "canaryText";

      const path = new fabric.Path("M 50 50 L 150 100 L 250 50 L 350 100", {
        stroke: "#333333",
        strokeWidth: 3,
        fill: "",
      });

      (path as unknown as { editorType?: string }).editorType = "canaryDraw";

      fc.add(rect);
      fc.add(text);
      fc.add(path);
      // Fire object:added so use-editor-history's snapshot handler
      // pushes into fabricJsonByPage — mirrors what real user
      // interactions do when they release a tool click.
      fc.fire("object:added", { target: rect });
      fc.fire("object:added", { target: text });
      fc.fire("object:added", { target: path });
      fc.requestRenderAll();
    });

    // Confirm the flush landed in store BEFORE we fire the save.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const store = window.__PDF_EDITOR_TEST__!.getStore();

            return store.hasUnsavedChanges;
          }),
        { timeout: 5_000 },
      )
      .toBe(true);

    // Fire the Save button's event. Using the CustomEvent bus is
    // more reliable than clicking the button (button position varies
    // between mobile chrome / desktop chrome / W-9 layouts).
    const uploadResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/documents/upload"),
    );

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("editor:save"));
    });

    await uploadResponsePromise;

    // Post-save assertions:
    //   1. `hasUnsavedChanges` must be false (applyPostSaveReset fired).
    //   2. `currentDocumentId` must match the stubbed id.
    //   3. Canary overlays must still be present on the live canvas
    //      (post-save the file swaps but Fabric objects stay in
    //      fabricJsonByPage; the mount effect reloads them).
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const store = window.__PDF_EDITOR_TEST__!.getStore();

            return {
              hasUnsavedChanges: store.hasUnsavedChanges,
              currentDocumentId: store.currentDocumentId,
            };
          }),
        { timeout: 10_000 },
      )
      .toEqual({
        hasUnsavedChanges: false,
        currentDocumentId: "canary-doc-id-regression",
      });

    // Verify the canary overlays are still present in the store's
    // fabric map (readable regardless of Fabric canvas remount timing).
    const overlayCheck = await page.evaluate(() => {
      const store = window.__PDF_EDITOR_TEST__!.getStore();
      const pageJson = store.fabricJsonByPage.get(store.currentPage);

      if (!pageJson) return { found: null };
      const parsed = JSON.parse(pageJson) as {
        objects?: Array<{ editorType?: string; text?: string }>;
      };
      const objs = parsed.objects ?? [];

      return {
        found: {
          canaryRect: objs.some((o) => o.editorType === "canaryRect"),
          canaryText: objs.some(
            (o) =>
              o.editorType === "canaryText" &&
              o.text === "REGRESSION-CANARY-SAVE",
          ),
          canaryDraw: objs.some((o) => o.editorType === "canaryDraw"),
          totalObjects: objs.length,
        },
      };
    });

    expect(overlayCheck.found, "fabricJsonByPage missing after save").not.toBeNull();
    expect(overlayCheck.found!.canaryRect).toBe(true);
    expect(overlayCheck.found!.canaryText).toBe(true);
    expect(overlayCheck.found!.canaryDraw).toBe(true);
    expect(overlayCheck.found!.totalObjects).toBeGreaterThanOrEqual(3);
  });
});
