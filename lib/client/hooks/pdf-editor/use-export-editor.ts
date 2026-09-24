"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef } from "react";

import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import { useConvertFileMutation } from "@/lib/client/query/mutations/conversion.mutation";
import { buildEditedPdfBytes } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import { parseLocalePrefix } from "@/lib/shared/constants/locale-map";
import { ROUTES } from "@/lib/shared/constants/routes";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";
import { trackActivation } from "@/lib/client/analytics/gtag";

export type ExportFormat =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "jpg"
  | "png"
  | "html"
  | "txt";

export type EditorExportEventDetail = {
  format: ExportFormat;
  /**
   * Optional user-chosen base name (no extension). Emitted by the top-bar
   * format modal so the download honours the "File name" field. When absent
   * the source file's own basename is used, preserving the pre-modal default.
   */
  filename?: string;
  /** When true, open the browser print dialog instead of downloading. */
  print?: boolean;
};

const FORMAT_TO_CONVERSION_TYPE: Record<
  Exclude<ExportFormat, "pdf">,
  | "pdf_to_docx"
  | "pdf_to_xlsx"
  | "pdf_to_pptx"
  | "pdf_to_jpg"
  | "pdf_to_png"
  | "pdf_to_html"
  | "pdf_to_txt"
> = {
  docx: "pdf_to_docx",
  html: "pdf_to_html",
  jpg: "pdf_to_jpg",
  png: "pdf_to_png",
  pptx: "pdf_to_pptx",
  txt: "pdf_to_txt",
  xlsx: "pdf_to_xlsx",
};

/**
 * True when the user has actively rejected non-necessary CookieYes categories.
 * CookieYes stores its consent state in `cookieyes-consent`; when the user
 * rejects, that cookie carries `consent:no` for functional / analytics /
 * performance / advertisement / other. If any of those are `no`, CookieYes'
 * auto-blocker is actively intercepting fetch / XHR / script tags — the
 * likely cause of a bare AbortError in the export pipeline.
 * Client-only (reads `document.cookie`); returns false in SSR.
 */
function hasCookieYesRejection(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const raw = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("cookieyes-consent="));

    if (!raw) return false;
    // Value format is a URL-encoded, colon/comma-delimited string like
    // `consentid:...,consent:{necessary:yes,functional:no,analytics:no,...}`
    // — a simple substring match on any `:no` inside the consent map is
    // enough to detect a rejection without parsing the whole thing.
    const decoded = decodeURIComponent(raw.slice("cookieyes-consent=".length));

    return /:no\b/.test(decoded);
  } catch {
    return false;
  }
}

function buildPdfExportFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;

  return `${base} (edited).pdf`;
}

function sanitizeBaseName(input: string): string {
  const stripped = input.replace(/\.[^./\\]+$/, "").trim();

  return stripped.length > 0 ? stripped : "document";
}

