"use client";

import { useLayoutEffect } from "react";

import { W9_SCHEMA } from "@/lib/client/forms/w9-schema";
import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

const EXPORT_EVENT = "editor:export";
const SAVE_BEFORE_ACTION_EVENT = "editor:save-before-action";

type SaveBeforeActionDetail = {
  onComplete?: (result: { ok: boolean }) => void;
};

/**
 * Client-schema field id → backend DTO field name.
 *
 * Our schema uses W-9 AcroForm-derived ids like `c1_1`; the finalize
 * endpoint has an explicit DTO with human-readable field names. Fields
 * NOT listed here are passed through under their original id (the
 * backend accepts the pdfRef-style keys for the free-text fields).
 *
 * Discovered from the 422 response bodies:
 *   - `c1_1`  → `classification`  (radio: federal tax classification)
 *   - `signature_date` → `date`   (Part II signature date)
 */
const SCHEMA_ID_TO_BACKEND_FIELD: Record<string, string> = {
  c1_1: "classification",
  signature_date: "date",
};

/**
 * Radio-option value mapping for the federal tax classification. Our
 * schema uses hyphenated ids for consistency with the pdfRef strings;
 * the backend DTO enum uses underscores.
 */
const CLASSIFICATION_VALUE_MAP: Record<string, string> = {
  individual: "individual",
  "c-corp": "c_corp",
  "s-corp": "s_corp",
  partnership: "partnership",
  "trust-estate": "trust_estate",
  llc: "llc",
  other: "other",
};

/**
 * Normalize the form-fill values map into the shape the backend
 * `/form-sessions/:id/finalize` endpoint accepts.
 *
 * Adjustments the backend has flagged with 422 on the raw store payload:
 *
 *   1. **Field renames** — see `SCHEMA_ID_TO_BACKEND_FIELD`. Backend DTO
 *      names differ from our AcroForm-derived ids for a few fields.
 *   2. **Value enum mapping** — `classification` values must be
 *      underscored (`c_corp`, `s_corp`, `trust_estate`), not hyphenated.
 *   3. **Date format** — backend expects `MM/DD/YYYY` (matches the
 *      display form the DateField already stores). No conversion.
 *   4. **SSN / EIN** — strip formatting hyphens (`657-67-8678` →
 *      `657678678`) so `@Matches(/^\d{9}$/)` accepts it.
 *   5. **Empty strings** — dropped so optional fields are treated as
 *      absent rather than "provided but empty".
 */
function normalizeValuesForFinalize(
  values: Record<string, string>,
): Record<string, string> {
  const fields = W9_SCHEMA.sections.flatMap((s) => s.fields);
  const digitsOnlyFieldIds = new Set(
    fields.filter((f) => f.type === "ssn" || f.type === "ein").map((f) => f.id),
  );
  const out: Record<string, string> = {};

  for (const [id, rawValue] of Object.entries(values)) {
    if (rawValue == null || rawValue === "") continue;

    // Skip empty checkbox — `"true"` is truthy, anything else means unchecked.
    // We don't drop truthy checkbox values because the backend may want them.

    let value = rawValue;

    // SSN / EIN — strip formatting hyphens. NestJS class-validator's
    // @Matches(/^\d{9}$/) or @IsNumberString rejects hyphenated input.
    if (digitsOnlyFieldIds.has(id)) {
      value = rawValue.replace(/\D/g, "");
      if (!value) continue;
    }

    // Classification radio value mapping (hyphens → underscores).
    if (id === "c1_1") {
      value = CLASSIFICATION_VALUE_MAP[rawValue] ?? rawValue;
    }

    // Rename the key if the backend DTO uses a different name.
    const outKey = SCHEMA_ID_TO_BACKEND_FIELD[id] ?? id;

    out[outKey] = value;
  }

  return out;
}

type FieldError = { field: string; message: string };

/**
 * Extract per-field validation messages from an error.
 *
 * The API client wraps axios errors in a custom `ApiError` class with the
 * raw axios error stashed on `.cause`. So we walk:
 *   err (ApiError)  →  err.cause (AxiosError)  →  err.cause.response.data
 *
 * The finalize backend returns:
 *   { message: "Validation failed",
 *     errors: [ { field: "classification", message: "…" }, … ] }
 *
 * We normalize into a flat `fields` map + a single-line `message` that
 * concatenates every field error so the toast surfaces the actual
 * problem instead of the generic ApiError fallback.
 */
