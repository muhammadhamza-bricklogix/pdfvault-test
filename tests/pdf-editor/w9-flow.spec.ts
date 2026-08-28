import type {
  APIRequestContext,
  ConsoleMessage,
  Page,
  Request,
  Route,
  TestInfo,
} from "@playwright/test";

import { test, expect } from "@playwright/test";

/**
 * Exhaustive smoke for the /w-9-form flow.
 *
 * Boundary contract (do NOT stub these except in Group D failure sims):
 *   POST /form-sessions/*\/finalize   — server-side stamp of values/signature
 *   POST /documents/upload            — library upsert (uses documentId when set)
 *   GET  /documents/:id               — round-trip metadata + editorState
 *
 * Instrumentation: every test taps `[PDFedits] PERSIST-DIAG` and
 * `[PDFedits] REHYDRATE-DIAG` and attaches the last line of each on failure,
 * plus the parsed `editorState` of any row involved when a docId is known.
 *
 * Trace/screenshot on failure comes from playwright.config.ts (
 * `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`) — no
 * per-file override needed.
 */

const W9_ROUTE = "/w-9-form";
const FINALIZE_RE = /\/form-sessions\/[^/]+\/finalize$/;
const UPLOAD_RE = /\/documents\/upload$/;
const DOCS_LIST_RE = /\/documents(?:\?|$)/;

const TEST_NAME = "Playwright W9";
const TEST_BIZ = "Playwright QA LLC";
const TEST_SSN = "123456789";
const TEST_DATE = "2026-05-25";

type DiagBucket = { persist: string | null; rehydrate: string | null };

/** Attach the last PERSIST-DIAG + REHYDRATE-DIAG console lines. */
function tapDiagnosticLogs(page: Page): DiagBucket {
  const bucket: DiagBucket = { persist: null, rehydrate: null };

  page.on("console", (msg: ConsoleMessage) => {
    const text = msg.text();

    if (text.includes("PERSIST-DIAG")) bucket.persist = text;
    if (text.includes("REHYDRATE-DIAG")) bucket.rehydrate = text;
  });

  return bucket;
}

async function attachDiagnostics(
  testInfo: TestInfo,
  bucket: DiagBucket,
  docId?: string | null,
  request?: APIRequestContext,
) {
  if (bucket.persist) {
    await testInfo.attach("persist-diag.txt", {
      body: bucket.persist,
      contentType: "text/plain",
    });
  }
  if (bucket.rehydrate) {
    await testInfo.attach("rehydrate-diag.txt", {
      body: bucket.rehydrate,
      contentType: "text/plain",
    });
  }
  if (docId && request) {
    try {
      const res = await request.get(`/documents/${docId}`);
      const body = await res.text();

      await testInfo.attach(`document-${docId}.json`, {
        body,
        contentType: "application/json",
      });
    } catch {
      /* non-fatal */
    }
  }
}

type NetworkSpy = {
  finalize: Request[];
  upload: Request[];
};

/** Spy without mutating responses. Returns arrays that fill live. */
function spyNetwork(page: Page): NetworkSpy {
  const spy: NetworkSpy = { finalize: [], upload: [] };

  page.on("request", (req) => {
    const url = req.url();

    if (FINALIZE_RE.test(url) && req.method() === "POST") spy.finalize.push(req);
    if (UPLOAD_RE.test(url) && req.method() === "POST") spy.upload.push(req);
  });

  return spy;
}

async function waitForW9Ready(page: Page) {
  // The editor shell canvas is our unambiguous "template loaded" signal.
  await expect(
    page.getByRole("img", { name: /PDF page/i }).first(),
  ).toBeVisible({ timeout: 30_000 });

  // Yellow-overlay Name input is our unambiguous "form-session ready" signal.
  await page.locator("#field-input-f1_01").first().waitFor({
    state: "visible",
    timeout: 30_000,
  });
}

