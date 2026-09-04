"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { normalizeW9ValuesForFinalize } from "@/lib/client/forms/normalize-w9-values";
import { savePendingW9Values } from "@/lib/client/forms/pending-w9-values";
import { renderPdfPagesToImages } from "@/lib/client/forms/render-pdf-pages-to-images";
import { stampW9Client } from "@/lib/client/forms/stamp-w9-client";
import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import { requestPaywall } from "@/lib/client/hooks/billing/paywall-bus";
import { conversionService } from "@/lib/shared/api/services/conversion.service";
import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore, usePdfEditorStore } from "@/lib/client/stores";
import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { documentKeys } from "@/lib/shared/constants/query-keys";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

const EXPORT_EVENT = "editor:export";

/**
 * URL params used to survive the sign-in redirect back to `/w-9-form`.
 * `?export=<format>` tells this component to auto-fire `editor:export`
 * once the user is signed in + the form session is ready — so the
 * user lands on the paywall directly instead of needing to click Done
 * → Download a second time (2026-09-04 QA fix).
 * `?filename=<encoded>` preserves the modal-supplied filename across
 * the redirect so the downloaded file keeps whatever name the user
 * had chosen before signing in.
 */
const EXPORT_INTENT_PARAM = "export";
const EXPORT_FILENAME_PARAM = "filename";

/**
 * Build the redirect URL we hand to the AuthModal when a signed-out
 * user hits Download or Save on `/w-9-form`. The URL points at the
 * composer (`ROUTES.FORMS.W9_SHORT`) — NOT the marketing landing
 * (`ROUTES.FORMS.W9`) — so the user resumes the editor with their
 * typed values restored, and the `?export=` param triggers the auto
 * paywall dispatch immediately after auth (mirrors the pdf-composer
 * `?export=` pattern in the general auth chain).
 */
function buildW9ReturnUrl(format?: string, filename?: string): string {
  const params = new URLSearchParams();

  if (format) params.set(EXPORT_INTENT_PARAM, format);
  if (filename) params.set(EXPORT_FILENAME_PARAM, filename);
  const query = params.toString();

  return query ? `${ROUTES.FORMS.W9_SHORT}?${query}` : ROUTES.FORMS.W9_SHORT;
}
const SAVE_EVENT = "editor:save";
const SAVE_BEFORE_ACTION_EVENT = "editor:save-before-action";
// Dedicated event for the hamburger Back → My PDFs flow on `/w-9-form`.
// Keeps the standalone `editor:save` (Save button) and the download
// intercept paths untouched — this listener owns the "save then let the
// caller continue" contract with a promise-returning `onComplete`.
const SAVE_AND_CONTINUE_EVENT = "editor:w9-save-and-continue";

type SaveBeforeActionDetail = {
  onComplete?: (result: { ok: boolean }) => void;
};

type SaveAndContinueDetail = {
  onComplete: (result: {
    ok: boolean;
    reason?: "error" | "not-signed-in" | "cancelled" | "not-ready";
  }) => void;
};

/**
 * Client-schema field id → backend DTO field name(s).
 *
 * Our schema uses W-9 AcroForm-derived ids like `c1_1`; the finalize
 * endpoint has an explicit DTO with human-readable field names. Fields
 * NOT listed here are passed through under their original id (the
 * backend accepts the pdfRef-style keys for the free-text fields).
 *
 * Discovered by iterating on 422 responses + observing the stamped PDF:
 *   - `c1_1` → `classification` (radio: federal tax classification).
 *     Validator accepts, stamper uses this name.
 *   - `signature_date` → BOTH `date` AND `signature_date`. Backend
 *     validator explicitly requires a `date` field (422 without it),
 *     but the PDF stamper still keys off `signature_date` — the date
 *     box was blank in the downloaded PDF when we sent only `date`.
 *     Duplicating the value under both keys satisfies both sides; the
 *     backend ignores unknown fields so there's no regression risk.
 *     Delete the `signature_date` alias once the backend stamper is
 *     updated to key off `date`.
 */
// Normalization moved to `@/lib/client/forms/normalize-w9-values` so
// `ShareModal` on the /w-9-form route can reuse it (Share must go
// through finalize too, otherwise the shared link ships the blank
// template instead of the user's stamped values).

type FieldError = { field: string; message: string };

/**
 * The backend finalize endpoint requires a non-empty `signatureKey`.
 * When the user hits Save / Download before they've signed, class-
 * validator surfaces "signatureKey must be longer than or equal to 1
 * characters; signatureKey must be a string" — raw validator strings
 * that shouldn't be exposed. Return a friendly `{ title, description }`
 * when the error boils down to a missing signature; return null
 * otherwise so the caller falls through to the parsed message.
 */
function friendlySignatureError(parsed: {
  message: string;
  fields?: FieldError[];
}): { title: string; description: string } | null {
  const signatureFieldFlagged = parsed.fields?.some((f) =>
    /signature/i.test(f.field),
  );
  const mentionsSignatureKey = /signaturekey/i.test(parsed.message);

  if (!signatureFieldFlagged && !mentionsSignatureKey) return null;

  return {
    title: "Add your signature to continue",
    description:
      "Draw or upload a signature in the Signature tool, then try again — your typed answers are already saved.",
  };
}

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
/**
 * Trigger a browser download from a URL the backend already handed us.
 * Extracted so the cache-hit path (repeat Download click, same values)
 * can reuse it without touching the finalize endpoint.
 */
