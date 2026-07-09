import { test, expect } from "@playwright/test";
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
} from "pdf-lib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EDITED_MARKER = "PDFEDITS_QA_EDITED_";

function armEditTextAndWait(page: import("@playwright/test").Page) {
  return page.waitForFunction(
    () => {
      const store = window.__PDF_EDITOR_TEST__?.getStore();

      if (!store) return false;

      return store.extractedPages.has(
        store.getSourcePageIndex(store.currentPage),
      );
    },
    { timeout: 15_000 },
  );
}

async function replaceFirstEditText(
  page: import("@playwright/test").Page,
  editedText: string,
) {
  await page.evaluate(
    ({ editedText }) => {
      const canvas = window.__PDF_EDITOR_TEST__!.fabricCanvas!;
      const obj = canvas
        .getObjects()
        .find((o) => (o as any).editorType === "editModeText") as any;

      if (!obj) {
        throw new Error("No editModeText overlay found on the canvas");
      }

      canvas.setActiveObject(obj);
      obj.text = editedText;
      obj.setCoords();
      canvas.discardActiveObject();
      canvas.renderAll();
    },
    { editedText },
  );
}

async function exportPdfDownload(
  page: import("@playwright/test").Page,
): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("editor:export", { detail: { format: "pdf" } }),
      )
    ),
  ]);

  const downloadPath = await download.path();

  if (!downloadPath) {
    throw new Error("PDF export download did not produce a file path");
  }

  return downloadPath;
}

