"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import { uploadToasts } from "@/lib/client/upload-toasts/controller";
import {
  clearPendingEditorFile,
  loadPendingEditorFile,
} from "@/lib/client/upload/pending-editor-file";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { documentKeys } from "@/lib/shared/constants/query-keys";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Tools whose action lives on the backend (auth-gated / paywalled) AND whose
 * per-tool hooks don't have their own signed-out flow. Landing these
 * signed-out kicks the user into the "Couldn't start checkout" dead-end —
 * we redirect to sign-in first instead.
 *
 * `extract-images` and `compress` are intentionally omitted:
 * `useExtractImagesEditor` and `CompressModal.handleCompress` both mirror
 * the `useExportEditor` pattern — a signed-out visitor can open the
 * editor + drop a PDF, then hits the sign-in modal at action time and
 * the paywall on the mutation. Matches the flow used on
 * `/convert/pdf-to-*` (Download → sign-in → paywall).
 */
const AUTH_GATED_TOOLS: ReadonlySet<string> = new Set([
  "password",
  "unlock",
  "flatten",
]);

/**
 * Bootstraps the editor on `/pdf-composer` mount:
 *
 * 1. **Tool-tile reset** — if the URL carries `?tool=<slug>` and no `?id=`,
 *    the user came from a landing / dashboard tool tile. Clear the store's
 *    lingering file so the drop-zone shows instead of the previous PDF,
 *    matching QA's expected "Drop your file here" screen.
 * 2. **Auth gate for backend tools** — some tools (compress, password,
 *    unlock, flatten, extract-images) hit auth-gated backend endpoints.
 *    If a signed-out user lands with one of those slugs, bounce to
 *    /sign-in with a return URL so they don't hit the paywall dead-end.
 * 3. **Rehydrate** — if IndexedDB has a File left over from an old flow
 *    (belt-and-braces; the new `UploadWorkspace` no longer writes to IDB),
 *    load it into the store.
 * 4. **Auto-save to library (signed-in only)** — the first time a File is
 *    seen in the store without a matching Document ID, POST it to
 *    `/documents/upload` so it appears in Dashboard → My PDFs and future
 *    Save actions overwrite the same row.
 * 5. **Auto-launch tool** — once the store has a File, fire the matching
 *    editor action. The mapping mirrors the toolbar / HamburgerMenu event
 *    bus so we don't duplicate the modal-open logic.
 *
 * Slugs:
 *   compress          → CompressModal
 *   password / unlock → PasswordModal (mode inferred by the modal)
 *   manage            → ManagePagesModal
 *   split             → dispatch `editor:open-split` (HamburgerMenu bridge)
 *   watermark         → setActiveTool("watermark")
 *   extract-images    → dispatch `editor:extract-images`
 *   flatten           → dispatch `editor:open-flatten` (HamburgerMenu bridge)
 *
 * Export formats: docx / xlsx / pptx / jpg / png / html / txt — fired via
 * `editor:export` with the matching `ExportFormat` detail.
 */