function triggerDownload(downloadUrl: string) {
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = "w-9.pdf";
  link.rel = "noopener";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download a Blob returned by CloudConvert as a file. Used by the
 * Word (`docx`) branch after the stamped PDF is converted server-side.
 */
function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on next tick so the download commits first.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

type LastSaveRef = {
  current: { key: string; documentId: string } | null;
};

type QueryClientRef = {
  current: ReturnType<typeof useQueryClient> | undefined;
};

/**
 * Upload the stamped W-9 to the user's library. Returns `true` if the
 * row landed (fresh upload or dedupe hit), `false` if the upload failed.
 * Idempotent per `(sessionId, values, signatureKey, currentDocumentId)`
 * — repeat Done clicks with identical payload don't create duplicates.
 *
 * `currentDocumentId` in the pdf-editor store is what makes this an
 * upsert on subsequent saves; the first successful upload writes it via
 * `setCurrentDocument`, and later clicks pass that same id back to the
 * backend so the row is overwritten instead of duplicated.
 */
/**
 * Fetch the stamped PDF returned by finalize, POST it to the shared
 * conversion service as `pdf_to_docx`, and trigger a browser download
 * of the resulting .docx. Used by the W-9 Word format branch in the
 * download intercept.
 */
async function convertAndDownloadW9AsDocx(
  stampedPdfUrl: string,
  userFilename?: string,
): Promise<void> {
  const res = await fetch(stampedPdfUrl);

  if (!res.ok) {
    throw new Error(`Couldn't fetch the stamped W-9 (HTTP ${res.status}).`);
  }
  const blob = await res.blob();
  const pdfFile = new File([blob], "w-9.pdf", { type: "application/pdf" });
  const result = await conversionService.convert({
    file: pdfFile,
    type: "pdf_to_docx",
  });
  const base = (userFilename?.trim() || "w-9").replace(/\.[^./\\]+$/, "");

  triggerBlobDownload(result.blob, `${base}.docx`);
}

/**
 * Send the stamped W-9 to the backend CloudConvert bridge
 * (`pdf_to_png` / `pdf_to_jpg`) and hand the user ONE `.zip` archive
 * that contains every page as its own image.
 *
 * Product 2026-08-29 late-PM: single archive is easier to attach,
 * email, or store than N separate images. CloudConvert already
 * bundles multi-page PDF → image output as a zip, so the primary
 * path is essentially "pass through the zip verbatim." Single-image
 * responses (rare — single-page PDFs) get wrapped into a zip on the
 * client so the download experience stays consistent regardless of
 * page count. Unrecognised responses fall through to client-side
 * pdf.js rasterization, whose output is also zipped.
 */
async function convertAndDownloadW9AsImage(
  stampedPdfUrl: string,
  format: "png" | "jpg",
  userFilename?: string,
): Promise<void> {
  const res = await fetch(stampedPdfUrl);

  if (!res.ok) {
    throw new Error(`Couldn't fetch the stamped W-9 (HTTP ${res.status}).`);
  }
  const pdfBuf = await res.arrayBuffer();
  const pdfBytes = new Uint8Array(pdfBuf);
  const pdfFile = new File([pdfBytes], "w-9.pdf", { type: "application/pdf" });

  const result = await conversionService.convert({
    file: pdfFile,
    type: format === "png" ? "pdf_to_png" : "pdf_to_jpg",
  });

  await deliverImagesFromConvertResult(
    result.blob,
    result.fileName,
    format,
    userFilename,
    // Client-side fallback if the returned blob is neither an image
    // nor a valid zip — rasterize and re-zip so the download UX is
    // stable.
    () => downloadPdfBytesAsImagesZipClient(pdfBytes, format, userFilename),
  );
}

/**
 * Deliver the CloudConvert response as a single `.zip` download.
 * Shapes handled:
 *   1. Zip archive → pass through verbatim as `<base>.zip`.
 *   2. Single image → wrap in a zip so the download UX is consistent
 *      regardless of page count.
 *   3. Unknown / opaque → call the provided fallback (client pdf.js
 *      rasterize + zip).
 */
async function deliverImagesFromConvertResult(
  blob: Blob,
  responseFileName: string,
  format: "png" | "jpg",
  userFilename: string | undefined,
  onFallback: () => Promise<void>,
): Promise<void> {
  const base = (userFilename?.trim() || "w-9").replace(/\.[^./\\]+$/, "");
  const mimeGuess = blob.type ?? "";
  const looksLikeZip =
    /zip/i.test(mimeGuess) || /\.zip$/i.test(responseFileName ?? "");
  const looksLikeImage = mimeGuess.startsWith("image/");

  if (looksLikeZip) {
    triggerBlobDownload(blob, `${base}.zip`);

    return;
  }

  if (looksLikeImage) {
    // Wrap the single-image response so the user still gets a zip.
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    zip.file(`${base}.${format}`, blob);
    const zipBlob = await zip.generateAsync({ type: "blob" });

    triggerBlobDownload(zipBlob, `${base}.zip`);

    return;
  }

  // MIME can be `application/octet-stream` — sniff magic bytes to
  // decide zip vs unknown. PK\x03\x04 header = zip.
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  const isZipMagic =
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07) &&
    (head[3] === 0x04 || head[3] === 0x06 || head[3] === 0x08);

  if (isZipMagic) {
    triggerBlobDownload(blob, `${base}.zip`);

    return;
  }

  await onFallback();
}

/**
 * Client-side fallback: rasterize every page via pdf.js and pack the
 * images into one zip. Mirrors the primary path's UX (single zip
 * download) so the user experience is stable whether CloudConvert or
 * the client did the work.
 */
async function downloadPdfBytesAsImagesZipClient(
  pdfBytes: Uint8Array,
  format: "png" | "jpg",
  userFilename?: string,
): Promise<void> {
  const images = await renderPdfPagesToImages(pdfBytes, format);

  if (images.length === 0) {
    throw new Error("No pages rendered from the stamped W-9");
  }
  const base = (userFilename?.trim() || "w-9").replace(/\.[^./\\]+$/, "");
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const img of images) {
    const entryName =
      images.length === 1
        ? `${base}.${format}`
        : `${base}-page-${img.page}.${format}`;

    zip.file(entryName, img.blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });

  triggerBlobDownload(zipBlob, `${base}.zip`);
}

