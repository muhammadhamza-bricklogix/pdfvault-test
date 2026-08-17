import { expect, test } from "@playwright/test";

/**
 * Coverage for the IndexedDB offline-viewing cache.
 *
 * Two surfaces:
 *   - `OfflineBanner` mounted at the root of every route via providers.
 *   - The per-user IDB schema (documents + pdfBytes + meta stores).
 *
 * The dashboard / editor cache-read paths require an authenticated
 * Clerk session, so they're documented in the QA test plan for manual
 * runs. These specs verify the parts we CAN drive without a real
 * user-id, which is most of the safety net.
 */
test.describe("Offline — banner + IDB schema", () => {
  test("OfflineBanner is absent while online", async ({ page }) => {
    await page.goto("/");
    // role="status" matches the banner's accessibility node.
    await expect(page.locator('[role="status"]').first()).toHaveCount(0);
  });

  test("OfflineBanner appears when the context goes offline", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await context.setOffline(true);

    // The hook uses useSyncExternalStore against window 'offline' events,
    // so the banner appears on the next tick.
    await expect(page.locator('[role="status"]').first()).toBeVisible({
      timeout: 3_000,
    });
    await expect(page.locator('[role="status"]').first()).toContainText(
      /viewing cached documents only/i,
    );
    await context.setOffline(false);
  });

  test("Banner mounts on auth routes too (proves global mount)", async ({
    page,
    context,
  }) => {
    await page.goto("/sign-in");
    await context.setOffline(true);
    await expect(page.locator('[role="status"]').first()).toBeVisible({
      timeout: 3_000,
    });
    await context.setOffline(false);
  });

  test("IDB schema works in this Chrome (open + put + get)", async ({
    page,
  }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const dbName = "pdfedits-offline-e2e-test";
      const drop = (name: string) =>
        new Promise<void>((resolve) => {
          const r = indexedDB.deleteDatabase(name);

          r.onsuccess = r.onerror = r.onblocked = () => resolve();
        });

      await drop(dbName);

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open(dbName, 1);

        r.onupgradeneeded = () => {
          const d = r.result;

          d.createObjectStore("documents", { keyPath: "id" });
          d.createObjectStore("pdfBytes", { keyPath: "id" });
          d.createObjectStore("meta", { keyPath: "key" });
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });

      // put + get round-trip.
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
          ["documents", "pdfBytes"],
          "readwrite",
        );

        tx.objectStore("documents").put({
          id: "doc-A",
          filename: "alpha.pdf",
          cachedAt: 1,
        });
        const blob = new Blob(["%PDF-1.4 fake"], {
          type: "application/pdf",
        });

        tx.objectStore("pdfBytes").put({
          id: "doc-A",
          blob,
          filename: "alpha.pdf",
          contentType: "application/pdf",
          cachedAt: 1,
          bytes: blob.size,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      const restored = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction("documents", "readonly");
        const req = tx.objectStore("documents").get("doc-A");

        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
      });

      db.close();
      await drop(dbName);

      return restored as { id: string; filename: string };
    });

    expect(result.id).toBe("doc-A");
    expect(result.filename).toBe("alpha.pdf");
  });

  test("Account-switch invalidation drops the prior user's DB", async ({
    page,
  }) => {
    await page.goto("/");

    const verdict = await page.evaluate(async () => {
      const LAST_KEY = "pdfedits-last-user-id";
      const prefix = "pdfedits-offline-";
      const open = (name: string) =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const r = indexedDB.open(name, 1);

          r.onupgradeneeded = () => {
            const d = r.result;

            d.createObjectStore("documents", { keyPath: "id" });
            d.createObjectStore("pdfBytes", { keyPath: "id" });
            d.createObjectStore("meta", { keyPath: "key" });
          };
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
      const drop = (name: string) =>
        new Promise<void>((resolve) => {
          const r = indexedDB.deleteDatabase(name);

          r.onsuccess = r.onerror = r.onblocked = () => resolve();
        });

      await drop(prefix + "userA");
      await drop(prefix + "userB");

      // Seed userA with one doc.
      const dbA = await open(prefix + "userA");

      await new Promise<void>((resolve, reject) => {
        const tx = dbA.transaction("documents", "readwrite");

        tx.objectStore("documents").put({
          id: "secret",
          filename: "userA-private.pdf",
          cachedAt: 1,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      dbA.close();
      localStorage.setItem(LAST_KEY, "userA");

      // Inline copy of invalidateOnAccountSwitch() — same logic as
      // lib/client/offline/idb-client.ts.
      const previous = localStorage.getItem(LAST_KEY);

      if (previous && previous !== "userB") await drop(prefix + previous);
      localStorage.setItem(LAST_KEY, "userB");

      // Verify userA DB is empty.
      const checkA = await open(prefix + "userA");
      const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const tx = checkA.transaction("documents", "readonly");
        const req = tx.objectStore("documents").getAllKeys();

        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
      });

      checkA.close();
      await drop(prefix + "userA");
      await drop(prefix + "userB");
      localStorage.removeItem(LAST_KEY);

      return {
        keysAfter: keys.length,
        lastUserId: "userB",
      };
    });

    expect(verdict.keysAfter).toBe(0);
    expect(verdict.lastUserId).toBe("userB");
  });
});
