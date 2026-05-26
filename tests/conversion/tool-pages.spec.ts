import { test } from "@playwright/test";

import { skipIfUnauthenticated } from "../helpers/auth";
import { FIXTURES, captureNextConversionRequest } from "../helpers/editor";

// All `/tools/*` routes are auth-gated by Clerk middleware. The Clerk test
// user must be set up — see tests/README.md "Unlock the auth-gated tests".
test.beforeEach(() => skipIfUnauthenticated());

type ConversionCase = {
  route: string;
  expectedType: string;
  fixture: keyof typeof FIXTURES;
};

const CASES: ConversionCase[] = [
  { route: "/tools/pdf-to-jpg", expectedType: "pdf_to_jpg", fixture: "pdf" },
  { route: "/tools/pdf-to-word", expectedType: "pdf_to_docx", fixture: "pdf" },
  { route: "/tools/pdf-to-excel", expectedType: "pdf_to_xlsx", fixture: "pdf" },
  { route: "/tools/jpg-to-pdf", expectedType: "jpg_to_pdf", fixture: "jpg" },
  { route: "/tools/word-to-pdf", expectedType: "docx_to_pdf", fixture: "docx" },
];

test.describe("Conversion tool pages — frontend fires POST /conversion", () => {
  for (const { route, expectedType, fixture } of CASES) {
    test(`${route} → type=${expectedType}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const requestPromise = captureNextConversionRequest(page, expectedType);

      await page
        .locator('input[type="file"]')
        .first()
        .setInputFiles(FIXTURES[fixture]);

      await requestPromise;
    });
  }
});
