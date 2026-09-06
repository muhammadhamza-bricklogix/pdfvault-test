/**
 * Client-side batch shipper for the frontend log stream.
 *
 * Ships structured log events to the backend endpoint
 * `POST /logs/frontend`. Backend forwards each event to a CloudWatch log
 * group (via the AWS SDK's `PutLogEvents`) so the ECS operator can query
 * frontend + backend logs from a single console.
 *
 * Design rules — the shipper MUST NEVER break the app:
 *   1. No throw. Every code path swallows failures.
 *   2. No circular imports. Uses raw `fetch`, not `apiClient` (which
 *      itself calls the logger for breadcrumbs — that would infinite
 *      loop).
 *   3. No auth header. The backend endpoint reads the Clerk session
 *      cookie server-side if it wants to associate logs with a user.
 *      Anonymous users are logged too (bots, signed-out flows).
 *   4. No SSR side effects. `typeof window === "undefined"` short-
 *      circuits everything so instrumentation.ts / server components
 *      calling `logger.event(...)` don't crash.
 *   5. Batched — up to `BATCH_SIZE` events or `FLUSH_INTERVAL_MS` idle
 *      time, whichever is first. Prevents log-storm behaviour when a
 *      loop fires 100 events/second.
 *   6. Sendbeacon on unload — the browser fires `pagehide` /
 *      `beforeunload` when the user navigates away. Use
 *      `navigator.sendBeacon` so any pending events land even if the
 *      tab is closing.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const ENDPOINT = `${API_BASE_URL}/logs/frontend`;

/**
 * Absolute cap on the in-memory buffer so a runaway event source can't
 * balloon memory. Older events are dropped first — errors are the
 * costliest to lose and are the LAST added, so FIFO drop preserves the
 * most-recent signal.
 */
const MAX_BUFFER_SIZE = 200;
const BATCH_SIZE = 25;
const FLUSH_INTERVAL_MS = 5_000;

export type CloudWatchLogLevel = "info" | "warn" | "error";

export interface CloudWatchLogEvent {
  /** Unix millis at the moment the event was emitted (client clock). */
  timestamp: number;
  level: CloudWatchLogLevel;
  /**
   * Event name — dotted lowercase, matches the `EVENTS` catalog in
   * `analytics-events.ts` for structured queries. Freeform strings
   * (e.g. `logger.warn("blah")` calls) land as `event: "log"` with the
   * text in `data.message` so CloudWatch's structured queries still
   * work.
   */
  event: string;
  /** Optional feature tag — set for captureError-style calls. */
  feature?: string;
  /** Structured payload. Sanitised of File / DOM / circular refs. */
  data?: Record<string, unknown>;
}

interface ShipperState {
  buffer: CloudWatchLogEvent[];
  flushTimer: number | null;
  sessionId: string | null;
}

const state: ShipperState = {
  buffer: [],
  flushTimer: null,
  sessionId: null,
};