function extractApiFieldErrors(err: unknown): {
  message: string;
  statusCode?: number;
  fields?: FieldError[];
  raw?: unknown;
  requestPayload?: unknown;
} {
  const anyErr = err as {
    message?: string;
    statusCode?: number;
    cause?: unknown;
    response?: { status?: number; data?: unknown };
  };

  // Unwrap ApiError → AxiosError if present.
  const axiosLike = (anyErr.cause ?? anyErr) as {
    message?: string;
    response?: {
      status?: number;
      data?: unknown;
      config?: { data?: unknown };
    };
    config?: { data?: unknown };
  };

  const data = axiosLike.response?.data as
    | {
        message?: string | string[];
        errors?: unknown;
        detail?: unknown;
        [k: string]: unknown;
      }
    | undefined;

  // The finalize backend returns `errors` as an array of {field, message}.
  // Older / other endpoints may use `{ field: message }` — accept both.
  let fields: FieldError[] | undefined;

  if (Array.isArray(data?.errors)) {
    fields = (data.errors as unknown[])
      .filter(
        (e): e is FieldError =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as FieldError).field === "string" &&
          typeof (e as FieldError).message === "string",
      )
      .map((e) => ({ field: e.field, message: e.message }));
  } else if (data?.errors && typeof data.errors === "object") {
    fields = Object.entries(data.errors as Record<string, unknown>).map(
      ([field, msg]) => ({
        field,
        message: Array.isArray(msg) ? msg.join("; ") : String(msg),
      }),
    );
  }

  const backendMessage =
    (Array.isArray(data?.message) ? data?.message.join("; ") : data?.message) ??
    "";
  const fieldSummary = fields?.length
    ? fields.map((f) => `${f.field}: ${f.message}`).join(" · ")
    : "";
  const parsedMessage =
    [backendMessage, fieldSummary].filter(Boolean).join(" — ") ||
    anyErr.message ||
    axiosLike.message ||
    "Unknown error";

  // Axios stashes the request payload string on `config.data`. Parse it
  // so we can log the EXACT bytes the server received.
  const rawRequest = axiosLike.response?.config?.data ?? axiosLike.config?.data;
  let requestPayload: unknown = rawRequest;

  if (typeof rawRequest === "string") {
    try {
      requestPayload = JSON.parse(rawRequest);
    } catch {
      /* leave as string */
    }
  }

  return {
    message: parsedMessage,
    statusCode: anyErr.statusCode ?? axiosLike.response?.status,
    fields,
    raw: data,
    requestPayload,
  };
}

/**
 * Intercepts pdf-composer's `editor:export` event on the W-9 route so
 * Download routes through the form-session finalize backend
 * (`POST /form-sessions/:id/finalize`) instead of pdf-composer's own
 * Fabric-merge export pipeline.
 *
 * Why:
 *   - Yellow form-field overlays write to `useFormEditorStore.values`
 *     (form-fill store), not to the pdf-composer Fabric canvas. So
 *     pdf-composer's export would ship a blank W-9.
 *   - The earlier "mirror values into Fabric objects" attempt caused
 *     visible duplication (both the yellow overlay text AND the Fabric
 *     text painted at slightly-off coordinates).
 *   - The form-session backend already knows how to stamp values +
 *     signature onto the W-9 template — that's what it was built for.
 *     Server-stamped PDF is byte-perfect; no client-side coordinate
 *     math to get wrong.
 *
 * Listener registration:
 *   - `useLayoutEffect` (not `useEffect`) so the listener registers
 *     during the commit phase, BEFORE pdf-composer's `useExportEditor`
 *     runs its own `useEffect` on the same event.
 *   - `{ capture: true }` for belt-and-braces phase ordering.
 *   - `event.stopImmediatePropagation()` inside the handler prevents
 *     pdf-composer's downstream listener from firing (would otherwise
 *     race a client-side Fabric export against our server finalize).
 *
 * Trade-off — this is documented and intentional:
 *   - On `/w-9-form`, ANY Fabric edits the user makes with pdf-composer
 *     tools (Add Text, Draw, Highlight, Sign tool, etc.) are NOT
 *     included in the downloaded PDF. Only the yellow-overlay form-fill
 *     values + the signature drop-zone signature are baked in.
 *   - If you need Fabric edits in the download too, we'd need a hybrid:
 *     server finalize + client Fabric merge. Not in this iteration.
 */
