import { expect, test } from "@playwright/test";

import {
  addAllFabricCanaries,
  verifyCanaryLayers,
} from "../../helpers/canary-layers";
import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

/**
 * Kitchen-sink: signed-out user adds every fabric-layer type, waits
 * for the `useSignedOutAutoPersist` IDB snapshot debounce, hard-
 * refreshes. All canaries must be back on the canvas via
 * `PendingEditorFileHydrator` Step 2 restore.
 *
 * Watermark + background-image configs live in Zustand and DO NOT
 * currently persist for signed-out users across a hard-refresh
 * (they're not in the IDB pending record). That's a known gap and
 * the spec asserts only what IDB actually stores today. If a future
 * change adds them to the pending record, extend the assertions.
 */

// Signed-out — no storage state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("PDF editor — signed-out reload preserves fabric edits", () => {
  test("all fabric-layer canaries survive a hard reload via IDB rehydrate", async ({
    page,
  }) => {
    await openSamplePdfInEditor(page);
    await waitForPdfReady(page);
    await page.waitForFunction(
      () => Boolean(window.__PDF_EDITOR_TEST__?.fabricCanvas),
      undefined,
      { timeout: 15_000 },
    );

    await addAllFabricCanaries(page);

    // Wait for the debounced IDB snapshot (useSignedOutAutoPersist
    // IDLE_DEBOUNCE_MS = 800). 1500ms buffer.
    await page.waitForTimeout(1500);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForPdfReady(page);
    await page.waitForFunction(
      () => Boolean(window.__PDF_EDITOR_TEST__?.fabricCanvas),
      undefined,
      { timeout: 15_000 },
    );

    // Fabric mount effect awaits document.fonts.ready — buffer.
    await page.waitForTimeout(500);

    const restored = await verifyCanaryLayers(page);

    expect(restored.hasCanaryShape, "shape lost across signed-out reload").toBe(
      true,
    );
    expect(restored.hasCanaryText, "text lost across signed-out reload").toBe(
      true,
    );
    expect(
      restored.hasCanaryDraw,
      "drawing lost across signed-out reload",
    ).toBe(true);
    expect(
      restored.hasCanaryHighlight,
      "highlight lost across signed-out reload",
    ).toBe(true);
    expect(
      restored.hasCanarySignature,
      "signature lost across signed-out reload",
    ).toBe(true);
    expect(
      restored.hasCanaryImage,
      "user image lost across signed-out reload",
    ).toBe(true);
    expect(
      restored.hasCanaryPageNumber,
      "page number lost across signed-out reload",
    ).toBe(true);
  });
});