/**
 * Convert a `data:image/...;base64,…` URL into a Blob. Used to lift a
 * restored signaturePreview back into an uploadable form when the user
 * resumes a saved W-9 and immediately hits Done → Download / Save
 * without re-signing (the previous `signatureKey` belongs to the old
 * form session and the new session's S3 namespace rejects it).
 */
function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);

  if (!match) return null;
  const mime = match[1];
  const bytes = atob(match[2]);
  const arr = new Uint8Array(bytes.length);

  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);

  return new Blob([arr], { type: mime });
}

// 1x1 transparent PNG. Used as a "not signed yet" placeholder so
// finalize (which enforces `signatureKey` min length 1 server-side)
// succeeds even when the user wants to download a partially-filled
// form without drawing a signature. The stamped PDF gets an invisible
// mark at the signature rect — the user can add a real signature
// later and re-download.
const BLANK_SIGNATURE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function blankSignatureBlob(): Blob {
  const bytes = atob(BLANK_SIGNATURE_PNG_BASE64);
  const arr = new Uint8Array(bytes.length);

  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);

  return new Blob([arr], { type: "image/png" });
}

/**
 * Ensures the current session has a valid `signatureKey` before
 * finalize/save fires. Order of preference:
 *
 *   1. Existing `signatureKey` in the store — return as-is.
 *   2. Restored `signaturePreview` data URL — re-upload it to the
 *      current session (post-refresh / resume path) and return the
 *      fresh key.
 *   3. Nothing at all — upload a 1×1 transparent placeholder so the
 *      backend's `IsString + MinLength(1)` validator on `signatureKey`
 *      passes. Partial forms download without visible signature ink.
 *
 * Only returns null if the placeholder upload itself fails, in which
 * case the caller falls back to whatever key was already known.
 */
async function ensureSignatureKeyForSession(
  sessionId: string,
): Promise<string | null> {
  const state = useFormEditorStore.getState();

  if (state.signatureKey) return state.signatureKey;

  const blob = state.signaturePreview
    ? dataUrlToBlob(state.signaturePreview)
    : blankSignatureBlob();

  if (!blob) return null;

  try {
    const { signatureKey } = await formsService.uploadSignature({
      sessionId,
      blob,
    });

    // Only cache the key back into the store if we actually uploaded
    // the USER'S signature. The placeholder key should stay ephemeral
    // — writing it to `signatureKey` would trick `SignatureField`
    // into showing "✓ Signed" when the user hasn't drawn anything.
    if (state.signaturePreview) {
      useFormEditorStore.getState().setSignatureKey(signatureKey);
    }

    return signatureKey;
  } catch (err) {
    logger.captureError(err, "w9.signature_reupload", { sessionId });

    return null;
  }
}

/**
 * 2026-09-01 (QA): W-9 saves must always land on ONE canonical row —
 * `IRS Form W-9.pdf` — regardless of what the export modal shows.
 * The old behaviour let the modal's filename field seed the library
 * name, so a rename in the modal or a fresh session (no seeded
 * `currentDocumentId`) created a second `W-9.pdf` on every save.
 * Locking the filename here + seeding `currentDocumentId` from the
 * existing library row in `W9EditorBootstrap` gives us the upsert
 * behaviour QA expects: one row per user, updated in-place forever.
 */
export const W9_LIBRARY_FILENAME = "IRS Form W-9.pdf";

/**
 * Return the canonical W-9 filename regardless of user input. Kept as
 * a function (rather than inlining the constant) so the caller sites
 * stay wired to the same choke-point — if the product ever needs to
 * expose renaming, it's one place to un-lock.
 */
function normalizeLibraryFilename(_input: string | undefined): string {
  return W9_LIBRARY_FILENAME;
}

async function ensureLibrarySave(
  downloadUrl: string,
  sessionId: string,
  values: Record<string, string>,
  signatureKey: string | null,
  normalizedValues: Record<string, string>,
  lastSaveRef: LastSaveRef,
  queryClientRef: QueryClientRef,
  libraryFilename: string,
): Promise<boolean> {
  const { currentDocumentId } = usePdfEditorStore.getState();
  // Cache key includes the filename so a rename in the export modal
  // triggers a fresh upsert (otherwise the second click would hit the
  // dedupe short-circuit and the library row would keep the old name).
  const saveCacheKey = `${sessionId}::${signatureKey ?? ""}::${JSON.stringify(
    normalizedValues,
  )}::${currentDocumentId ?? ""}::${libraryFilename}`;

  if (lastSaveRef.current && lastSaveRef.current.key === saveCacheKey) {
    return true;
  }

  try {
    const res = await fetch(downloadUrl);

    if (!res.ok) {
      throw new Error(`Couldn't fetch the stamped W-9 (HTTP ${res.status}).`);
    }
    const blob = await res.blob();
    const stampedFile = new File([blob], libraryFilename, {
      type: "application/pdf",
    });
    const editorState = JSON.stringify({
      v: 1,
      w9: {
        values,
        signatureKey,
        // Persist the local preview data URL so reopening the W-9
        // from Dashboard restores the visible signature on the
        // overlay (see save handler comment).
        signaturePreview: useFormEditorStore.getState().signaturePreview,
      },
    });
    const savedDoc = await documentsService.uploadDocument({
      file: stampedFile,
      documentId: currentDocumentId ?? undefined,
      editorState,
    });

    usePdfEditorStore.getState().setCurrentDocument({
      id: savedDoc.id,
      name: savedDoc.filename,
    });
    lastSaveRef.current = {
      key: saveCacheKey,
      documentId: savedDoc.id,
    };

    try {
      queryClientRef.current?.invalidateQueries({
        queryKey: documentKeys.lists(),
      });
    } catch {
      /* non-fatal */
    }

    return true;
  } catch (saveErr) {
    // eslint-disable-next-line no-console
    console.error("[w9.save_on_export] library upload failed:", saveErr);
    logger.captureError(saveErr, "w9.save_on_export");

    return false;
  }
}

