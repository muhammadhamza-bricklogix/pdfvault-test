#!/usr/bin/env node
/**
 * End-to-end backend flow test.
 *
 * Simulates the exact Solidgate webhook payload we captured off the
 * wire ("callback_type": "create") + drives it through the full
 * pipeline: signature verify → idempotency → state machine → DB.
 * Then exercises TRIALING → ACTIVE → CANCELLED transitions.
 *
 * Runs against the LIVE local backend at http://localhost:7403 with
 * the LIVE local Postgres at localhost:5432/pdfvault_dev. No mocks.
 */

import { createHmac } from "crypto";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require(
  "/Users/softaims/Downloads/pdf-viewer-backend-main/node_modules/pg",
);

const BACKEND = "http://localhost:7403";
const PG_CONFIG = {
  connectionString: "postgresql://softaims@localhost:5432/pdfvault_dev",
};

function loadEnv() {
  const src = fs.readFileSync(
    "/Users/softaims/Downloads/pdf-viewer-backend-main/.env",
    "utf8",
  );
  const env = {};

  for (const line of src.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);

    if (m) env[m[1]] = m[2].trim();
  }

  return env;
}

const env = loadEnv();
const WEBHOOK_PUBLIC = env.SOLIDGATE_WEBHOOK_PUBLIC_KEY;
const WEBHOOK_SECRET = env.SOLIDGATE_WEBHOOK_SECRET_KEY;
const PRODUCT_ID = env.SOLIDGATE_PRODUCT_TRIAL_MONTHLY;
const USER_ID = "user_3GSN7TSBGwdozkU9jA4tYgL0bT9";
const SUB_ID = `test-sub-${Date.now()}`;

function sign(bodyString) {
  const hmac = createHmac("sha512", WEBHOOK_SECRET);

  hmac.update(WEBHOOK_PUBLIC + bodyString + WEBHOOK_PUBLIC, "utf8");

  return Buffer.from(hmac.digest("hex")).toString("base64");
}