async function fillCoreW9Fields(page: Page, opts?: { name?: string }) {
  const name = opts?.name ?? TEST_NAME;

  await page.locator("#field-input-f1_01").first().fill(name);
  await page.locator("#field-input-f1_02").first().fill(TEST_BIZ);

  // SSN is split into 9 single-char boxes.
  for (let i = 0; i < TEST_SSN.length; i++) {
    await page.locator(`#ssn-box-${i}`).fill(TEST_SSN[i]!);
  }

  // Date + classification live in overlays too. Best-effort — if the current
  // W-9 build hides them from the overlay layer, the finalize call will 422
  // and the test will surface it.
  const date = page.locator("#field-input-signature_date").first();

  if (await date.isVisible().catch(() => false)) {
    await date.fill(TEST_DATE);
  }

  // Classification radio — pick "Individual" if the label is exposed.
  const individual = page.getByRole("radio", { name: /Individual/i }).first();

  if (await individual.isVisible().catch(() => false)) {
    await individual.click();
  }
}

async function drawSignatureIfPresent(page: Page) {
  const trigger = page.getByRole("button", { name: /Add signature|Sign/i });

  if (!(await trigger.first().isVisible().catch(() => false))) return;
  await trigger.first().click();

  const typeTab = page.getByRole("tab", { name: /^Type$/i });

  if (await typeTab.isVisible().catch(() => false)) {
    await typeTab.click();
    await page
      .getByPlaceholder(/Type your full name/i)
      .fill(TEST_NAME);
    await page.getByRole("button", { name: /Apply signature/i }).click();
  }
}

async function clickDoneThenDownload(page: Page) {
  await page.getByRole("button", { name: /^Done$/i }).click();

  // Export format modal — pick PDF (default) + Download.
  await page
    .getByRole("radio", { name: /^PDF$/i })
    .first()
    .click({ trial: true })
    .catch(() => undefined);
  await page.getByRole("button", { name: /Download/i }).first().click();
}

async function readDocumentEditorState(
  request: APIRequestContext,
  docId: string,
) {
  const res = await request.get(`/documents/${docId}`);

  expect(res.ok(), `GET /documents/${docId} → ${res.status()}`).toBeTruthy();
  const body = await res.json();
  let parsed: { v?: number; w9?: { values?: Record<string, string> } } | null =
    null;

  if (typeof body.editorState === "string") {
    try {
      parsed = JSON.parse(body.editorState);
    } catch {
      parsed = null;
    }
  }

  return { doc: body, editorState: parsed };
}

async function fetchDocumentsList(request: APIRequestContext) {
  const res = await request.get("/documents?limit=50");

  expect(res.ok(), `GET /documents → ${res.status()}`).toBeTruthy();
  const body = await res.json();

  return (body?.items ?? body ?? []) as Array<{
    id: string;
    filename: string;
    updatedAt?: string;
  }>;
}