function getSessionId(): string {
  if (state.sessionId) return state.sessionId;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    state.sessionId = crypto.randomUUID();
  } else {
    state.sessionId = `s_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }

  return state.sessionId;
}

/**
 * Best-effort serialisation. `JSON.stringify` throws on circular
 * references and BigInts; log a placeholder rather than crash the
 * caller. Also strips `File` / `Blob` objects (senseless in a log
 * payload) and truncates strings past `MAX_FIELD_CHARS` so a stack
 * trace can't blow the payload past CloudWatch's 256 KB limit.
 */
const MAX_FIELD_CHARS = 4_000;

function sanitise(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[max-depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") {
    return value.length > MAX_FIELD_CHARS
      ? `${value.slice(0, MAX_FIELD_CHARS)}…[truncated]`
      : value;
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "symbol"
  ) {
    return typeof value === "symbol" ? value.toString() : value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.slice(0, MAX_FIELD_CHARS),
    };
  }
  if (
    typeof File !== "undefined" &&
    (value instanceof File || value instanceof Blob)
  ) {
    return `[${value.constructor.name}:${(value as Blob).size}]`;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => sanitise(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitise(v, depth + 1);
    }

    return out;
  }

  return String(value);
}

function scheduleFlush() {
  if (typeof window === "undefined") return;
  if (state.flushTimer !== null) return;
  state.flushTimer = window.setTimeout(() => {
    state.flushTimer = null;
    void flush("timer");
  }, FLUSH_INTERVAL_MS);
}

/**
 * Ship all buffered events. Uses fetch for normal flushes and
 * `navigator.sendBeacon` on unload paths so the browser doesn't cancel
 * an in-flight request during page transition.
 *
 * Failures are silent by design — see design rule #1. If the endpoint
 * is down or the API_BASE_URL isn't configured, events are dropped
 * (they've already been consoled locally by the caller).
 */
async function flush(trigger: "size" | "timer" | "unload") {
  if (typeof window === "undefined") return;
  if (state.buffer.length === 0) return;
  if (!API_BASE_URL) {
    // No endpoint configured — reset the buffer so it doesn't grow
    // unbounded. Local console already caught the events.
    state.buffer = [];

    return;
  }

  const batch = state.buffer.splice(0, BATCH_SIZE);
  const payload = JSON.stringify({
    sessionId: getSessionId(),
    userAgent:
      typeof navigator !== "undefined"
        ? navigator.userAgent?.slice(0, 300)
        : "",
    url: typeof location !== "undefined" ? location.href : "",
    events: batch,
    trigger,
  });

  try {
    if (trigger === "unload" && typeof navigator?.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });

      navigator.sendBeacon(ENDPOINT, blob);

      return;
    }

    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      // Don't send cookies cross-origin unless the backend explicitly
      // sets CORS credentials. Backend can add IP-based tagging if
      // per-user context is needed.
      credentials: "same-origin",
      // Fire-and-forget — don't block on the response.
      keepalive: true,
    }).catch(() => {
      // Silent per design rule #1.
    });
  } catch {
    // Silent per design rule #1.
  }

  // Immediately try again if the buffer still has events.
  if (state.buffer.length >= BATCH_SIZE) {
    void flush("size");
  } else if (state.buffer.length > 0) {
    scheduleFlush();
  }
}

/**
 * Public API — enqueue an event. Callers (logger.ts) build the
 * `CloudWatchLogEvent` and forget; the shipper decides when to send.
 *
 * SSR calls are no-ops.
 */
export function ship(event: CloudWatchLogEvent): void {
  if (typeof window === "undefined") return;

  // Defensive sanitise so a caller's cyclic ref can't crash the app.
  const safe: CloudWatchLogEvent = {
    ...event,
    data: event.data
      ? (sanitise(event.data) as Record<string, unknown>)
      : undefined,
  };

  state.buffer.push(safe);

  // FIFO drop — keep newest, drop oldest. Errors ride at the tail and
  // survive the trim.
  if (state.buffer.length > MAX_BUFFER_SIZE) {
    state.buffer.splice(0, state.buffer.length - MAX_BUFFER_SIZE);
  }

  if (state.buffer.length >= BATCH_SIZE) {
    void flush("size");
  } else {
    scheduleFlush();
  }
}

/**
 * Register unload handlers exactly once so a page-hide fires a final
 * beacon. Called from `logger.ts` at module load time.
 */
let unloadRegistered = false;

export function registerUnloadFlush(): void {
  if (unloadRegistered) return;
  if (typeof window === "undefined") return;
  unloadRegistered = true;

  const flushOnUnload = () => void flush("unload");

  // `pagehide` fires on tab close AND SPA back/forward navigation
  // (bfcache-friendly). `visibilitychange` covers mobile Safari
  // suspending tabs. Both listeners are passive + idempotent.
  window.addEventListener("pagehide", flushOnUnload);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnUnload();
  });
}