function ensureExtension(base: string, ext: string): string {
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  // QA 2026-09-07: pass the Uint8Array view directly. Passing `bytes.buffer`
  // sends the ENTIRE underlying ArrayBuffer to Blob — if `bytes` is a view
  // (byteOffset > 0 OR byteLength < buffer.byteLength), the Blob is corrupt
  // (extra bytes before/after the PDF stream) and PDF readers fall back to
  // displaying only what they can parse before the corruption — the exact
  // "download is missing my edits" symptom.
  // The `as BlobPart` cast is because lib.dom.d.ts types `Uint8Array<ArrayBufferLike>`
  // (which allows SharedArrayBuffer), while Blob wants `ArrayBufferView<ArrayBuffer>`.
  // pdf-lib's `save()` output is always plain ArrayBuffer-backed at runtime.
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Listens for `editor:export` (dispatched by the Export menu) and either:
 * - For PDF: checks entitlement, downloads/prints (paywall if not entitled).
 * - For non-PDF: attempts conversion first (bypassing client gate so the
 *   server decides); if 402 (not entitled) opens paywall with PDF preview,
 *   then retries conversion after payment.
 */
export function useExportEditor(fabricCanvas: FabricCanvas | null) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);
  // Read auth from Clerk directly rather than from the store's cached
  // `isSignedIn` — the store copy is updated in a separate useEffect
  // downstream (PdfEditorShell → setIsSignedIn), and there is a window
  // during the auth-return flow where that sync hasn't run yet. Reading
  // Clerk's hook keeps the export gate honest at the exact moment the
  // event fires.
  const { isLoaded: authLoaded, isSignedIn: clerkIsSignedIn } = useAuth();
  const convert = useConvertFileMutation();

  const isExportingRef = useRef(false);
  const pdfDocDeferredAttemptsRef = useRef(0);
  const stateRef = useRef({
    currentPage,
    fabricCanvas,
    file,
    authLoaded,
    clerkIsSignedIn,
  });

  useEffect(() => {
    stateRef.current = {
      currentPage,
      fabricCanvas,
      file,
      authLoaded,
      clerkIsSignedIn,
    };
  }, [currentPage, fabricCanvas, file, authLoaded, clerkIsSignedIn]);

  const convertRef = useRef(convert);

  useEffect(() => {
    convertRef.current = convert;
  }, [convert]);

  const handleExport = useCallback(
    async (
      format: ExportFormat,
      customFilename?: string,
      shouldPrint?: boolean,
    ) => {
      if (isExportingRef.current) return;

      // Read `file` and `currentPage` directly from the Zustand store rather
      // than the React-ref cache. When export is triggered right after a
      // save-before-action (Download modal flow), `applyPostSaveReset` has
      // already swapped `store.file` to the newly saved bytes, but the
      // `useEffect` that mirrors props into `stateRef` may not have run yet.
      // Reading `stateRef.current.file` in that window returns the OLD file
      // while `pdfDocument` is already the NEW one — the merge produces an
      // inconsistent PDF that the backend rejects with a validation error on
      // the first attempt. The second click succeeds only because React has
      // re-committed by then. See QA report 2026-08-19.
      const storeSnapshot = usePdfEditorStore.getState();
      const page = storeSnapshot.currentPage;
      const sourceFile = storeSnapshot.file;
      const {
        fabricCanvas: liveCanvas,
        authLoaded: authReady,
        clerkIsSignedIn: signedIn,
      } = stateRef.current;

      // EXPORT-DIAG: snapshot the state at export entry so we can see, from
      // console logs alone, which drop-candidate lost the user's edits.
      // Correlates with `buildEditedPdfBytes` and `mergeFabricEditsIntoPdf`
      // logs downstream.
      try {
        const preFlushObjectCount = liveCanvas
          ? liveCanvas.getObjects().length
          : null;
        const preFlushTypes = liveCanvas
          ? liveCanvas.getObjects().map((o) => ({
              type: (o as { type?: string }).type,
              editorType: (o as { editorType?: string }).editorType,
            }))
          : null;
        const jsonMap = storeSnapshot.fabricJsonByPage;
        const jsonSummary: Record<number, number> = {};

        jsonMap.forEach((json, pageNum) => {
          try {
            const parsed = JSON.parse(json) as { objects?: unknown[] };

            jsonSummary[pageNum] = parsed.objects?.length ?? 0;
          } catch {
            jsonSummary[pageNum] = -1;
          }
        });
        // eslint-disable-next-line no-console
        console.log("[PDFedits] EXPORT-DIAG: handleExport entry", {
          format,
          currentPage: page,
          fileName: sourceFile?.name ?? null,
          liveCanvasPresent: !!liveCanvas,
          liveCanvasObjectCount: preFlushObjectCount,
          liveCanvasTypes: preFlushTypes,
          storeFabricJsonPages: Array.from(jsonMap.keys()),
          storeFabricJsonObjectCountByPage: jsonSummary,
          hasUnsavedChanges: storeSnapshot.hasUnsavedChanges,
        });
      } catch (diagErr) {
        logger.warn("[PDFedits] EXPORT-DIAG: entry log failed", diagErr);
      }

      logger.event(EVENTS.EXPORT_START, "info", {
        format,
        signedIn,
        authReady,
        hasFile: Boolean(sourceFile),
        pageCount: storeSnapshot.fabricJsonByPage.size,
      });

      if (!sourceFile) {
        logger.event(EVENTS.EXPORT_NO_FILE, "warning", { format });
        toast.error({
          title: "Nothing to export",
          description: "Open a PDF before exporting.",
        });

        return;
      }

      // If Clerk hasn't finished hydrating yet, defer for a short beat and
      // re-dispatch the export event. Otherwise a fresh-return-from-sign-in
      // load can fire editor:export before authLoaded flips to true — we'd
      // read isSignedIn=false and pointlessly redirect the user back into
      // the sign-in flow they just completed. Re-dispatching (rather than
      // recursing into handleExport) keeps the closure lint rule happy and
      // still routes through the listener once auth is ready.
      if (!authReady) {
        logger.breadcrumb("export", "auth.deferred", { format });
        isExportingRef.current = false;
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("editor:export", {
              detail: { filename: customFilename, format },
            }),
          );
        }, 250);

        return;
      }

      // Same defer-and-retry shape for pdf.js: the hydrator's post-signin
      // auto-launch and the `/convert/*` → editor navigation both fire
      // `editor:export` a fixed ~400ms after the file lands, but
      // `usePdfLoader` can take longer on large PDFs or slow networks.
      // `buildEditedPdfBytes` throws "PDF document not loaded" if the
      // store's `pdfDocument` is still null. Cap at ~10 s so a genuinely
      // failed load (corrupt / password-protected PDF) surfaces a
      // user-facing error instead of retrying forever.
      if (!storeSnapshot.pdfDocument) {
        const attempts = (pdfDocDeferredAttemptsRef.current += 1);

        if (attempts > 40) {
          pdfDocDeferredAttemptsRef.current = 0;
          logger.warn("[PDFedits] export: pdf document never loaded", {
            format,
          });
          toast.error({
            title: "PDF still loading",
            description:
              "Wait for the document to finish loading, then try again.",
          });

          return;
        }
        logger.breadcrumb("export", "pdf_document.deferred", {
          format,
          attempts,
        });
        isExportingRef.current = false;
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("editor:export", {
              detail: { filename: customFilename, format },
            }),
          );
        }, 250);

        return;
      }
      pdfDocDeferredAttemptsRef.current = 0;

      isExportingRef.current = true;

      // "Preparing your file…" toast — visible while the export
      // pipeline runs so the subscribed user has feedback while the
      // bake + (optional) backend convert + download does its work.
      // QA 2026-09-10: "when Download / Convert pressed we should get
      // a toast of preparing file for export if the user is subscribed
      // already." Opened right before we start doing anything the user
      // can't perceive on their own, closed unconditionally in the
      // top-level finally so it can't leak on any exit path.
      // Format-aware label so PDF says "PDF", DOCX says "Word", etc.
      const readableFormat =
        format === "docx"
          ? "Word"
          : format === "xlsx"
            ? "Excel"
            : format === "pptx"
              ? "PowerPoint"
              : format.toUpperCase();
      let preparingToastKey: string | null = null;
      const openPreparingToast = () => {
        if (preparingToastKey) return;
        preparingToastKey = toast.loading({
          title: `Preparing your ${readableFormat} file…`,
          description: shouldPrint
            ? "Baking your edits before opening print."
            : "Baking your edits and getting the download ready.",
        });
      };

      try {
        // ALL downloads (including plain PDF) require sign-in + subscription.
        // Guests can open a PDF and edit it locally, but downloading —
        // in any format — is a paid feature. Gate the auth check FIRST so
        // a signed-out user is routed through sign-in before we even open
        // the paywall — otherwise the paywall opens on an anon client and
        // hits "Couldn't start checkout". After sign-in the user returns
        // to the same editor with `?export=<fmt>` set, so the export
        // re-fires automatically.
        if (!signedIn) {
          logger.event(EVENTS.EXPORT_SIGNIN_REQUIRED, "info", { format });
          try {
            // Persist file + per-page Fabric edits + extractedPages across
            // the full-page sign-in redirect so the editor can rehydrate
            // the exact state on return. Still done even though the new
            // bake-and-upload path below covers the same case — the IDB
            // snapshot is the fallback when the upload half of
            // `runAutoSignup` fails (network hiccup, backend downtime).
            // The helper flushes the live canvas for the current page
            // first — the store may lag one page-navigation behind the
            // visible canvas.
            await snapshotPendingEditorFile(liveCanvas);
            logger.breadcrumb("export", "pending_file.saved", {
              format,
              hasFabricEdits:
                usePdfEditorStore.getState().fabricJsonByPage.size > 0,
            });
          } catch (err) {
            logger.captureError(err, "export.pending_file", { format });
          }

          // NEW (2026-09-18): pre-bake the file so `runAutoSignup` can
          // upload it via `/documents/upload` right after ticket
          // sign-in. The resulting docId is passed into `POST
          // /auth/quick-signup/notify` so the Customer.io welcome
          // email's CTA links straight to the composer with THIS file
          // loaded — same on the current device (same-session
          // finalize also uses `?id=<docId>`) and on any other device
          // where the user later opens the email (cloud storage
          // instead of IDB). Bake failure is non-fatal: modal still
          // opens, upload falls back to the IDB-restore hydrator
          // path, welcome email lands with the dashboard fallback URL.
          let bakedFile: File | undefined;

          if (sourceFile && liveCanvas) {
            try {
              const { bytes } = await buildEditedPdfBytes({
                currentPage: page,
                fabricCanvas: liveCanvas,
                file: sourceFile,
                bakeOverlays: true,
              });
              const bakedName = sourceFile.name.toLowerCase().endsWith(".pdf")
                ? sourceFile.name
                : `${sourceFile.name}.pdf`;

              bakedFile = new File([bytes as BlobPart], bakedName, {
                type: "application/pdf",
              });
            } catch (err) {
              logger.captureError(err, "export.bake_for_guest", { format });
            }
          }

          // Preserve URL locale in the finalize redirect. Signup card's
          // `window.location.assign(redirectUrl)` (auth chain item #15)
          // does a FULL-page nav — if `returnTo` is bare `/pdf-composer`,
          // the user drops from `/fr/pdf-composer` back to English URL.
          // `LangPrefHonor` can't rescue post-signin because
          // `/pdf-composer` is in `SKIP_REDIRECT_PREFIXES` (reload-race
          // avoidance per #115 / #117). Cookie fallback in
          // `ComposerI18nProvider` (#126) translates the content but
          // leaves the URL bare; carrying the locale in `returnTo`
          // keeps the URL correct too.
          const editorPath = (() => {
            if (typeof window === "undefined") return ROUTES.TOOLS.PDF_EDITOR;
            const parsed = parseLocalePrefix(window.location.pathname);

            return parsed
              ? `/${parsed.locale}${ROUTES.TOOLS.PDF_EDITOR}`
              : ROUTES.TOOLS.PDF_EDITOR;
          })();
          const returnTo = `${editorPath}?export=${encodeURIComponent(format)}`;

          // Email-first modal (2026-08-30 PM ask): capture the email
          // BEFORE choosing signin vs signup so we can branch on
          // whether the account already exists. The modal probes
          // Clerk with `signIn.create({ identifier })`:
          //   - Found → dispatch AuthModal(login, email prefilled)
          //   - Not found → dispatch AuthModal(signup, email prefilled)
          // Either way the downstream card finalizes with
          // `window.location.assign(returnTo)` (item #15) → hydrator
          // restores the pending file (items #8–12) → `editor:export`
          // auto-fires (item #4). Chain intact.
          dispatchEmailFirstModal({
            redirectUrl: returnTo,
            // Editor Done → Download context — the user just clicked
            // Download, so frame the modal around their file, not
            // around "welcome back". Downstream auth chain (items
            // #1–4, #8–12, #15) is unchanged.
            title: "Your file is ready",
            subtitle: "Create an account to download it",
            submitLabel: "Download file",
            bakedFile,
          });

          isExportingRef.current = false;

          return;
        }

        // Now that the auth + hydration checks are behind us, open the
        // "Preparing your <format> file…" toast. This is the point at
        // which the user is committed to a real bake/convert. Signed-
        // out users hit the email-first modal above (line ~340) and
        // never reach here, so they don't see this toast. Closed
        // explicitly before every paywall entry point and again in
        // the top-level finally so it can never leak.
        openPreparingToast();

        // Build PDF bytes client-side first — no network call, always fast.
        const { bytes } = await buildEditedPdfBytes({
          currentPage: page,
          fabricCanvas: liveCanvas,
          file: sourceFile,
          bakeOverlays: true,
        });

        const userBase = customFilename
          ? sanitizeBaseName(customFilename)
          : null;

        // ── PDF export (download or print) ────────────────────────────────
        if (format === "pdf") {
          const entitled = await ensureFreshEntitlement();

          logger.breadcrumb("export", "entitlement.checked", {
            format,
            entitled,
          });

          if (!entitled) {
            // Close the "Preparing…" toast — the paywall is about to
            // take over the user's attention and the toast underneath
            // reads as noise. Reopened in the paywall-success branch
            // below if the user pays and we continue to the download.
            if (preparingToastKey) {
              toast.close(preparingToastKey);
              preparingToastKey = null;
            }
            logger.event(EVENTS.EXPORT_PAYWALL_SHOWN, "info", { format });
            // Diagnostic — feeds into the paywall's `checkout_intent_400`
            // triage. Bots occasionally reach the paywall with a
            // pathological `sourceFile.name` (empty, control chars,
            // oversized). Log the shape here so we can correlate a
            // downstream 400 back to the exact File that fed the
            // request.
            logger.event(EVENTS.EXPORT_PAYWALL_SHOWN, "info", {
              format,
              filenameLength: sourceFile.name?.length ?? 0,
              filenameEmpty: !sourceFile.name,
              filenameFirstChars: sourceFile.name?.slice(0, 40) ?? "",
              fileType: sourceFile.type,
              fileSize: sourceFile.size,
            });
            const pdfBlob = new Blob([bytes as BlobPart], {
              type: "application/pdf",
            });
            const objectUrl = URL.createObjectURL(pdfBlob);

            try {
              const outcome = await requestPaywall({
                filename: sourceFile.name,
                previewObjectUrl: objectUrl,
                sourceExt: "pdf",
                targetExt: "pdf",
              });

              if (outcome !== "success") {
                logger.event(EVENTS.EXPORT_PAYWALL_CANCELLED, "info", {
                  format,
                });

                return;
              }
              logger.event(EVENTS.EXPORT_PAYWALL_SUCCESS, "info", { format });
            } finally {
              URL.revokeObjectURL(objectUrl);
            }
            // Paywall succeeded — reopen the preparing toast for the
            // rest of the download work so the user knows the file is
            // still being prepared post-payment.
            openPreparingToast();
          }

          if (shouldPrint) {
            const blob = new Blob([bytes as BlobPart], {
              type: "application/pdf",
            });
            const url = URL.createObjectURL(blob);
            const iframe = document.createElement("iframe");

            iframe.style.cssText =
              "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
            iframe.src = url;
            document.body.appendChild(iframe);
            iframe.onload = () => {
              iframe.contentWindow?.print();
              setTimeout(() => {
                URL.revokeObjectURL(url);
                document.body.removeChild(iframe);
              }, 60_000);
            };

            return;
          }

          const outName = userBase
            ? ensureExtension(userBase, "pdf")
            : buildPdfExportFilename(sourceFile.name);

          // DEBUG mode: also drop a raw copy of the ORIGINAL source PDF so
          // you have both files locally and can open them side-by-side to
          // verify the bake actually added/moved content. Combined with
          // `pre-convert.pdf` (non-PDF exports) this gives full evidence
          // of every byte the client generates.
          try {
            const search =
              typeof window !== "undefined" ? window.location.search : "";
            const dbgParams = new URLSearchParams(search);
            const debugExport =
              dbgParams.get("debug_export") === "1" ||
              (typeof window !== "undefined" &&
                window.localStorage?.getItem("pdfeditsDebugExport") === "1");

            if (debugExport) {
              const originalBytes = new Uint8Array(
                await sourceFile.arrayBuffer(),
              );

              // eslint-disable-next-line no-console
              console.log(
                "[PDFedits] EXPORT-DIAG: DEBUG downloading ORIGINAL source PDF (compare against baked)",
                {
                  originalName: `${sourceFile.name.replace(/\.pdf$/i, "")}.ORIGINAL.pdf`,
                  originalLen: originalBytes.byteLength,
                  bakedLen: bytes.byteLength,
                  bytesDelta: bytes.byteLength - originalBytes.byteLength,
                },
              );
              downloadBytes(
                originalBytes,
                `${sourceFile.name.replace(/\.pdf$/i, "")}.ORIGINAL.pdf`,
              );
            }
          } catch (debugErr) {
            // eslint-disable-next-line no-console
            console.warn(
              "[PDFedits] EXPORT-DIAG: original source debug download failed",
              debugErr,
            );
          }

          // eslint-disable-next-line no-console
          console.log("[PDFedits] EXPORT-DIAG: PDF download triggered", {
            outName,
            bytesLen: bytes.byteLength,
          });
          downloadBytes(bytes, outName);
          trackActivation("pdf_editor_download");
          logger.event(EVENTS.EXPORT_SUCCESS, "info", {
            format,
            bytes: bytes.byteLength,
          });
          toast.success({
            title: "Exported",
            description: "Your edited PDF has been downloaded.",
          });

          return;
        }

        // ── Non-PDF export ────────────────────────────────────────────────
        // Check entitlement first. Non-entitled users see the paywall with a
        // PDF preview of their document; conversion only runs after payment so
        // there is never a wasted server-side conversion for non-premium users.
        const entitled = await ensureFreshEntitlement();

        const conversionType = FORMAT_TO_CONVERSION_TYPE[format];
        const baseName =
          userBase ?? (sourceFile.name.replace(/\.[^.]+$/, "") || "document");
        // QA 2026-09-07: pass Uint8Array view directly — see downloadBytes
        // for the buffer-view corruption class this avoids. Same bug shape:
        // `bytes.buffer` includes bytes outside the view range, which for
        // CloudConvert uploads would submit a corrupt PDF and yield empty /
        // stripped-content DOCX/XLSX output.
        const pdfFile = new File([bytes as BlobPart], `${baseName}.pdf`, {
          type: "application/pdf",
        });

        // DEBUG mode: also download the intermediate BAKED PDF that the
        // browser is about to POST to CloudConvert. Lets you open BOTH
        // files locally and compare:
        //   - `*.pre-convert.pdf` — what the browser produced (edits baked)
        //   - `*.docx` (or whatever format) — what CloudConvert returned
        //
        // Isolate the culprit:
        //   - Baked PDF looks wrong → client-side bake is the bug
        //   - Baked PDF is correct but DOCX drops edits → CloudConvert / its
        //     PDF→Office engine is the bug (tunable in
        //     `cloudconvert.strategy.ts` CONVERT_TASK_OPTIONS)
        //   - Both wrong → likely both, start with the client
        //
        // Trigger: append `?debug_export=1` to the editor URL, or set
        // `localStorage.pdfeditsDebugExport = "1"` in DevTools. No prod
        // build check — the flag is intentional developer opt-in, always
        // available in staging/prod for support debugging without a
        // redeploy. Zero footprint when the flag is off.
        try {
          const search =
            typeof window !== "undefined" ? window.location.search : "";
          const params = new URLSearchParams(search);
          const debugExport =
            params.get("debug_export") === "1" ||
            (typeof window !== "undefined" &&
              window.localStorage?.getItem("pdfeditsDebugExport") === "1");

          if (debugExport) {
            const preConvertName = `${baseName}.pre-convert.pdf`;

            // eslint-disable-next-line no-console
            console.log(
              "[PDFedits] EXPORT-DIAG: DEBUG downloading pre-convert PDF",
              {
                preConvertName,
                bytesLength: bytes.byteLength,
                targetFormat: format,
              },
            );
            downloadBytes(bytes, preConvertName);
          }
        } catch (debugErr) {
          // eslint-disable-next-line no-console
          console.warn(
            "[PDFedits] EXPORT-DIAG: pre-convert debug download failed",
            debugErr,
          );
        }

        if (!entitled) {
          // Close the preparing toast — paywall about to take over.
          // Reopened below on success so post-payment convert work
          // still surfaces the toast.
          if (preparingToastKey) {
            toast.close(preparingToastKey);
            preparingToastKey = null;
          }
          // Same shape/filename diagnostic as the PDF branch above —
          // captures the non-PDF export path (docx / xlsx / pptx / etc.)
          // in the `checkout_intent_400` triage. Log alongside the
          // standard EXPORT_PAYWALL_SHOWN event so we can correlate
          // paywall failures back to the source File that produced them.
          logger.event(EVENTS.EXPORT_PAYWALL_SHOWN, "info", {
            format,
            filenameLength: sourceFile.name?.length ?? 0,
            filenameEmpty: !sourceFile.name,
            filenameFirstChars: sourceFile.name?.slice(0, 40) ?? "",
            fileType: sourceFile.type,
            fileSize: sourceFile.size,
          });
          const pdfBlob = new Blob([bytes as BlobPart], {
            type: "application/pdf",
          });
          const objectUrl = URL.createObjectURL(pdfBlob);

          try {
            const outcome = await requestPaywall({
              filename: sourceFile.name,
              previewObjectUrl: objectUrl,
              sourceExt: "pdf",
              targetExt: format,
            });

            if (outcome !== "success") {
              logger.event(EVENTS.EXPORT_PAYWALL_CANCELLED, "info", { format });

              return;
            }
            logger.event(EVENTS.EXPORT_PAYWALL_SUCCESS, "info", { format });
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
          // Paywall paid — reopen the preparing toast for the backend
          // convert + download that follows.
          openPreparingToast();
        }

        // Entitled (or just paid) — convert and download.
        //
        // EXPORT-DIAG: log the exact bytes about to leave the browser for
        // CloudConvert. `pdfFile.size` MUST equal `bytes.byteLength` AND
        // MUST differ from `sourceFile.size` on any edit — matching sizes
        // means we're uploading the un-edited source and the bake dropped.
        // `storeFabricJsonSummary` shows which pages contributed overlays
        // to that bake so a missing page is obvious from the log alone.
        try {
          const storeState = usePdfEditorStore.getState();
          const summary: Record<number, number> = {};

          storeState.fabricJsonByPage.forEach((json, pageNum) => {
            try {
              const parsed = JSON.parse(json) as { objects?: unknown[] };

              summary[pageNum] = parsed.objects?.length ?? 0;
            } catch {
              summary[pageNum] = -1;
            }
          });

          // SHA-256 of the exact bytes about to leave the browser. This hash
          // is what the backend controller and CloudConvert-upload logs will
          // print next. Three identical hashes = bytes travelled untouched
          // from browser → Nest → CloudConvert; the input to CloudConvert
          // matches the flattened PDF the bake produced. Any mismatch
          // pinpoints which hop mutated the bytes.
          let bytesSha256 = "unavailable";

          try {
            if (globalThis.crypto?.subtle) {
              // Hash the view range only — passing `.buffer` would hash bytes
              // outside the view and produce a hash that doesn't match what
              // was actually shipped.
              const hashBuf = await globalThis.crypto.subtle.digest(
                "SHA-256",
                bytes as BufferSource,
              );

              bytesSha256 = Array.from(new Uint8Array(hashBuf))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            }
          } catch {
            /* leave "unavailable" */
          }
          const first8 = Array.from(bytes.subarray(0, 8))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          const last8 = Array.from(bytes.subarray(-8))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          // eslint-disable-next-line no-console
          console.log("[PDFedits] EXPORT-DIAG: cloudconvert upload", {
            format,
            conversionType,
            pdfFileName: pdfFile.name,
            pdfFileSize: pdfFile.size,
            bakedBytesLength: bytes.byteLength,
            sourceFileSize: sourceFile.size,
            bytesSha256,
            bytesFirst8Hex: first8,
            bytesLast8Hex: last8,
            bakedDiffersFromSource: bytes.byteLength !== sourceFile.size,
            storeFabricJsonSummary: summary,
          });
        } catch (diagErr) {
          logger.warn(
            "[PDFedits] EXPORT-DIAG: cloudconvert upload log failed",
            diagErr,
          );
        }

        let result: Awaited<ReturnType<typeof convertRef.current.mutateAsync>>;

        try {
          result = await logger.span(
            `convert.${conversionType}`,
            "export.convert",
            () =>
              convertRef.current.mutateAsync({
                file: pdfFile,
                type: conversionType,
              }),
            { format, bytes: bytes.byteLength },
          );
        } catch (err) {
          if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
            logger.event(EVENTS.EXPORT_CONVERT_CANCELLED, "info", { format });

            return;
          }
          logger.captureError(err, "export.convert", { format });
          toast.error({
            title: "Export failed",
            description: "We couldn't export your edits. Please try again.",
          });

          return;
        }

        try {
          const serverExt = result.fileName.match(/\.[^.]+$/)?.[0]?.slice(1);
          const outName =
            userBase && serverExt
              ? ensureExtension(userBase, serverExt)
              : result.fileName;

          triggerBlobDownload(result.blob, outName);
          trackActivation(`convert_to_${format}`);
          logger.event(EVENTS.EXPORT_SUCCESS, "info", {
            format,
            filename: result.fileName,
          });
        } catch (err) {
          logger.captureError(err, "export.download", { format });
        }
      } catch (err) {
        // Any pre-mutation exception (buildEditedPdfBytes, file
        // preparation) still surfaces to the user.
        if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
          logger.event(EVENTS.EXPORT_PAYWALL_CANCELLED, "info", { format });

          return;
        }
        logger.captureError(err, "export.build", { format });

        // AbortError with an empty / step-tagged stack is almost always
        // CookieYes' auto-blocker aborting a fetch / XHR / dynamic script
        // when the user has rejected non-necessary cookies (Clerk auth
        // + pdf.js worker load both get caught). Detect that case and
        // route the user to the consent banner instead of the generic
        // "please try again" toast, which is a dead-end. See CloudWatch
        // `diag.cookie_gate` for the shape of the block.
        const errName = (err as { name?: string })?.name;
        const errMessage = (err as { message?: string })?.message ?? "";
        const isCookieGated =
          errName === "AbortError" ||
          /aborted/i.test(errMessage) ||
          hasCookieYesRejection();

        if (isCookieGated) {
          toast.error({
            description:
              "Your cookie preferences are blocking downloads. Open the cookie banner and enable Necessary cookies, then try again.",
            title: "Cookies blocking download",
          });
        } else {
          toast.error({
            description: "We couldn't export your edits. Please try again.",
            title: "Export failed",
          });
        }
      } finally {
        isExportingRef.current = false;
        if (preparingToastKey) {
          toast.close(preparingToastKey);
          preparingToastKey = null;
        }
      }
    },
    [],
  );

  useEffect(() => {
    const onExport = (event: Event) => {
      const detail = (event as CustomEvent<EditorExportEventDetail>).detail;
      const format = detail?.format ?? "pdf";

      void handleExport(format, detail?.filename, detail?.print);
    };

    window.addEventListener("editor:export", onExport);

    return () => {
      window.removeEventListener("editor:export", onExport);
    };
  }, [handleExport]);
}