export function W9FinalizeIntercept() {
  // Clerk auth state — read at render, mirrored into refs so the
  // stopImmediatePropagation event handler (registered ONCE via
  // useLayoutEffect with empty deps) sees the latest value without
  // re-registering. The `editor:export` listener must remain the same
  // function identity for capture-phase precedence over pdf-composer's
  // useExportEditor listener.
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const isSignedInRef = useRef(!!isSignedIn);
  const authLoadedRef = useRef(authLoaded);
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  // Post-signin auto-launch (2026-09-04 QA fix). When the user returns
  // from auth with `?export=<format>` on the URL, we re-dispatch the
  // `editor:export` event once the form session is ready so the paywall
  // opens without a second Done → Download click. See `buildW9ReturnUrl`
  // above for how the URL is set.
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoLaunchedRef = useRef(false);
  // Session id lands after `formsService.startFormSession()` resolves in
  // `W9EditorBootstrap`. We reactively wait for it so the export event
  // fires only when the finalize handler will actually accept it.
  const sessionId = useFormEditorStore((s) => s.sessionId);

  useEffect(() => {
    isSignedInRef.current = !!isSignedIn;
    authLoadedRef.current = authLoaded;
    queryClientRef.current = queryClient;
  }, [isSignedIn, authLoaded, queryClient]);

  useEffect(() => {
    if (autoLaunchedRef.current) return;
    if (!authLoaded || !isSignedIn) return;
    if (!sessionId) return;
    const format = searchParams.get(EXPORT_INTENT_PARAM);

    if (!format) return;
    autoLaunchedRef.current = true;

    const filenameParam = searchParams.get(EXPORT_FILENAME_PARAM);

    // Small delay mirrors the pdf-composer hydrator Step 4 pattern —
    // gives the render tree a beat to settle before the paywall pops.
    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(EXPORT_EVENT, {
          detail: {
            format,
            ...(filenameParam ? { filename: filenameParam } : {}),
          },
        }),
      );
    }, 400);

    // Strip the one-shot params so a refresh mid-paywall doesn't
    // re-fire the download. Match pdf-composer hydrator's URL-clean
    // behaviour.
    const cleaned = new URLSearchParams(searchParams.toString());

    cleaned.delete(EXPORT_INTENT_PARAM);
    cleaned.delete(EXPORT_FILENAME_PARAM);
    const nextQuery = cleaned.toString();

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);

    return () => window.clearTimeout(timeoutId);
  }, [authLoaded, isSignedIn, sessionId, searchParams, pathname, router]);

  // Dedup key + last successful downloadUrl. Even though the backend is
  // now idempotent for FINALIZED sessions, the frontend cache saves a
  // round-trip when the user clicks Download twice with unchanged
  // values / signature.
  const lastFinalizeRef = useRef<{ key: string; downloadUrl: string } | null>(
    null,
  );
  // Same idempotency for Save — dedup a second click with the same
  // values + signature + document identity.
  const lastSaveRef = useRef<{ key: string; documentId: string } | null>(null);

  useLayoutEffect(() => {
    const handler = (event: Event) => {
      // Prevent pdf-composer's `useExportEditor` from also running on
      // this event — server finalize is our source of truth here.
      event.stopImmediatePropagation();

      // PDF is native to the finalize endpoint; DOCX / PNG / JPG chain
      // the stamped PDF through `conversionService` AFTER finalize
      // returns. Any other value falls back to PDF so a stale caller
      // can't confuse the flow. Keep this allow-list in sync with the
      // W-9 filter in `ExportFormatModal`.
      const detail = (
        event as CustomEvent<{ format?: string; filename?: string }>
      ).detail;
      const rawFormat = detail?.format;
      const requestedFormat: "pdf" | "docx" | "png" | "jpg" =
        rawFormat === "docx" || rawFormat === "png" || rawFormat === "jpg"
          ? rawFormat
          : "pdf";
      const requestedFilename = detail?.filename;
      const formatLabel =
        requestedFormat === "docx"
          ? "Word file"
          : requestedFormat === "png"
            ? "PNG image"
            : requestedFormat === "jpg"
              ? "JPG image"
              : "PDF";

      const { sessionId, values, signatureKey } = useFormEditorStore.getState();

      if (!sessionId) {
        toast.error({
          title: "Session not ready",
          description:
            "Give it a moment while we start your W-9 session, then try Download again.",
        });

        return;
      }

      // Auth gate — W-9 download is a paid feature; must be signed in
      // before we can bill/entitle. Wait for Clerk to hydrate so we
      // don't misfire before the session is known (matches item #1 of
      // the auth chain — reading auth state directly, not via the
      // pdf-editor store which lags a tick).
      if (!authLoadedRef.current) {
        toast.error({
          title: "Just a sec",
          description: "Signing you in — try Download again in a moment.",
        });

        return;
      }

      if (!isSignedInRef.current) {
        // Persist the typed values so the user doesn't lose them
        // through the sign-in redirect. W9EditorBootstrap re-hydrates
        // them on the post-signin mount. Signature is re-drawn because
        // the new session's S3 namespace won't accept the old key.
        savePendingW9Values(values);

        // 2026-09-04 (QA fix): redirect goes to the composer
        // (`ROUTES.FORMS.W9_SHORT`) with `?export=<format>` so the
        // paywall auto-fires the moment auth completes. Previously
        // this went to `ROUTES.FORMS.W9` (marketing landing), forcing
        // the user to click "Get Form" a second time. The auto-launch
        // effect below picks up the `?export=` param, waits for the
        // session to be ready, then re-dispatches `editor:export` —
        // matching the pdf-composer `?export=` pattern in the general
        // auth chain (items #1–4). Cards still finalize with
        // `window.location.assign` (item #15) so iOS Safari commits
        // the session cookie before the nav.
        //
        // 2026-09-04 (parity with pdf-composer): open the email-first
        // modal instead of AuthModal(login). The email-first probe
        // routes existing accounts to LoginToDownloadModal AND auto-
        // creates a Clerk user (verified email + emailed password) on
        // `form_identifier_not_found`, then signs the user in via a
        // one-time ticket. Previously the login card dead-ended new
        // users at "We couldn't find an account with that email."
        dispatchEmailFirstModal({
          redirectUrl: buildW9ReturnUrl(requestedFormat, requestedFilename),
          submitLabel: "Download file",
          subtitle: "Create an account to download it",
          title: "Your W-9 is ready",
        });

        return;
      }

      const normalizedValues = normalizeW9ValuesForFinalize(values);
      // Key covers everything the backend stamps into the PDF. Any change
      // to a value, the signature, or the session invalidates the cache
      // and forces a fresh finalize call.
      const cacheKey = `${sessionId}::${signatureKey ?? ""}::${JSON.stringify(
        normalizedValues,
      )}`;

      if (lastFinalizeRef.current && lastFinalizeRef.current.key === cacheKey) {
        // Second (or Nth) click with identical payload — reuse the URL
        // the backend gave us the first time. Skip the network call so
        // the backend's "already finalized" 400 never surfaces. Word
        // requests still need the conversion step below; PDF requests
        // fire the download directly against the cached URL.
        const cachedDownloadUrl = lastFinalizeRef.current.downloadUrl;

        void (async () => {
          if (requestedFormat === "docx") {
            const docxLoadingKey = toast.loading({
              title: "Converting to Word",
              description: "Turning your stamped W-9 into a .docx…",
            });

            try {
              await convertAndDownloadW9AsDocx(
                cachedDownloadUrl,
                requestedFilename,
              );
            } catch (convertErr) {
              logger.captureError(convertErr, "w9.convert_docx_cached");
              toast.error({
                title: "Word conversion failed",
                description: "Please try Download again in a moment.",
              });
              toast.close(docxLoadingKey);

              return;
            }
            toast.close(docxLoadingKey);
          } else if (requestedFormat === "png" || requestedFormat === "jpg") {
            const imgLoadingKey = toast.loading({
              title: `Converting to ${requestedFormat.toUpperCase()}`,
              description: `Turning your stamped W-9 into a .${requestedFormat}…`,
            });

            try {
              await convertAndDownloadW9AsImage(
                cachedDownloadUrl,
                requestedFormat,
                requestedFilename,
              );
            } catch (convertErr) {
              logger.captureError(
                convertErr,
                `w9.convert_${requestedFormat}_cached`,
              );
              toast.error({
                title: `${requestedFormat.toUpperCase()} conversion failed`,
                description: "Please try Download again in a moment.",
              });
              toast.close(imgLoadingKey);

              return;
            }
            toast.close(imgLoadingKey);
          } else {
            triggerDownload(cachedDownloadUrl);
          }

          // Retry the library save if the first attempt failed. The
          // finalize cache hitting doesn't mean the library upload
          // succeeded — if the backend was down last time, this click
          // still needs to land the row in My PDFs. Filename mirrors
          // the modal so a rename before Download → PDF renames the
          // library row too.
          const savedNow = await ensureLibrarySave(
            cachedDownloadUrl,
            sessionId,
            values,
            signatureKey,
            normalizedValues,
            lastSaveRef,
            queryClientRef,
            normalizeLibraryFilename(requestedFilename),
          );

          toast.success({
            title: "W-9 ready",
            description: savedNow
              ? `Your filled ${formatLabel} has downloaded and been saved to My PDFs.`
              : `Your filled ${formatLabel} has downloaded.`,
          });
        })();

        return;
      }

      const loadingKey = toast.loading({
        title: "Preparing your W-9",
        description: "Stamping your values onto the template…",
      });

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
          // Entitlement gate — W-9 download is a paid feature. Runs
          // BEFORE the finalize network call so a non-entitled user
          // never triggers the backend stamp job. The loading toast
          // is intentionally left up under the paywall modal so the
          // user sees state resume without an extra flicker after
          // purchase.
          const entitled = await ensureFreshEntitlement();

          if (!entitled) {
            const outcome = await requestPaywall({
              filename: "w-9.pdf",
              sourceExt: "pdf",
              targetExt: "pdf",
            });

            if (outcome !== "success") {
              // User cancelled or paywall errored — bail silently.
              // The paywall UI surfaces its own error state.
              return;
            }
          }

          // Re-upload the signature if we only have a preview from a
          // resumed session (no key registered against the current
          // session's S3 namespace). Falls back to the pre-existing
          // key if the reupload fails so the user still gets a
          // download (backend will 422 if a signature was required
          // and the resulting key is null — surfaces via the toast).
          const effectiveSignatureKey =
            (await ensureSignatureKeyForSession(sessionId)) ?? signatureKey;

          const { downloadUrl } = await formsService.finalizeFormSession({
            sessionId,
            values: normalizedValues,
            signatureKey: effectiveSignatureKey,
          });

          // Cache so repeat clicks with the same values reuse this URL
          // instead of re-hitting the backend (which currently rejects a
          // second finalize on the same session with a 400).
          lastFinalizeRef.current = { key: cacheKey, downloadUrl };

          if (requestedFormat === "docx") {
            // Word branch: fetch the stamped PDF the finalize endpoint
            // just produced, send it through the shared conversion
            // service (`pdf_to_docx`), then download the resulting
            // .docx. Failure surfaces as a toast — the user can retry
            // Download (finalize cache hits, no re-stamp cost) or
            // switch back to PDF.
            try {
              await convertAndDownloadW9AsDocx(downloadUrl, requestedFilename);
            } catch (convertErr) {
              logger.captureError(convertErr, "w9.convert_docx", { sessionId });
              toast.error({
                title: "Word conversion failed",
                description:
                  "Your PDF is ready via Download → PDF. Please try Word again in a moment.",
              });

              return;
            }
          } else if (requestedFormat === "png" || requestedFormat === "jpg") {
            // Image branch: same pipeline as DOCX but through
            // `pdf_to_png` / `pdf_to_jpg`. Backend routes CloudConvert;
            // failure falls back to the "try PDF" hint so the user
            // isn't stuck.
            try {
              await convertAndDownloadW9AsImage(
                downloadUrl,
                requestedFormat,
                requestedFilename,
              );
            } catch (convertErr) {
              logger.captureError(convertErr, `w9.convert_${requestedFormat}`, {
                sessionId,
              });
              toast.error({
                title: `${requestedFormat.toUpperCase()} conversion failed`,
                description:
                  "Your PDF is ready via Download → PDF. Please try again in a moment.",
              });

              return;
            }
          } else {
            // `download` attribute suggests a filename; some CORS setups
            // ignore it and rely on Content-Disposition — either way the
            // user gets the PDF.
            triggerDownload(downloadUrl);
          }

          // ALSO save the stamped copy to the user's library. The
          // "Done → Download" flow is the only save affordance on
          // `/w-9-form` (the standalone Save button is hidden per
          // product), so if we don't persist here the user's filled
          // W-9 never lands in My PDFs. Library row uses the modal-
          // supplied filename so a rename before Download renames the
          // saved copy too.
          const savedNow = await ensureLibrarySave(
            downloadUrl,
            sessionId,
            values,
            signatureKey,
            normalizedValues,
            lastSaveRef,
            queryClientRef,
            normalizeLibraryFilename(requestedFilename),
          );

          toast.success({
            title: "W-9 ready",
            description: savedNow
              ? `Your filled ${formatLabel} has downloaded and been saved to My PDFs.`
              : `Your filled ${formatLabel} has downloaded. Save to My PDFs failed — please try again.`,
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

          // Server rejected the form (validation). Rather than block
          // the user, stamp the W-9 client-side with whatever they've
          // typed so far and deliver the partial download. Non-PDF
          // formats route the client-stamped bytes through the same
          // conversion service the server-stamp path uses.
          try {
            const previewNow =
              useFormEditorStore.getState().signaturePreview ?? null;
            const stampedBytes = await stampW9Client(values, previewNow);
            const stampedBlob = new Blob([stampedBytes.buffer as ArrayBuffer], {
              type: "application/pdf",
            });
            const baseName = (requestedFilename?.trim() || "w-9").replace(
              /\.[^./\\]+$/,
              "",
            );

            if (requestedFormat === "docx") {
              const pdfFile = new File([stampedBlob], "w-9.pdf", {
                type: "application/pdf",
              });
              const result = await conversionService.convert({
                file: pdfFile,
                type: "pdf_to_docx",
              });

              triggerBlobDownload(result.blob, `${baseName}.docx`);
            } else if (requestedFormat === "png" || requestedFormat === "jpg") {
              const pdfFile = new File([stampedBlob], "w-9.pdf", {
                type: "application/pdf",
              });
              const result = await conversionService.convert({
                file: pdfFile,
                type: requestedFormat === "png" ? "pdf_to_png" : "pdf_to_jpg",
              });

              // Same zip-unpack + per-page download path the primary
              // branch uses so users always get separate image files.
              // Client-side pdf.js render is the fallback if the zip
              // is malformed.
              await deliverImagesFromConvertResult(
                result.blob,
                result.fileName,
                requestedFormat,
                requestedFilename,
                () =>
                  downloadPdfBytesAsImagesZipClient(
                    stampedBytes,
                    requestedFormat,
                    requestedFilename,
                  ),
              );
            } else {
              triggerBlobDownload(stampedBlob, `${baseName}.pdf`);
            }

            toast.success({
              title: "Partial W-9 ready",
              description: `Downloaded your ${formatLabel} with what you've entered so far. Add any missing fields or a signature and Download again for a complete copy.`,
            });

            return;
          } catch (fallbackErr) {
            logger.captureError(fallbackErr, "w9.client_stamp_fallback", {
              sessionId,
            });
            // Client fallback also failed — surface the original
            // server error / friendly signature hint so the user sees
            // *something* actionable.
            const friendly = friendlySignatureError(parsed);

            toast.error(
              friendly ?? {
                title: "Couldn't generate the W-9",
                description: parsed.message,
              },
            );
          }
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
    const saveBeforeActionHandler = (event: Event) => {
      event.stopImmediatePropagation();
      const detail = (event as CustomEvent<SaveBeforeActionDetail>).detail;

      detail?.onComplete?.({ ok: true });
    };

    // QA 2026-08-27: `useSaveEditor` would otherwise Fabric-merge the
    // blank W-9 template + upload the result — the yellow form-fill
    // overlays live in `useFormEditorStore`, not on the Fabric canvas,
    // so that save persisted an empty PDF and every reopen from the
    // dashboard looked blank. Route Save through the same finalize
    // backend the download uses (stamps values + signature onto the
    // template), fetch the stamped bytes, then upload THOSE to the
    // library. Include the raw form values in `editorState` under a
    // `w9` marker so `openDocumentInEditor` can round-trip the user
    // back to `/w-9-form` with their entries pre-filled.
    const saveHandler = (event: Event) => {
      event.stopImmediatePropagation();

      const { sessionId, values, signatureKey } = useFormEditorStore.getState();
      const { currentDocumentId } = usePdfEditorStore.getState();

      if (!sessionId) {
        toast.error({
          title: "Session not ready",
          description:
            "Give it a moment while we start your W-9 session, then try Save again.",
        });

        return;
      }

      if (!authLoadedRef.current) {
        toast.error({
          title: "Just a sec",
          description: "Signing you in — try Save again in a moment.",
        });

        return;
      }

      if (!isSignedInRef.current) {
        savePendingW9Values(values);
        // 2026-09-04 (QA fix): redirect to the composer, not the
        // marketing landing. Save doesn't need a format param — the
        // auto-launch effect only fires when `?export=` is present,
        // so signed-in-return-from-Save just lands the user back
        // in the composer with their values restored (no paywall
        // auto-fire, matching the manual-Save intent). See the
        // sibling Download branch above for the full rationale.
        //
        // 2026-09-04 (parity with pdf-composer): email-first modal
        // handles both existing-account login and auto-signup for
        // new emails. See the Download branch above for details.
        dispatchEmailFirstModal({
          redirectUrl: buildW9ReturnUrl(),
          submitLabel: "Save to your library",
          subtitle: "Create an account to save your W-9",
          title: "Save your W-9",
        });

        return;
      }

      const normalizedValues = normalizeW9ValuesForFinalize(values);
      const cacheKey = `${sessionId}::${signatureKey ?? ""}::${JSON.stringify(
        normalizedValues,
      )}::${currentDocumentId ?? ""}`;

      if (lastSaveRef.current && lastSaveRef.current.key === cacheKey) {
        toast.info({
          title: "Already saved",
          description: "No changes since your last save.",
        });

        return;
      }

      const loadingKey = toast.loading({
        title: "Saving your W-9",
        description: "Stamping your values and saving to your library.",
      });

      void (async () => {
        try {
          // Save routes through finalize (a paid feature). Same
          // entitlement flow as the download intercept so users
          // pay once and both save + download work.
          const entitled = await ensureFreshEntitlement();

          if (!entitled) {
            const outcome = await requestPaywall({
              filename: "w-9.pdf",
              sourceExt: "pdf",
              targetExt: "pdf",
            });

            if (outcome !== "success") return;
          }

          const effectiveSignatureKey =
            (await ensureSignatureKeyForSession(sessionId)) ?? signatureKey;

          const { downloadUrl } = await formsService.finalizeFormSession({
            sessionId,
            values: normalizedValues,
            signatureKey: effectiveSignatureKey,
          });

          const res = await fetch(downloadUrl);

          if (!res.ok) {
            throw new Error(
              `Couldn't fetch the stamped W-9 (HTTP ${res.status}).`,
            );
          }
          const blob = await res.blob();
          const stampedFile = new File([blob], W9_LIBRARY_FILENAME, {
            type: "application/pdf",
          });

          const editorState = JSON.stringify({
            v: 1,
            w9: {
              values,
              signatureKey: effectiveSignatureKey,
              // Persist the local preview data URL so reopening the
              // W-9 from Dashboard restores the visible signature on
              // the form overlay. `signatureKey` alone can't be
              // rendered — SignatureField reads `signaturePreview`
              // (see fields/SignatureField.tsx) — and the fresh
              // session on reopen doesn't have this cached anywhere
              // else (QA 2026-08-28).
              signaturePreview: useFormEditorStore.getState().signaturePreview,
            },
          });

          const document = await documentsService.uploadDocument({
            file: stampedFile,
            documentId: currentDocumentId ?? undefined,
            editorState,
          });

          usePdfEditorStore.getState().setCurrentDocument({
            id: document.id,
            name: document.filename,
          });
          lastSaveRef.current = { key: cacheKey, documentId: document.id };

          try {
            queryClientRef.current?.invalidateQueries({
              queryKey: documentKeys.lists(),
            });
          } catch {
            /* non-fatal */
          }

          toast.success({
            title: "Saved to your library",
            description: "Your filled W-9 is now in My PDFs.",
          });
        } catch (err) {
          logger.captureError(err, "w9.save");
          const parsed = extractApiFieldErrors(err);

          // Server validators (tin xor, MM/DD/YYYY date, non-empty
          // signature, etc.) reject partial forms. Rather than dead-
          // end the user with a raw validator string, stamp the W-9
          // client-side with whatever they've entered so far and
          // upload THAT to My PDFs. Same pattern as the download
          // fallback so both flows behave identically.
          try {
            const previewNow =
              useFormEditorStore.getState().signaturePreview ?? null;
            const stampedBytes = await stampW9Client(values, previewNow);
            const partialFile = new File(
              [stampedBytes.buffer as ArrayBuffer],
              W9_LIBRARY_FILENAME,
              { type: "application/pdf" },
            );
            const partialEditorState = JSON.stringify({
              v: 1,
              w9: {
                values,
                signatureKey: null,
                signaturePreview: previewNow,
              },
            });
            const savedDoc = await documentsService.uploadDocument({
              file: partialFile,
              documentId: currentDocumentId ?? undefined,
              editorState: partialEditorState,
            });

            usePdfEditorStore.getState().setCurrentDocument({
              id: savedDoc.id,
              name: savedDoc.filename,
            });
            lastSaveRef.current = {
              key: cacheKey,
              documentId: savedDoc.id,
            };

            try {
              queryClientRef.current?.invalidateQueries({
                queryKey: documentKeys.lists(),
              });
            } catch {
              /* non-fatal */
            }

            toast.success({
              title: "Partial W-9 saved",
              description:
                "Your progress is in My PDFs. Fill the remaining fields and Save again for a completed copy.",
            });

            return;
          } catch (fallbackErr) {
            logger.captureError(fallbackErr, "w9.save_client_fallback");
            const friendly = friendlySignatureError(parsed);

            toast.error(
              friendly ?? {
                title: "Couldn't save the W-9",
                description: parsed.message,
              },
            );
          }
        } finally {
          toast.close(loadingKey);
        }
      })();
    };

    // Hamburger Back → My PDFs on /w-9-form dispatches this event and
    // awaits `onComplete` before navigating. Mirrors the standalone
    // `saveHandler` (finalize → fetch stamped → upload with editorState
    // w9 marker) but resolves the caller's promise so navigation only
    // fires once the row is persisted. Existing paths are untouched —
    // if this event isn't dispatched, nothing changes. If the user
    // hasn't touched the form yet OR it matches the last save cache,
    // we short-circuit with `ok: true` so the nav proceeds immediately.
    const saveAndContinueHandler = (event: Event) => {
      event.stopImmediatePropagation();
      const detail = (event as CustomEvent<SaveAndContinueDetail>).detail;
      const { sessionId, values, signatureKey } = useFormEditorStore.getState();
      const { currentDocumentId } = usePdfEditorStore.getState();

      if (!sessionId) {
        detail.onComplete({ ok: true, reason: "not-ready" });

        return;
      }

      if (!authLoadedRef.current || !isSignedInRef.current) {
        // Signed-out on W-9: nothing to save (finalize would 401).
        // Resolve with reason so the caller can decide (currently it
        // just navigates — user can sign in from dashboard and their
        // in-progress values live on in the form session backend).
        detail.onComplete({ ok: true, reason: "not-signed-in" });

        return;
      }

      const hasAnyValue = Object.values(values ?? {}).some(
        (v) => typeof v === "string" && v.trim() !== "",
      );

      if (!hasAnyValue && !signatureKey) {
        // Empty form — nothing worth stamping. Skip the finalize call
        // (which the backend rejects with a validation error) and let
        // the caller continue.
        detail.onComplete({ ok: true, reason: "not-ready" });

        return;
      }

      const normalizedValues = normalizeW9ValuesForFinalize(values);
      const cacheKey = `${sessionId}::${signatureKey ?? ""}::${JSON.stringify(
        normalizedValues,
      )}::${currentDocumentId ?? ""}`;

      if (lastSaveRef.current && lastSaveRef.current.key === cacheKey) {
        // Already persisted this exact payload — no work to do.
        detail.onComplete({ ok: true });

        return;
      }

      void (async () => {
        try {
          const entitled = await ensureFreshEntitlement();

          if (!entitled) {
            const outcome = await requestPaywall({
              filename: "w-9.pdf",
              sourceExt: "pdf",
              targetExt: "pdf",
            });

            if (outcome !== "success") {
              detail.onComplete({ ok: false, reason: "cancelled" });

              return;
            }
          }

          const effectiveSignatureKey =
            (await ensureSignatureKeyForSession(sessionId)) ?? signatureKey;

          const { downloadUrl } = await formsService.finalizeFormSession({
            sessionId,
            values: normalizedValues,
            signatureKey: effectiveSignatureKey,
          });

          const res = await fetch(downloadUrl);

          if (!res.ok) {
            throw new Error(
              `Couldn't fetch the stamped W-9 (HTTP ${res.status}).`,
            );
          }
          const blob = await res.blob();
          const stampedFile = new File([blob], W9_LIBRARY_FILENAME, {
            type: "application/pdf",
          });
          const editorState = JSON.stringify({
            v: 1,
            w9: {
              values,
              signatureKey: effectiveSignatureKey,
              // Persist the local preview data URL so reopening the
              // W-9 from Dashboard restores the visible signature on
              // the form overlay. `signatureKey` alone can't be
              // rendered — SignatureField reads `signaturePreview`
              // (see fields/SignatureField.tsx) — and the fresh
              // session on reopen doesn't have this cached anywhere
              // else (QA 2026-08-28).
              signaturePreview: useFormEditorStore.getState().signaturePreview,
            },
          });
          const document = await documentsService.uploadDocument({
            file: stampedFile,
            documentId: currentDocumentId ?? undefined,
            editorState,
          });

          usePdfEditorStore.getState().setCurrentDocument({
            id: document.id,
            name: document.filename,
          });
          lastSaveRef.current = { key: cacheKey, documentId: document.id };

          try {
            queryClientRef.current?.invalidateQueries({
              queryKey: documentKeys.lists(),
            });
          } catch {
            /* non-fatal */
          }

          detail.onComplete({ ok: true });
        } catch (err) {
          logger.captureError(err, "w9.save_and_continue");

          // Backend rejected the finalize (missing date / TIN /
          // signature — the partial-form path). Stamp the W-9 client
          // side with whatever's in the store and upload THAT to My
          // PDFs so the back-button save still succeeds. Matches the
          // download + save-button fallbacks so all three paths agree.
          try {
            const previewNow =
              useFormEditorStore.getState().signaturePreview ?? null;
            const stampedBytes = await stampW9Client(values, previewNow);
            const partialFile = new File(
              [stampedBytes.buffer as ArrayBuffer],
              W9_LIBRARY_FILENAME,
              { type: "application/pdf" },
            );
            const partialEditorState = JSON.stringify({
              v: 1,
              w9: {
                values,
                signatureKey: null,
                signaturePreview: previewNow,
              },
            });
            const savedDoc = await documentsService.uploadDocument({
              file: partialFile,
              documentId: currentDocumentId ?? undefined,
              editorState: partialEditorState,
            });

            usePdfEditorStore.getState().setCurrentDocument({
              id: savedDoc.id,
              name: savedDoc.filename,
            });
            lastSaveRef.current = {
              key: cacheKey,
              documentId: savedDoc.id,
            };

            try {
              queryClientRef.current?.invalidateQueries({
                queryKey: documentKeys.lists(),
              });
            } catch {
              /* non-fatal */
            }

            detail.onComplete({ ok: true });
          } catch (fallbackErr) {
            logger.captureError(
              fallbackErr,
              "w9.save_and_continue_client_fallback",
            );
            detail.onComplete({ ok: false, reason: "error" });
          }
        }
      })();
    };

    window.addEventListener(SAVE_BEFORE_ACTION_EVENT, saveBeforeActionHandler, {
      capture: true,
    });
    window.addEventListener(EXPORT_EVENT, handler, { capture: true });
    window.addEventListener(SAVE_EVENT, saveHandler, { capture: true });
    window.addEventListener(
      SAVE_AND_CONTINUE_EVENT,
      saveAndContinueHandler as EventListener,
      { capture: true },
    );

    return () => {
      window.removeEventListener(
        SAVE_BEFORE_ACTION_EVENT,
        saveBeforeActionHandler,
        { capture: true },
      );
      window.removeEventListener(EXPORT_EVENT, handler, { capture: true });
      window.removeEventListener(SAVE_EVENT, saveHandler, { capture: true });
      window.removeEventListener(
        SAVE_AND_CONTINUE_EVENT,
        saveAndContinueHandler as EventListener,
        { capture: true },
      );
    };
  }, []);

  return null;
}