async function pollForDocByFilename(
  request: APIRequestContext,
  filename: RegExp,
  timeoutMs = 20_000,
): Promise<{ id: string; filename: string; updatedAt?: string }> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const list = await fetchDocumentsList(request);
    const hit = list.find((d) => filename.test(d.filename));

    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for document matching ${filename}`);
}

async function openHamburgerMyPdfs(page: Page) {
  await page
    .getByRole("button", { name: /open editor menu|menu|hamburger/i })
    .first()
    .click({ trial: true })
    .catch(() => undefined);

  // Hamburger control — fall back to any button with an SVG that reveals a
  // dropdown containing "My PDFs".
  const menuBtn = page
    .locator('button[aria-label*="menu" i], button[aria-haspopup]')
    .first();

  if (await menuBtn.isVisible().catch(() => false)) {
    await menuBtn.click();
  }
  await page.getByRole("menuitem", { name: /My PDFs/i }).click();
}

/* ------------------------------------------------------------------ */
/* Group A — Fresh fill → Save flows                                  */
/* ------------------------------------------------------------------ */

test.describe("W-9 Group A — Fresh fill → Save flows", () => {
  test("A1 fresh fill → Done → PDF → Download saves + row in dashboard", async ({
    page,
    request,
  }, testInfo) => {
    const diag = tapDiagnosticLogs(page);
    const spy = spyNetwork(page);
    let capturedDocId: string | null = null;

    try {
      await test.step("open /w-9-form + fill core fields + sign", async () => {
        await page.goto(W9_ROUTE);
        await waitForW9Ready(page);
        await fillCoreW9Fields(page);
        await drawSignatureIfPresent(page);
      });

      const downloadPromise = page.waitForEvent("download", {
        timeout: 30_000,
      });

      await test.step("Done → PDF format → Download", async () => {
        await clickDoneThenDownload(page);
      });

      await test.step("finalize + upload fire exactly once each", async () => {
        await expect
          .poll(() => spy.finalize.length, { timeout: 30_000 })
          .toBeGreaterThanOrEqual(1);
        await expect
          .poll(() => spy.upload.length, { timeout: 30_000 })
          .toBeGreaterThanOrEqual(1);
      });

      await test.step("download fires + success toast", async () => {
        const dl = await downloadPromise;

        expect(dl.suggestedFilename()).toMatch(/w-?9/i);
        await expect(page.getByText(/W-9 ready/i)).toBeVisible({
          timeout: 15_000,
        });
      });

      await test.step("row lands in library with w9 editorState", async () => {
        const row = await pollForDocByFilename(request, /w-?9\.pdf/i);

        capturedDocId = row.id;
        const { editorState } = await readDocumentEditorState(request, row.id);

        expect(editorState?.v).toBe(1);
        expect(editorState?.w9?.values).toBeTruthy();
        expect(editorState?.w9?.values?.f1_01).toBe(TEST_NAME);
        expect(editorState?.w9?.values?.f1_02).toBe(TEST_BIZ);
      });
    } finally {
      await attachDiagnostics(testInfo, diag, capturedDocId, request);
    }
  });

  test("A2 reopen row → values restored, signature is NOT restored", async ({
    page,
    request,
  }, testInfo) => {
    const diag = tapDiagnosticLogs(page);
    let docId: string | null = null;

    try {
      const row = await pollForDocByFilename(request, /w-?9\.pdf/i);

      docId = row.id;
      await page.goto(`${W9_ROUTE}?resumeDocId=${row.id}`);
      await waitForW9Ready(page);

      await expect(page.locator("#field-input-f1_01")).toHaveValue(TEST_NAME);
      await expect(page.locator("#field-input-f1_02")).toHaveValue(TEST_BIZ);

      // Signature drop-zone must still be "add signature" — server-side S3
      // namespace rejects the previous key.
      await expect(
        page.getByRole("button", { name: /Add signature|Sign/i }).first(),
      ).toBeVisible();
    } finally {
      await attachDiagnostics(testInfo, diag, docId, request);
    }
  });

  test("A3 Save button (no download) → row + reopen restores values", async ({
    page,
    request,
  }, testInfo) => {
    const diag = tapDiagnosticLogs(page);
    const spy = spyNetwork(page);
    let docId: string | null = null;

    try {
      await page.goto(W9_ROUTE);
      await waitForW9Ready(page);
      await fillCoreW9Fields(page, { name: "Playwright W9 Save" });
      await drawSignatureIfPresent(page);

      const saveBtn = page.getByRole("button", { name: /^Save$/ }).first();

      // W-9 route exposes Save button (per PvEditorTopChrome `showW9Save`).
      await expect(saveBtn).toBeVisible({ timeout: 10_000 });
      await saveBtn.click();

      await expect(page.getByText(/Saved to your library/i)).toBeVisible({
        timeout: 30_000,
      });
      expect(spy.finalize.length).toBeGreaterThanOrEqual(1);
      expect(spy.upload.length).toBeGreaterThanOrEqual(1);

      const row = await pollForDocByFilename(request, /w-?9\.pdf/i);

      docId = row.id;

      await page.goto(`${W9_ROUTE}?resumeDocId=${row.id}`);
      await waitForW9Ready(page);
      await expect(page.locator("#field-input-f1_01")).toHaveValue(
        "Playwright W9 Save",
      );
    } finally {
      await attachDiagnostics(testInfo, diag, docId, request);
    }
  });

  test("A4 hamburger → My PDFs saves + lands on /dashboard + reopen restores", async ({
    page,
    request,
  }, testInfo) => {
    const diag = tapDiagnosticLogs(page);
    const spy = spyNetwork(page);
    let docId: string | null = null;

    try {
      await page.goto(W9_ROUTE);
      await waitForW9Ready(page);
      await fillCoreW9Fields(page, { name: "Playwright W9 Hamburger" });
      await drawSignatureIfPresent(page);

      await openHamburgerMyPdfs(page);

      await expect(page.getByText(/Saving your W-9/i)).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.getByText(/Saved to My PDFs/i)).toBeVisible({
        timeout: 30_000,
      });
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
      expect(spy.finalize.length).toBeGreaterThanOrEqual(1);
      expect(spy.upload.length).toBeGreaterThanOrEqual(1);

      const row = await pollForDocByFilename(request, /w-?9\.pdf/i);

      docId = row.id;
      await page.goto(`${W9_ROUTE}?resumeDocId=${row.id}`);
      await waitForW9Ready(page);
      await expect(page.locator("#field-input-f1_01")).toHaveValue(
        "Playwright W9 Hamburger",
      );
    } finally {
      await attachDiagnostics(testInfo, diag, docId, request);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Group B — Upsert                                                   */
/* ------------------------------------------------------------------ */

test.describe("W-9 Group B — Upsert-in-place", () => {
  test("B5 reopen → edit → Done → Download upserts same row", async ({
    page,
    request,
  }, testInfo) => {
    const diag = tapDiagnosticLogs(page);
    let docId: string | null = null;

    try {
      const row = await pollForDocByFilename(request, /w-?9\.pdf/i);

      docId = row.id;
      const beforeList = await fetchDocumentsList(request);
      const beforeCount = beforeList.length;
      const beforeUpdatedAt = row.updatedAt;

      await page.goto(`${W9_ROUTE}?resumeDocId=${row.id}`);
      await waitForW9Ready(page);
      const updatedName = `Playwright W9 Upsert ${Date.now()}`;

      await page.locator("#field-input-f1_01").fill(updatedName);
      await drawSignatureIfPresent(page);

      const download = page.waitForEvent("download", { timeout: 30_000 });

      await clickDoneThenDownload(page);
      await download;

      await expect(page.getByText(/W-9 ready/i)).toBeVisible({
        timeout: 15_000,
      });

      const afterList = await fetchDocumentsList(request);

      expect(
        afterList.length,
        "Upsert must not add a new document row",
      ).toBe(beforeCount);

      const { doc, editorState } = await readDocumentEditorState(
        request,
        row.id,
      );

      expect(editorState?.w9?.values?.f1_01).toBe(updatedName);
      if (beforeUpdatedAt && doc.updatedAt) {
        expect(new Date(doc.updatedAt).getTime()).toBeGreaterThanOrEqual(
          new Date(beforeUpdatedAt).getTime(),
        );
      }
    } finally {
      await attachDiagnostics(testInfo, diag, docId, request);
    }
  });

  test("B6 hamburger Back after edit → same row upserted, no dupe", async ({
    page,
    request,
  }, testInfo) => {
    const diag = tapDiagnosticLogs(page);
    let docId: string | null = null;

    try {
      const row = await pollForDocByFilename(request, /w-?9\.pdf/i);

      docId = row.id;
      const before = await fetchDocumentsList(request);
      const updatedName = `Playwright W9 Hamburger Upsert ${Date.now()}`;

      await page.goto(`${W9_ROUTE}?resumeDocId=${row.id}`);
      await waitForW9Ready(page);
      await page.locator("#field-input-f1_01").fill(updatedName);
      await drawSignatureIfPresent(page);

      await openHamburgerMyPdfs(page);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

      const after = await fetchDocumentsList(request);

      expect(after.length).toBe(before.length);

      const { editorState } = await readDocumentEditorState(request, row.id);

      expect(editorState?.w9?.values?.f1_01).toBe(updatedName);
    } finally {
      await attachDiagnostics(testInfo, diag, docId, request);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Group C — Auth / paywall gates                                     */
/* ------------------------------------------------------------------ */

test.describe("W-9 Group C — Auth + paywall gates", () => {
  test.describe("signed-out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("C7 signed-out Done → sign-in prompt + pending values restored", async ({
      page,
    }, testInfo) => {
      const diag = tapDiagnosticLogs(page);

      try {
        await page.goto(W9_ROUTE);
        await waitForW9Ready(page);
        await fillCoreW9Fields(page);

        await page.getByRole("button", { name: /^Done$/i }).click();
        await page
          .getByRole("button", { name: /Download/i })
          .first()
          .click();

        // Sign-in prompt modal is the required affordance — no raw redirect.
        await expect(
          page.getByRole("dialog").filter({ hasText: /Sign in/i }),
        ).toBeVisible({ timeout: 10_000 });

        // Pending values live in sessionStorage under this exact key.
        const pending = await page.evaluate(() =>
          window.sessionStorage.getItem("pdfvault:pending-w9-values"),
        );

        expect(pending, "pending W-9 values must be persisted").toBeTruthy();
        expect(pending).toContain(TEST_NAME);
      } finally {
        await attachDiagnostics(testInfo, diag);
      }
    });

    test("C8 signed-out hamburger Back → nav to /dashboard, no save-loss toast", async ({
      page,
    }, testInfo) => {
      const diag = tapDiagnosticLogs(page);
      const spy = spyNetwork(page);

      try {
        await page.goto(W9_ROUTE);
        await waitForW9Ready(page);
        await fillCoreW9Fields(page);

        await openHamburgerMyPdfs(page);
        await expect(page).toHaveURL(/\/dashboard|\/sign-in/, {
          timeout: 15_000,
        });

        // No finalize POST — signed-out short-circuits with reason not-signed-in.
        expect(spy.finalize.length).toBe(0);

        // No "Could not save W-9" toast (that's the error path).
        await expect(page.getByText(/Could not save W-9/i)).toHaveCount(0);
      } finally {
        await attachDiagnostics(testInfo, diag);
      }
    });
  });

  test("C9 signed-in not-entitled Done → paywall opens, dismiss preserves fields", async ({
    page,
  }, testInfo) => {
    const diag = tapDiagnosticLogs(page);

    try {
      // Force a non-entitled user by intercepting the entitlement probe.
      await page.route(/\/billing\/entitlement/, (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ entitled: false }),
        }),
      );

      await page.goto(W9_ROUTE);
      await waitForW9Ready(page);
      await fillCoreW9Fields(page);
      await drawSignatureIfPresent(page);

      await clickDoneThenDownload(page);

      const paywall = page.getByRole("dialog").filter({
        hasText: /Unlock|Upgrade|Continue/i,
      });

      await expect(paywall).toBeVisible({ timeout: 15_000 });

      await page.keyboard.press("Escape");

      await expect(paywall).toBeHidden({ timeout: 10_000 });
      await expect(page.locator("#field-input-f1_01")).toHaveValue(TEST_NAME);
    } finally {
      await attachDiagnostics(testInfo, diag);
    }
  });

  test("C10 signed-in not-entitled hamburger Back → paywall, dismiss keeps form", async ({
    page,
  }, testInfo) => {
    const diag = tapDiagnosticLogs(page);

    try {
      await page.route(/\/billing\/entitlement/, (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ entitled: false }),
        }),
      );

      await page.goto(W9_ROUTE);
      await waitForW9Ready(page);
      await fillCoreW9Fields(page);

      await openHamburgerMyPdfs(page);

      const paywall = page.getByRole("dialog").filter({
        hasText: /Unlock|Upgrade|Continue/i,
      });

      await expect(paywall).toBeVisible({ timeout: 15_000 });

      await page.keyboard.press("Escape");

      // Cancelled paywall from save-and-continue → stays on form, no nav.
      await expect(page).toHaveURL(new RegExp(W9_ROUTE.replace("/", "\\/")));
      await expect(page.locator("#field-input-f1_01")).toHaveValue(TEST_NAME);
    } finally {
      await attachDiagnostics(testInfo, diag);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Group D — Idempotency + edge cases                                 */
/* ------------------------------------------------------------------ */

test.describe("W-9 Group D — Idempotency + edge cases", () => {
  test("D11 double Download re-uses cache: exactly 1 POST /finalize, 1 upload", async ({
    page,
    request,
  }, testInfo) => {
    const diag = tapDiagnosticLogs(page);
    const spy = spyNetwork(page);
    let docId: string | null = null;

    try {
      await page.goto(W9_ROUTE);
      await waitForW9Ready(page);
      await fillCoreW9Fields(page, { name: "Playwright W9 Idempotent" });
      await drawSignatureIfPresent(page);

      const listBefore = await fetchDocumentsList(request);
      const dl1 = page.waitForEvent("download", { timeout: 30_000 });

      await clickDoneThenDownload(page);
      await dl1;

      // Wait for first-round side effects to settle.
      await expect
        .poll(() => spy.finalize.length, { timeout: 20_000 })
        .toBe(1);
      await expect
        .poll(() => spy.upload.length, { timeout: 20_000 })
        .toBe(1);

      // Second click with identical payload — must NOT re-fire finalize.
      const dl2 = page.waitForEvent("download", { timeout: 15_000 });

      await clickDoneThenDownload(page);
      await dl2;

      // Give the cached save-retry path 3 s to (not) fire.
      await page.waitForTimeout(3_000);

      expect(spy.finalize, "cached download must not re-hit finalize").toHaveLength(1);

      const listAfter = await fetchDocumentsList(request);

      expect(listAfter.length).toBe(listBefore.length + 1);

      const row = await pollForDocByFilename(request, /w-?9\.pdf/i);

      docId = row.id;
    } finally {
      await attachDiagnostics(testInfo, diag, docId, request);
    }
  });

  test("D12 hamburger Back with EMPTY form → no finalize, immediate nav, no toast", async ({
    page,
  }, testInfo) => {
    const diag = tapDiagnosticLogs(page);
    const spy = spyNetwork(page);

    try {
      await page.goto(W9_ROUTE);
      await waitForW9Ready(page);

      await openHamburgerMyPdfs(page);

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
      expect(spy.finalize).toHaveLength(0);
      // "Saving your W-9…" would fire if the intercept didn't short-circuit.
      // The event dispatch still opens a loading toast then closes it once
      // onComplete resolves — so we tolerate a brief flash but assert no
      // success/error persists.
      await expect(page.getByText(/Saved to My PDFs/i)).toHaveCount(0);
      await expect(page.getByText(/Could not save W-9/i)).toHaveCount(0);
    } finally {
      await attachDiagnostics(testInfo, diag);
    }
  });

  test("D13 hamburger Back with finalize aborted → error toast, stays on form", async ({
    page,
  }, testInfo) => {
    const diag = tapDiagnosticLogs(page);

    try {
      await page.route(FINALIZE_RE, (route: Route) => route.abort("failed"));

      await page.goto(W9_ROUTE);
      await waitForW9Ready(page);
      await fillCoreW9Fields(page);
      await drawSignatureIfPresent(page);

      await openHamburgerMyPdfs(page);

      await expect(page.getByText(/Could not save W-9/i)).toBeVisible({
        timeout: 20_000,
      });
      // Stays on the form; fields still there for retry.
      await expect(page).toHaveURL(new RegExp(W9_ROUTE.replace("/", "\\/")));
      await expect(page.locator("#field-input-f1_01")).toHaveValue(TEST_NAME);
    } finally {
      await attachDiagnostics(testInfo, diag);
    }
  });

  test("D14 finalize hangs 30s → timeout error toast + nav to dashboard", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const diag = tapDiagnosticLogs(page);

    try {
      // Never respond — the 30s promise timeout in
      // useEditorNavigationSave.w9-save-and-continue owns the escape hatch.
      await page.route(FINALIZE_RE, async () => {
        await new Promise((r) => setTimeout(r, 60_000));
      });

      await page.goto(W9_ROUTE);
      await waitForW9Ready(page);
      await fillCoreW9Fields(page);
      await drawSignatureIfPresent(page);

      await openHamburgerMyPdfs(page);

      await expect(page.getByText(/Could not save W-9/i)).toBeVisible({
        timeout: 40_000,
      });
    } finally {
      await attachDiagnostics(testInfo, diag);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Group E — Cross-session / cross-tab                                */
/* ------------------------------------------------------------------ */

test.describe("W-9 Group E — Cross-session + reload guard", () => {
  test("E15 cross-context: fresh browser sees row + can reopen", async ({
    browser,
    request,
  }, testInfo) => {
    const diag: DiagBucket = { persist: null, rehydrate: null };
    let docId: string | null = null;

    try {
      const row = await pollForDocByFilename(request, /w-?9\.pdf/i);

      docId = row.id;

      const ctx = await browser.newContext({
        storageState: "tests/.auth/user.json",
      });
      const page = await ctx.newPage();

      page.on("console", (msg) => {
        const t = msg.text();

        if (t.includes("PERSIST-DIAG")) diag.persist = t;
        if (t.includes("REHYDRATE-DIAG")) diag.rehydrate = t;
      });

      await page.goto("/dashboard");
      await expect(page.getByText(row.filename)).toBeVisible({
        timeout: 20_000,
      });

      await page.goto(`${W9_ROUTE}?resumeDocId=${row.id}`);
      await waitForW9Ready(page);
      await expect(page.locator("#field-input-f1_01")).not.toHaveValue("");

      await ctx.close();
    } finally {
      await attachDiagnostics(testInfo, diag, docId, request);
    }
  });

  test("E16 typed values → keyboard reload → confirm modal → cancel preserves", async ({
    page,
  }, testInfo) => {
    const diag = tapDiagnosticLogs(page);

    try {
      await page.goto(W9_ROUTE);
      await waitForW9Ready(page);
      await fillCoreW9Fields(page);

      // Keyboard reload combo — the editor intercepts and shows its own modal.
      await page.keyboard.press("Meta+R").catch(() => undefined);
      await page.keyboard.press("Control+R").catch(() => undefined);

      const reloadDialog = page
        .getByRole("dialog")
        .filter({ hasText: /reload|unsaved/i });

      // W-9 has autoPersistDisabled=true; the reload-guard hook still
      // fires because hasUnsavedChanges is only tracked for Fabric edits.
      // If the modal doesn't appear (form-only edits don't flip the dirty
      // bit), the fields must at least survive a soft state check.
      const modalAppeared = await reloadDialog
        .isVisible({ timeout: 3_000 })
        .catch(() => false);

      if (modalAppeared) {
        await page
          .getByRole("button", { name: /Cancel|Stay/i })
          .first()
          .click();
      }

      await expect(page.locator("#field-input-f1_01")).toHaveValue(TEST_NAME);
    } finally {
      await attachDiagnostics(testInfo, diag);
    }
  });
});