export function PendingEditorFileHydrator() {
  const ranRef = useRef(false);
  const resetRef = useRef(false);
  const launchedRef = useRef(false);
  const autoSavedRef = useRef(false);

  const clearFile = usePdfEditorStore((s) => s.clearFile);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);
  const setIsRestoringSession = usePdfEditorStore(
    (s) => s.setIsRestoringSession,
  );
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
  const setIsCompressModalOpen = usePdfEditorStore(
    (s) => s.setIsCompressModalOpen,
  );
  const setIsPasswordModalOpen = usePdfEditorStore(
    (s) => s.setIsPasswordModalOpen,
  );
  const setIsManagePagesOpen = usePdfEditorStore((s) => s.setIsManagePagesOpen);
  const currentFile = usePdfEditorStore((s) => s.file);
  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const queryClient = useQueryClient();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tool = searchParams.get("tool");
  const exportFormat = searchParams.get("export");
  const docId = searchParams.get("id");
  const isFreshEntry = searchParams.get("fresh") === "1";

  // Step 1 — auth gate + tool-tile reset. Runs once per mount before
  // anything else touches the store.
  useEffect(() => {
    if (resetRef.current) return;
    if (!authLoaded) return; // wait for auth so the gate doesn't misfire

    resetRef.current = true;

    // Landing / dashboard tool tiles route to `/pdf-composer?tool=<slug>`
    // or bare `/pdf-composer?fresh=1`. Either signal means the user
    // came from a fresh tool selection and expects an empty
    // drop-zone — dump any stale file from a prior session so a user
    // who just converted Word→PDF doesn't see that converted file
    // waiting for them when they click "PDF Composer".
    if ((tool || exportFormat || isFreshEntry) && !docId) {
      clearFile();
    }

    // Signed-in redirect (product decision 2026-07-23): when a signed-in
    // user lands on the composer with a specific tool but no doc id,
    // send them to the dashboard's document picker so they can pick
    // from their library instead of re-uploading. Signed-out users
    // keep the composer drop-zone since they have no library to pick
    // from. Only fires for tools (not bare `?fresh=1` or `?export=`
    // returns) so users who click "PDF Composer" itself still land on
    // the editor.
    if (tool && !docId && isSignedIn) {
      const returnTo = `${ROUTES.APP.DASHBOARD}?openPicker=${encodeURIComponent(tool)}`;

      window.location.assign(returnTo);

      return;
    }

    if (tool && AUTH_GATED_TOOLS.has(tool) && !isSignedIn) {
      // Preserve the tool slug in the return URL so we land back in the
      // same launch flow after sign-in.
      const returnTo = `${ROUTES.TOOLS.PDF_EDITOR}?tool=${encodeURIComponent(tool)}`;

      toast.info({
        title: "Sign in to use this tool",
        description:
          "Sign in and you'll come right back to finish where you left off.",
      });
      window.location.assign(
        `${ROUTES.AUTH.SIGN_IN}?redirect_url=${encodeURIComponent(returnTo)}`,
      );
    }
  }, [
    authLoaded,
    clearFile,
    docId,
    exportFormat,
    isFreshEntry,
    isSignedIn,
    tool,
  ]);

  // Step 2 — one-shot IDB rehydrate.
  //
  // Two distinct paths:
  //
  //   POST-SIGN-IN RESTORE (signed-in + IDB file + `?tool=` or
  //   `?export=` but no `?id=`):
  //     The user was signed-out, dropped a file, tried a paid action,
  //     signed in, and came back. We save-first-then-navigate: upload
  //     the IDB file to /documents/upload, clear IDB, then
  //     router.replace to add `?id=<newDocId>` to the URL. The
  //     document loader picks up the new id and hydrates the editor
  //     the same way any deep-link load would — no race between the
  //     hydrator, the loader, and the auto-launch effect. While the
  //     upload + loader fetch are in flight, the editor shell shows
  //     `<EditorLoadingShell />` (because `?id=` is present but no
  //     file is loaded yet) so the user sees a proper spinner instead
  //     of a bare "Drop your file here" screen or a flash of untitled
  //     editor chrome.
  //
  //   NORMAL REHYDRATE (any other case):
  //     Just hydrate the store from IDB. Step 3 handles the async
  //     auto-save in the background.
  useEffect(() => {
    if (ranRef.current) return;
    if (!authLoaded) return; // wait so we can pick the right branch
    ranRef.current = true;

    let cancelled = false;

    // Flag the shell into loading state for the duration of the IDB
    // probe + any save-first upload it triggers. Without this, a URL
    // like `/pdf-composer?fresh=1&tool=X` with an empty IDB would
    // strand the user on <EditorLoadingShell /> forever (PdfEditorShell
    // used to gate the loader on the URL alone). Bounding the loader
    // to this effect means the moment we know there's nothing to
    // restore we drop to the drop-zone. Every code path below MUST
    // flip this back to false — the outer try/finally guarantees that.
    setIsRestoringSession(true);

    void (async () => {
      try {
        // `?fresh=1` (added by TOOL_ROUTE tiles) means the user just
        // clicked a tool tile and expects a clean drop-zone. Wipe any
        // leftover IDB file too — otherwise Step 1's `clearFile()`
        // would be immediately undone by this rehydrate. The IDB entry
        // gets cleared so subsequent auto-launch flows start fresh.
        if (isFreshEntry && !docId) {
          await clearPendingEditorFile();

          return;
        }

        const file = await loadPendingEditorFile();

        if (cancelled || !file) return;

        // Guard: /pdf-composer is PDF-only. If a non-PDF is sitting in
        // IDB (e.g. a .docx dropped by the signed-out user on
        // /convert/word-to-pdf that hasn't been converted yet), leave
        // it there — the convert page's own auto-resume effect will
        // pick it up on return. Trying to hand a .docx to pdf.js just
        // errors out and clears state the convert flow still needs.
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");

        if (!isPdf) return;

        if (currentFile) {
          await clearPendingEditorFile();

          return;
        }

        const hasAutoLaunch = Boolean(tool || exportFormat);

        if (isSignedIn && hasAutoLaunch && !docId) {
          // Post-sign-in restore path — save-first-then-navigate.
          // Flip isRestoringSession so PdfEditorShell renders the
          // <EditorLoadingShell /> skeleton (not the empty drop-zone)
          // during the save. Also open a bottom-anchored upload-progress
          // toast that mirrors the real upload % (much less jarring
          // than a top-right spinner for a multi-second network op).
          setIsRestoringSession(true);
          const trackingId = `restore-${Date.now()}`;

          uploadToasts.start({
            trackingId,
            filename: file.name,
          });

          try {
            const document = await documentsService.uploadDocument(
              { file },
              {
                onUploadProgress: (event) => {
                  if (!event.total) return;
                  const pct = Math.round((event.loaded / event.total) * 100);

                  uploadToasts.setProgress(
                    trackingId,
                    pct,
                    "uploading_s3",
                    pct < 100 ? "Uploading to cloud…" : "Finishing up…",
                  );
                },
              },
            );

            if (cancelled) return;
            if (!document.id) {
              throw new Error("Server returned document without an id");
            }
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
            await clearPendingEditorFile();
            autoSavedRef.current = true; // Step 3 already covered
            uploadToasts.succeed(trackingId, document);

            // Add the fresh id to the URL. The document loader takes
            // over from here — GET /documents/<id> hydrates the store
            // and the auto-launch effect fires once the file lands.
            const next = new URLSearchParams(searchParams.toString());

            next.set("id", document.id);
            router.replace(`${pathname}?${next.toString()}`);
          } catch (saveErr) {
            logger.warn("post-signin save-first failed", saveErr);
            uploadToasts.fail(trackingId, saveErr);
            toast.error({
              title: "Couldn't save automatically",
              description:
                "Continuing with your local copy — use Save from the editor.",
            });
            // Fall back to plain rehydrate so the user isn't stranded.
            setCurrentDocument(null);
            setFile(file);
            await clearPendingEditorFile();
          } finally {
            setIsRestoringSession(false);
          }

          return;
        }

        // Normal rehydrate path.
        setCurrentDocument(null);
        setFile(file);
        await clearPendingEditorFile();
      } catch (err) {
        logger.warn("pending editor file hydrate failed", err);
      } finally {
        // Clear the restoring flag no matter which path we took
        // (fresh-entry cleanup, empty-IDB, non-PDF skip, currentFile
        // present, save-first success/failure, or normal rehydrate).
        // Without this the shell sits on <EditorLoadingShell /> even
        // though the hydrator has nothing left to do — the exact
        // "stuck loading on /pdf-composer?fresh=1&tool=X" report.
        if (!cancelled) setIsRestoringSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authLoaded,
    currentFile,
    docId,
    exportFormat,
    isFreshEntry,
    isSignedIn,
    pathname,
    queryClient,
    router,
    searchParams,
    setCurrentDocument,
    setFile,
    setIsRestoringSession,
    tool,
  ]);

  // Step 3 — background auto-save for signed-in users. Fires once per
  // file-without-doc-id combo. Failure is non-blocking; the editor still
  // opens and the user can hit Save manually.
  useEffect(() => {
    if (autoSavedRef.current) return;
    if (!currentFile) return;
    if (currentDocumentId) return; // already tied to a document row

    autoSavedRef.current = true;

    void (async () => {
      try {
        const document = await documentsService.uploadDocument({
          file: currentFile,
        });

        setCurrentDocument({ id: document.id, name: document.filename });
        queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
        toast.success({
          title: "Saved to My PDFs",
          description: document.filename,
        });

        // Reflect the saved doc in the URL so future Save actions
        // overwrite the same row and a bookmarked link reopens it —
        // BUT only when we aren't mid-flight on an auto-launch flow
        // (`?tool=` or `?export=`). Adding `?id=<newId>` under those
        // params races the document-loader effect: it may fire against
        // the freshly-added id before the store selector observes the
        // matching `currentDocumentId`, briefly failing the
        // "already hydrated" short-circuit and firing a GET
        // /documents/<id> that can 404 during the backend-indexing
        // window. The user then sees the file for a moment before the
        // loader's error branch bounces them out. Skipping the URL
        // update here keeps the store the source of truth for the
        // in-flight session; the user's next explicit Save writes the
        // id into the URL cleanly.
        const hasAutoLaunch =
          searchParams.get("tool") !== null ||
          searchParams.get("export") !== null;

        if (
          pathname === ROUTES.TOOLS.PDF_EDITOR &&
          !searchParams.get("id") &&
          !hasAutoLaunch
        ) {
          const next = new URLSearchParams(searchParams.toString());

          next.set("id", document.id);
          router.replace(`${pathname}?${next.toString()}`);
        }
      } catch (err) {
        // Expected for signed-out visitors (401). Silent for that case,
        // logged for anything else.
        const status = (err as { response?: { status?: number } })?.response
          ?.status;

        if (status !== 401) logger.warn("editor auto-save failed", err);
        autoSavedRef.current = false; // allow retry on next file load
      }
    })();
  }, [
    currentDocumentId,
    currentFile,
    pathname,
    queryClient,
    router,
    searchParams,
    setCurrentDocument,
  ]);

  // Step 4 — tool / export auto-launch, one-shot per URL. Waits for the
  // file to be non-null so the modals don't open on an empty editor,
  // and — crucially — waits for `authLoaded` before firing. If we
  // dispatch `editor:export` before Clerk has finished hydrating,
  // `useExportEditor` reads `store.isSignedIn` at its default (`false`)
  // and re-triggers the sign-in redirect the user just came from →
  // infinite bounce. Waiting for `authLoaded` guarantees the store's
  // `isSignedIn` (synced from Clerk in PdfEditorShell) reflects reality
  // by the time the event fires.
  useEffect(() => {
    if (launchedRef.current) return;
    if (!currentFile) return;
    if (!tool && !exportFormat) return;
    if (!authLoaded) return;

    launchedRef.current = true;

    // Small delay so the editor's own file-load pipeline (Fabric mount +
    // pdf.js hydrate) settles before we open a modal on top of it. The
    // modals are cheap; the risk is that a modal opens over a still-blank
    // canvas and looks jarring.
    const timeoutId = window.setTimeout(() => {
      if (tool) {
        switch (tool) {
          case "compress":
            setIsCompressModalOpen(true);
            break;
          case "password":
          case "unlock":
            setIsPasswordModalOpen(true);
            break;
          case "manage":
            setIsManagePagesOpen(true);
            break;
          case "split":
            window.dispatchEvent(new CustomEvent("editor:open-split"));
            break;
          case "watermark":
            setActiveTool("watermark");
            break;
          case "extract-images":
            window.dispatchEvent(new CustomEvent("editor:extract-images"));
            break;
          case "flatten":
            window.dispatchEvent(new CustomEvent("editor:open-flatten"));
            break;
          default:
            logger.warn(`unknown auto-launch tool: ${tool}`);
        }
      }
      if (exportFormat) {
        window.dispatchEvent(
          new CustomEvent("editor:export", {
            detail: { format: exportFormat },
          }),
        );
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [
    currentFile,
    exportFormat,
    setActiveTool,
    setIsCompressModalOpen,
    setIsManagePagesOpen,
    setIsPasswordModalOpen,
    tool,
  ]);

  return null;
}