export function W9FinalizeIntercept() {
  useLayoutEffect(() => {
    const handler = (event: Event) => {
      // Prevent pdf-composer's `useExportEditor` from also running on
      // this event — server finalize is our source of truth here.
      event.stopImmediatePropagation();

      const { sessionId, values, signatureKey } = useFormEditorStore.getState();

      if (!sessionId) {
        toast.error({
          title: "Session not ready",
          description:
            "Give it a moment while we start your W-9 session, then try Download again.",
        });

        return;
      }

      const loadingKey = toast.loading({
        title: "Preparing your W-9",
        description: "Stamping your values onto the template…",
      });

      const normalizedValues = normalizeValuesForFinalize(values);

      // Loud pre-request log so we can eyeball the exact payload the
      // backend receives without needing to attach devtools mid-flow.
      // Group keeps the console tidy when the user clicks Download
      // multiple times.
      // eslint-disable-next-line no-console
      console.groupCollapsed(
        `[w9.finalize] POST /form-sessions/${sessionId}/finalize`,
      );
      // eslint-disable-next-line no-console
      console.log("sessionId:", sessionId);
      // eslint-disable-next-line no-console
      console.log("signatureKey:", signatureKey);
      // eslint-disable-next-line no-console
      console.log(
        "raw values (from useFormEditorStore):",
        JSON.parse(JSON.stringify(values)),
      );
      // eslint-disable-next-line no-console
      console.log(
        "normalized values (dates → ISO, empty strings dropped):",
        normalizedValues,
      );
      // eslint-disable-next-line no-console
      console.groupEnd();

      void (async () => {
        try {
          const { downloadUrl } = await formsService.finalizeFormSession({
            sessionId,
            values: normalizedValues,
            signatureKey,
          });

          // Trigger a browser download from the server-returned URL.
          // `download` attribute suggests a filename; some CORS setups
          // ignore it and rely on Content-Disposition — either way the
          // user gets the PDF.
          const link = document.createElement("a");

          link.href = downloadUrl;
          link.download = "w-9.pdf";
          link.rel = "noopener";
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          toast.success({
            title: "W-9 ready",
            description: "Your filled PDF has downloaded.",
          });
        } catch (err) {
          const parsed = extractApiFieldErrors(err);

          // Loud error log so we can spot which field the backend rejected.
          // The generic ApiError message ("Some fields are invalid") hides
          // the useful per-field detail that the server response body
          // actually carries — dump both so the fix is obvious in a
          // single console glance.
          //
          // NOTE: our backend's error envelope is currently
          // `{ success:false, message, statusCode }` — no per-field detail.
          // Without a backend change to include `errors: { fieldId: msg }`
          // we can't map 422s to a specific field automatically. When
          // that happens, log the EXACT request payload the server saw
          // and instruct the user to compare it against the backend's
          // expected schema.
          // eslint-disable-next-line no-console
          console.groupCollapsed(
            `[w9.finalize] ✗ backend rejected (${parsed.statusCode ?? "?"})`,
          );
          // eslint-disable-next-line no-console
          console.error("message:", parsed.message);
          // eslint-disable-next-line no-console
          console.error("statusCode:", parsed.statusCode);
          if (parsed.fields) {
            // eslint-disable-next-line no-console
            console.error(
              "field errors (from response.data.errors):",
              parsed.fields,
            );
          } else {
            // eslint-disable-next-line no-console
            console.warn(
              "No `errors` object in response body — backend didn't include per-field detail. Compare `requestPayload` below against the backend's expected DTO.",
            );
          }
          if (parsed.raw !== undefined) {
            // eslint-disable-next-line no-console
            console.error("raw response body:", parsed.raw);
          }
          // eslint-disable-next-line no-console
          console.error(
            "requestPayload (as the server received it):",
            parsed.requestPayload,
          );
          // eslint-disable-next-line no-console
          console.error("our local pre-serialization payload:", {
            sessionId,
            signatureKey,
            values: normalizedValues,
          });
          // eslint-disable-next-line no-console
          console.error("original error object:", err);
          // eslint-disable-next-line no-console
          console.groupEnd();

          logger.captureError(err, "w9.finalize", {
            statusCode: parsed.statusCode,
            fieldErrors: parsed.fields,
            responseBody: parsed.raw,
            requestPayload: parsed.requestPayload,
          });
          toast.error({
            title: "Couldn't generate the W-9",
            description: parsed.message,
          });
        } finally {
          toast.close(loadingKey);
        }
      })();
    };

    // `ExportFormatModal.handleDownload` dispatches
    // `editor:save-before-action` first and awaits `onComplete` before
    // firing the export event. For the W-9 route we don't want
    // pdf-composer's cloud save (would upload the blank template to
    // the user's library, and would prompt signed-out users to sign
    // in for no useful reason since finalize is what actually needs
    // to run). Resolve the save as a no-op success so the modal
    // proceeds to dispatch the export event our other handler catches.
    const saveHandler = (event: Event) => {
      event.stopImmediatePropagation();
      const detail = (event as CustomEvent<SaveBeforeActionDetail>).detail;

      detail?.onComplete?.({ ok: true });
    };

    window.addEventListener(SAVE_BEFORE_ACTION_EVENT, saveHandler, {
      capture: true,
    });
    window.addEventListener(EXPORT_EVENT, handler, { capture: true });

    return () => {
      window.removeEventListener(SAVE_BEFORE_ACTION_EVENT, saveHandler, {
        capture: true,
      });
      window.removeEventListener(EXPORT_EVENT, handler, { capture: true });
    };
  }, []);

  return null;
}