test.describe("PDF editor — Edit Text", () => {
  // Export / mocked-save specs do not need a real Clerk session.
  test.use({ storageState: undefined });

  test.describe("Sample PDF (upright pages)", () => {
    test.beforeEach(async ({ page }) => {
      await openSamplePdfInEditor(page);
      await waitForPdfReady(page);
    });

    test("modified source text survives PDF export", async ({ page }) => {
      await page.getByRole("radio", { name: /Edit Text/i }).click();
      await armEditTextAndWait(page);

      const editedText = `${EDITED_MARKER}${Date.now()}`;
      await replaceFirstEditText(page, editedText);

      const liveText = await page.evaluate(() => {
        const canvas = window.__PDF_EDITOR_TEST__!.fabricCanvas!;
        const obj = canvas
          .getObjects()
          .find((o) => (o as any).editorType === "editModeText") as any;

        return obj?.text ?? "";
      });

      expect(liveText).toBe(editedText);

      const downloadPath = await exportPdfDownload(page);
      const stats = fs.statSync(downloadPath);

      expect(stats.size).toBeGreaterThan(1_000);

      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const data = new Uint8Array(fs.readFileSync(downloadPath));
      const doc = await getDocument({ data }).promise;

      expect(doc.numPages).toBe(3);
    });

    test("save uploads merged PDF + editorState with edited text", async ({
      page,
    }) => {
      await page.evaluate(() => {
        window.__PDF_EDITOR_TEST__!.getStore().setIsSignedIn(true);
      });

      await page.getByRole("radio", { name: /Edit Text/i }).click();
      await armEditTextAndWait(page);

      const editedText = `${EDITED_MARKER}SAVE_${Date.now()}`;
      await replaceFirstEditText(page, editedText);

      type Captured = {
        fileBytes: Buffer;
        editorState: string;
      };

      let captured: Captured | null = null;
      const fakeDocument = {
        id: "pdfedits-qa-doc-id",
        filename: "sample.pdf",
        contentType: "application/pdf",
        sizeBytes: 0,
        status: "READY",
        pageCount: 3,
        version: 1,
        url: "http://localhost:3000/fake-doc-url",
        editorState: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await page.route("**/documents/upload", async (route) => {
        const request = route.request();
        const contentType = (await request.headerValue("content-type")) ?? "";
        const body = request.postDataBuffer();

        if (request.method() !== "POST" || !body) {
          await route.continue();

          return;
        }

        const parts = parseMultipart(body, contentType);
        const filePart = parts.file;
        const editorStatePart = parts.editorState;

        if (!filePart || !editorStatePart) {
          await route.continue();

          return;
        }

        captured = {
          fileBytes: filePart.data,
          editorState: editorStatePart.data.toString("utf-8"),
        };

        fakeDocument.sizeBytes = captured.fileBytes.length;

        await route.fulfill({
          body: JSON.stringify(fakeDocument),
          contentType: "application/json",
          status: 200,
        });
      });

      await page.evaluate(() =>
        window.dispatchEvent(new CustomEvent("editor:save")),
      );

      await page.waitForFunction(
        () =>
          window.__PDF_EDITOR_TEST__?.getStore().currentDocumentId ===
          "pdfedits-qa-doc-id",
        { timeout: 15_000 },
      );

      expect(captured).not.toBeNull();

      const parsedState = JSON.parse(captured!.editorState);

      expect(parsedState.v).toBe(1);
      expect(parsedState.extractedPages).toContain(1);

      const page1Json = JSON.parse(parsedState.fabricJsonByPage["1"]);
      const editedObject = page1Json.objects.find(
        (o: any) => o.editorType === "editModeText",
      );

      expect(editedObject).toBeTruthy();
      expect(editedObject.text).toBe(editedText);
      expect(editedObject.originalText).not.toBe(editedText);

      const originalSize = fs.statSync("tests/fixtures/sample.pdf").size;

      expect(captured!.fileBytes.length).toBeGreaterThan(1_000);
      expect(captured!.fileBytes.length).not.toBe(originalSize);
    });
  });

  test.describe("Rotated page edge case", () => {
    const rotatedFixture = path.join(
      __dirname,
      "..",
      "fixtures",
      "rotated-sample.pdf",
    );

    test.beforeEach(async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfPage = pdfDoc.addPage([612, 792]);

      pdfPage.setRotation(degrees(90));

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const { height } = pdfPage.getSize();

      pdfPage.drawText("Rotated editable text", {
        color: rgb(0, 0, 0),
        font,
        size: 24,
        x: 50,
        y: height / 2,
      });

      fs.writeFileSync(rotatedFixture, await pdfDoc.save());
    });

    test("modified source text survives PDF export on rotated pages", async ({
      page,
    }) => {
      await page.goto("/pdf-editor");
      await page.locator('input[type="file"]').setInputFiles(rotatedFixture);
      await waitForPdfReady(page);

      await page.getByRole("radio", { name: /Edit Text/i }).click();
      await armEditTextAndWait(page);

      const editedText = `${EDITED_MARKER}ROT_${Date.now()}`;
      await replaceFirstEditText(page, editedText);

      const downloadPath = await exportPdfDownload(page);
      const stats = fs.statSync(downloadPath);

      expect(stats.size).toBeGreaterThan(1_000);

      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const data = new Uint8Array(fs.readFileSync(downloadPath));
      const doc = await getDocument({ data }).promise;

      expect(doc.numPages).toBe(1);

      const exportedPage = await doc.getPage(1);
      const viewport = exportedPage.getViewport({ scale: 1 });

      // Source was portrait MediaBox 612×792 with /Rotate 90, so pdf.js
      // exposes it as a landscape viewport 792×612. The merge pipeline must
      // keep that same visual orientation in the exported file.
      expect(viewport.width).toBeCloseTo(792, 0);
      expect(viewport.height).toBeCloseTo(612, 0);
      expect(exportedPage.rotate).toBe(0);
    });
  });
});

function parseMultipart(
  buffer: Buffer,
  contentType: string,
): Record<string, { filename?: string; data: Buffer }> {
  const boundaryMatch = contentType.match(/boundary=([^;\s]+)/);

  if (!boundaryMatch) return {};

  const boundary = "--" + boundaryMatch[1]!.replace(/^["']|["']$/g, "");
  const bodyText = buffer.toString("binary");
  const parts: Record<string, { filename?: string; data: Buffer }> = {};
  const segments = bodyText.split(boundary);

  for (const segment of segments) {
    const trimmed = segment.replace(/^\r?\n/, "").replace(/\r?\n$/, "");

    if (!trimmed || trimmed === "--") continue;

    const splitIndex = trimmed.indexOf("\r\n\r\n");

    if (splitIndex === -1) continue;

    const headers = trimmed.slice(0, splitIndex);
    const rawBody = trimmed.slice(splitIndex + 4);
    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]*)"/);

    if (nameMatch) {
      parts[nameMatch[1]!] = {
        filename: filenameMatch?.[1],
        data: Buffer.from(rawBody, "binary"),
      };
    }
  }

  return parts;
}
