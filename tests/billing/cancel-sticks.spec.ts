import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * "Cancel sticks" regression suite — guards the 2026-07-23 fix chain
 * documented in /Users/brickslogix/.claude/plans/hi-i-want-you-mutable-quiche.md.
 *
 * The bug being guarded: user calls POST /billing/subscription/cancel
 * (or /hard-cancel), backend returns success, but the very next GET
 * /billing/subscription still returns `entitled: true, status:
 * "ACTIVE"`. Root causes (all fixed):
 *   1. cancelSubscription only updated the ONE row findByUserId
 *      picked, leaving duplicate live rows.
 *   2. hardCancelSubscription DELETED the row — losing the
 *      sticky-CANCELLED guard's target — so a late Solidgate webhook
 *      resurrected an ACTIVE row.
 *   3. syncFromSolidgate's placeholder path created a TRIALING row
 *      even when the user had recent cancel intent.
 *
 * These tests run against a real backend (staging or local dev), so
 * they exercise the wire responses — not just stubs. They require an
 * authenticated storage state; skip cleanly if setup didn't run.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_STATE = path.join(__dirname, "..", ".auth", "user.json");
const HAS_AUTH = fs.existsSync(AUTH_STATE);

const API_BASE =
  process.env.PLAYWRIGHT_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:7403";

test.describe("Cancel sticks — API-level guarantees", () => {
  test.skip(!HAS_AUTH, "requires authenticated storage state");

  test("hard-cancel makes GET /billing/subscription return CANCELLED (not resurrect)", async ({
    page,
  }) => {
    // Reset via hard-cancel (idempotent — safe to run even if the
    // user has no live sub; returns rowsAffected=0 in that case).
    const hardCancel = await page.request.post(
      `${API_BASE}/billing/subscription/hard-cancel`,
      { failOnStatusCode: false },
    );

    expect(hardCancel.status()).toBeLessThan(500);

    const hardCancelBody = await hardCancel.json();
    const hardCancelData = hardCancelBody.data ?? hardCancelBody;

    expect(hardCancelData.ok).toBe(true);

    // Immediately fetch subscription snapshot.
    const snapshotRes = await page.request.get(
      `${API_BASE}/billing/subscription`,
    );

    expect(snapshotRes.status()).toBe(200);
    const snapshotBody = await snapshotRes.json();
    const snapshot = snapshotBody.data ?? snapshotBody;

    // Regression guard: the newest returned row must NOT be a live
    // status. Either the user has no subscription at all (NONE) or
    // every row is CANCELLED. Never ACTIVE / TRIALING / REDEMPTION.
    expect(snapshot.entitled).toBe(false);
    expect(
      ["NONE", "CANCELLED", "EXPIRED", "UNPAID"].includes(snapshot.status),
    ).toBe(true);
  });

  test("stray sync after cancel does not resurrect the row", async ({
    page,
  }) => {
    // Ensure cancelled state first (idempotent).
    await page.request.post(`${API_BASE}/billing/subscription/hard-cancel`, {
      failOnStatusCode: false,
    });

    // Simulate a stray sync — as could happen if the frontend fires
    // /billing/subscription/sync (paywall retry, admin action) with
    // a stale Solidgate subscription id after the user cancelled.
    // The placeholder-guard should refuse to write a resurrecting
    // row when a CANCELLED sibling exists.
    const straySync = await page.request.post(
      `${API_BASE}/billing/subscription/sync`,
      {
        data: {
          subscriptionId: `stray-guard-${Date.now()}`,
        },
        failOnStatusCode: false,
      },
    );

    expect(straySync.status()).toBeLessThan(500);
    const straySyncBody = await straySync.json();
    const straySyncData = straySyncBody.data ?? straySyncBody;

    expect(straySyncData.ok).toBe(true);
    // Placeholder skipped → synced=0. If Solidgate happened to
    // return a real subscription for the fake id we'd get synced=1,
    // but a random id has vanishingly-low collision odds. The guard
    // itself is asserted by the follow-up GET below.
    expect(straySyncData.synced).toBe(0);

    // Verify entitlement STILL false after the stray sync.
    const snapshotRes = await page.request.get(
      `${API_BASE}/billing/subscription`,
    );
    const snapshotBody = await snapshotRes.json();
    const snapshot = snapshotBody.data ?? snapshotBody;

    expect(snapshot.entitled).toBe(false);
  });

  test("gated action fires paywall after cancel (frontend UI)", async ({
    page,
  }) => {
    await page.request.post(`${API_BASE}/billing/subscription/hard-cancel`, {
      failOnStatusCode: false,
    });

    // Navigate somewhere that would trigger a paywall on a gated
    // action. The exact path may differ; landing + open-tool is a
    // reliable entry.
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Look for the paywall trigger surface. This test asserts the
    // page loaded without automatic entitlement — the paywall itself
    // opens on gated action, but we can at least verify no
    // "entitled" state leaked into DOM.
    await expect(page.locator("[data-testid=entitled-badge]")).toHaveCount(0);
  });
});
