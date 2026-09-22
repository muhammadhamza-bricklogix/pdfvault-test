import { expect, test } from "@playwright/test";

/**
 * Billing / paywall end-to-end coverage — three layers:
 *
 *   1. Public landing UI — the paywall must never render pre-emptively
 *      on the landing page. Also confirms the pricing surface loads.
 *   2. Backend API smoke — /billing/plans is @Public and returns the
 *      seeded plan catalog; /billing/webhooks/solidgate rejects
 *      unsigned bodies with 400.
 *   3. Auth-gated UI paths — dashboard billing tab under multiple
 *      subscription states. Skipped when the auth storage state is
 *      absent (Clerk dev 2FA blocks setup in restricted environments).
 *
 * We intentionally do NOT drive the Solidgate iframe from inside these
 * specs — it's cross-origin, its DOM is not scriptable, and the test
 * account has to have a real charge succeed for the flow to advance.
 * Manual smoke covers the payment flow end-to-end.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_STATE = path.join(__dirname, "..", ".auth", "user.json");
const HAS_AUTH = fs.existsSync(AUTH_STATE);

const API_BASE =
  process.env.PLAYWRIGHT_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:7403";

test.describe("Public landing — no paywall", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("landing page renders without showing the paywall modal", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.locator('text="Last step to unlock your file"'),
    ).toHaveCount(0);
  });

  test("landing page hits the backend /billing/plans endpoint successfully", async ({
    page,
  }) => {
    // The plans query is public — component is free to fire it on
    // any route. This test doesn't wait for the query, it just proves
    // the endpoint is reachable through the running stack.
    const res = await page.request.get(`${API_BASE}/billing/plans`);

    expect(res.status()).toBe(200);
    const body = await res.json();
    const rows = body.data ?? body;

    expect(Array.isArray(rows)).toBe(true);
    // Local dev seeds exactly one plan — TRIAL_MONTHLY.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].kind).toBe("TRIAL_MONTHLY");
    expect(rows[0].trialAmountMinor).toBe(99);
    expect(rows[0].recurringAmountMinor).toBe(3999);
  });
});

test.describe("Backend security smoke", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("checkout intent requires authentication", async ({ page }) => {
    const res = await page.request.post(
      `${API_BASE}/billing/checkout-intent`,
      {
        data: { disclaimerVersion: "2026-07-12.v1" },
        failOnStatusCode: false,
      },
    );

    // Auth-gated by Clerk. Anonymous → 401.
    expect([401, 403]).toContain(res.status());
  });

  test("webhook endpoint rejects unsigned bodies with 400", async ({
    page,
  }) => {
    const res = await page.request.post(
      `${API_BASE}/billing/webhooks/solidgate`,
      { data: {}, failOnStatusCode: false },
    );

    // Signature guard rejects missing headers before touching state.
    expect(res.status()).toBe(400);
  });

  test("webhook endpoint rejects bad signature with 400", async ({ page }) => {
    const res = await page.request.post(
      `${API_BASE}/billing/webhooks/solidgate`,
      {
        headers: {
          Merchant: "wh_pk_not_our_merchant",
          Signature: "definitely-not-a-real-hmac",
          "Content-Type": "application/json",
        },
        data: { callback_type: "create", subscription: { id: "spoof" } },
        failOnStatusCode: false,
      },
    );

    expect(res.status()).toBe(400);
  });
});

test.describe("Billing dashboard — signed-in with no subscription", () => {
  test.skip(!HAS_AUTH, "Clerk auth storage state not present");

  test("renders the free-plan empty state", async ({ page }) => {
    await page.route("**/billing/subscription", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          success: true,
          data: {
            entitled: false,
            status: "NONE",
            planName: null,
            currentPeriodEnd: null,
            trialEndsAt: null,
            cancelledButActive: false,
          },
        }),
      });
    });
    await page.route("**/billing/invoices", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto("/dashboard/settings/billing");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Your subscription")).toBeVisible();
    await expect(
      page.getByText("You're on the free plan", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("No invoices yet")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /cancel subscription/i }),
    ).toHaveCount(0);
  });
});

test.describe("Billing dashboard — trial state", () => {
  test.skip(!HAS_AUTH, "Clerk auth storage state not present");

  test.beforeEach(async ({ page }) => {
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await page.route("**/billing/subscription", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          success: true,
          data: {
            entitled: true,
            status: "TRIALING",
            planName: "7-Day Trial → Monthly",
            currentPeriodEnd: trialEnd.toISOString(),
            trialEndsAt: trialEnd.toISOString(),
            cancelledButActive: false,
          },
        }),
      });
    });
    await page.route("**/billing/invoices", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
  });

  test("shows Trial pill + trial-ends date + Cancel button", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings/billing");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("7-Day Trial → Monthly")).toBeVisible();
    await expect(page.getByText("Trial", { exact: true })).toBeVisible();
    await expect(page.getByText(/in \d days?/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /cancel subscription/i }),
    ).toBeVisible();
  });

  test("Cancel button opens the two-step cancellation modal", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings/billing");
    await page.getByRole("button", { name: /cancel subscription/i }).click();

    await expect(page.getByText("Before you go")).toBeVisible();
    await expect(
      page.getByRole("radio", { name: /too expensive/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /cancel my subscription/i }),
    ).toBeVisible();
  });
});

test.describe("Billing dashboard — cancelled but active", () => {
  test.skip(!HAS_AUTH, "Clerk auth storage state not present");

  test.beforeEach(async ({ page }) => {
    const periodEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await page.route("**/billing/subscription", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          success: true,
          data: {
            entitled: true,
            status: "CANCELLED",
            planName: "7-Day Trial → Monthly",
            currentPeriodEnd: periodEnd.toISOString(),
            trialEndsAt: null,
            cancelledButActive: true,
          },
        }),
      });
    });
    await page.route("**/billing/invoices", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
  });

  test("shows access-until date + Renew button", async ({ page }) => {
    await page.goto("/dashboard/settings/billing");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/cancelled/i).first()).toBeVisible();
    await expect(page.getByText("Access until")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /renew subscription/i }),
    ).toBeVisible();
  });
});

test.describe("Billing dashboard — invoice history", () => {
  test.skip(!HAS_AUTH, "Clerk auth storage state not present");

  test("renders invoice rows when the API returns Payments", async ({
    page,
  }) => {
    const paidAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await page.route("**/billing/subscription", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          success: true,
          data: {
            entitled: true,
            status: "ACTIVE",
            planName: "7-Day Trial → Monthly",
            currentPeriodEnd: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            trialEndsAt: null,
            cancelledButActive: false,
          },
        }),
      });
    });

    await page.route("**/billing/invoices", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "pay_1",
              amountMinor: 99,
              currency: "USD",
              status: "APPROVED",
              type: "TRIAL",
              invoiceNumber: "INV-1001",
              invoiceUrl: "https://solidgate.example/invoice/INV-1001.pdf",
              paidAt: paidAt.toISOString(),
              createdAt: paidAt.toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto("/dashboard/settings/billing");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("INV-1001")).toBeVisible();
    await expect(page.getByText("$0.99")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /download/i }),
    ).toHaveAttribute(
      "href",
      "https://solidgate.example/invoice/INV-1001.pdf",
    );
  });
});