async function sendWebhook(payload) {
  const body = JSON.stringify(payload);
  const res = await fetch(`${BACKEND}/billing/webhooks/solidgate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Merchant: WEBHOOK_PUBLIC,
      Signature: sign(body),
    },
    body,
  });

  return { status: res.status, body: await res.text() };
}

let pg;

async function q(sql, params = []) {
  const res = await pg.query(sql, params);

  return res.rows;
}

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (!cond) {
    console.error(`  ✗ ${label}`);
    failed += 1;

    return;
  }
  console.log(`  ✓ ${label}`);
  passed += 1;
}

async function main() {
  console.log("\n═══ Backend Billing E2E ═══\n");
  console.log("Config:");
  console.log(`  webhookPub  = ${WEBHOOK_PUBLIC?.slice(0, 12)}…`);
  console.log(`  productId   = ${PRODUCT_ID}`);
  console.log(`  userId      = ${USER_ID}`);
  console.log(`  sub id      = ${SUB_ID}\n`);

  // The full "create" payload used across tests 2 and 3 so the
  // idempotency test can replay the EXACT same body.
  const createNow = new Date();
  const createPayload = {
    callback_type: "create",
    subscription: {
      id: SUB_ID,
      status: "pending",
      started_at: createNow.toISOString(),
      trial: false,
    },
    product: {
      product_id: PRODUCT_ID,
      currency: "USD",
      name: "PDFVault Trial → Monthly",
      amount: 2500,
      trial: true,
      trial_period: 10080,
      trial_amount: 99,
      trial_currency: "USD",
      payment_action: "auth_settle",
    },
    customer: {
      customer_email: "test@example.com",
      customer_account_id: USER_ID,
    },
    invoices: {
      "inv-1": {
        id: "inv-1",
        amount: 99,
        currency: "USD",
        status: "processing",
        product_price_id: PRODUCT_ID,
        subscription_term_number: 0,
        created_at: createNow.toISOString(),
        updated_at: createNow.toISOString(),
        orders: {
          "order-1": {
            id: "order-1",
            status: "processing",
            amount: 99,
            currency: "USD",
            created_at: createNow.toISOString(),
            updated_at: createNow.toISOString(),
            operation: "",
          },
        },
      },
    },
  };

  pg = new Client(PG_CONFIG);
  await pg.connect();

  // Clean slate for this test run.
  await q('DELETE FROM "Payment"');
  await q('DELETE FROM "Subscription"');
  await q('DELETE FROM "WebhookEvent"');
  await q('DELETE FROM "ConsentRecord"');

  // === Test 1: signature guard ===
  console.log("[1] Signature guard rejects a spoofed webhook");
  {
    const res = await fetch(`${BACKEND}/billing/webhooks/solidgate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Merchant: WEBHOOK_PUBLIC,
        Signature: "not-a-real-signature",
      },
      body: JSON.stringify({ callback_type: "create" }),
    });

    assert(res.status === 400, `returned 400 (got ${res.status})`);
  }

  // === Test 2: signed "create" webhook creates a TRIALING Subscription ===
  console.log("\n[2] Signed 'create' webhook upserts a TRIALING Subscription");
  {
    const res = await sendWebhook(createPayload);

    assert(
      res.status === 201 || res.status === 200,
      `webhook returned ${res.status}`,
    );

    const rows = await q(
      'SELECT status, "userId", "trialEndsAt", "planId" FROM "Subscription" WHERE "solidgateSubscriptionId" = $1',
      [SUB_ID],
    );

    assert(rows.length === 1, "Subscription row created");
    if (rows.length === 1) {
      assert(rows[0].status === "TRIALING", `status = TRIALING (got '${rows[0].status}')`);
      assert(rows[0].userId === USER_ID, `userId = ${USER_ID}`);
      assert(rows[0].trialEndsAt !== null, "trialEndsAt is set");
      assert(rows[0].planId, "planId is linked");
    }

    const payments = await q(
      'SELECT status, "amountMinor", type FROM "Payment" WHERE "solidgateOrderId" = $1',
      ["order-1"],
    );

    assert(payments.length === 1, "Payment row created");
    if (payments.length === 1) {
      assert(payments[0].amountMinor === 99, `Payment.amountMinor = 99`);
      assert(payments[0].type === "TRIAL", `Payment.type = TRIAL (got '${payments[0].type}')`);
    }
  }

  // === Test 3: idempotency ===
  console.log("\n[3] Idempotency — replay of the SAME body is short-circuited");
  {
    const before = (await q('SELECT COUNT(*) FROM "WebhookEvent"'))[0].count;
    // Send the identical payload from test 2 — should hit the unique
    // eventKey index and be silently ignored.
    const res = await sendWebhook(createPayload);

    assert(res.status === 201 || res.status === 200, `replay returned ${res.status}`);
    const after = (await q('SELECT COUNT(*) FROM "WebhookEvent"'))[0].count;

    assert(after === before, `WebhookEvent count unchanged (${before})`);
  }

  // === Test 4: "update" webhook flips to ACTIVE ===
  console.log("\n[4] 'update' webhook flips TRIALING → ACTIVE");
  {
    const now = new Date();
    const updatePayload = {
      callback_type: "update",
      subscription: {
        id: SUB_ID,
        status: "active",
        started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        updated_at: now.toISOString(),
      },
      product: { product_id: PRODUCT_ID },
      customer: { customer_account_id: USER_ID },
    };
    const res = await sendWebhook(updatePayload);

    assert(res.status === 201 || res.status === 200, `webhook returned ${res.status}`);
    const rows = await q(
      'SELECT status FROM "Subscription" WHERE "solidgateSubscriptionId" = $1',
      [SUB_ID],
    );

    assert(rows[0]?.status === "ACTIVE", `Subscription.status = ACTIVE (got '${rows[0]?.status}')`);
  }

  // === Test 5: "cancel" webhook ===
  console.log("\n[5] 'cancel' webhook flips ACTIVE → CANCELLED with grace");
  {
    const now = new Date();
    const cancelPayload = {
      callback_type: "cancel",
      subscription: {
        id: SUB_ID,
        status: "cancelled",
        cancelled_at: now.toISOString(),
        current_period_end: new Date(
          now.getTime() + 5 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      product: { product_id: PRODUCT_ID },
      customer: { customer_account_id: USER_ID },
    };
    const res = await sendWebhook(cancelPayload);

    assert(res.status === 201 || res.status === 200, `webhook returned ${res.status}`);
    const rows = await q(
      'SELECT status, "cancelledAt", "currentPeriodEnd" FROM "Subscription" WHERE "solidgateSubscriptionId" = $1',
      [SUB_ID],
    );

    assert(rows[0]?.status === "CANCELLED", `status = CANCELLED (got '${rows[0]?.status}')`);
    assert(rows[0]?.cancelledAt !== null, "cancelledAt populated");
    assert(rows[0]?.currentPeriodEnd > now, "currentPeriodEnd still in future (grace)");
  }

  // === Test 6: invoices show up as Payment rows ===
  console.log("\n[6] Payment rows accessible via user id");
  {
    const rows = await q(
      'SELECT "amountMinor", status, type FROM "Payment" WHERE "userId" = $1',
      [USER_ID],
    );

    assert(rows.length >= 1, `At least one Payment row exists (${rows.length})`);
  }

  await pg.end();

  console.log(
    `\n═══ ${passed} PASSED, ${failed} FAILED ═══\n`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
