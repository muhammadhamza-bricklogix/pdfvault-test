"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import {
  clearPendingEditorFile,
  loadPendingEditorFile,
  savePendingEditorFile,
} from "@/lib/client/upload/pending-editor-file";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import {
  TOUR_ENDED_EVENT,
  willTourAutoLaunch,
} from "@/lib/client/tour/use-product-tour";
import { documentKeys } from "@/lib/shared/constants/query-keys";
import { ROUTES } from "@/lib/shared/constants/routes";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Every backend-gated tool now owns its own signed-out flow — the modal /
 * handler calls `dispatchSignInPrompt` with a `redirectUrl` back to
 * `?tool=<slug>`, so users always reach the composer, can drop a file, and
 * only hit the sign-in modal at action time (same pattern as
 * `useExportEditor` / `useExtractImagesEditor` / `CompressModal`).
 * Redirecting from here would strand the user before they get a chance to
 * see the tool's own UI, and the tool's own handler already handles auth.
 */
const AUTH_GATED_TOOLS: ReadonlySet<string> = new Set<string>();

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
  const redirectRef = useRef(false);
  const launchedRef = useRef(false);
  const autoSavedRef = useRef(false);
  // Tracks whether `currentFile` has ever been truthy in this session.
  // The mirror effect below uses this to decide whether a `null`
  // currentFile is "user just cleared" (should wipe IDB) vs "fresh
  // page load, Step 2 hasn't restored yet" (must NOT wipe IDB — that
  // would race Step 2 and destroy the post-signin pending file).
  const hasSeenFileRef = useRef(false);

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
  // Fallback signal for the welcome-email CTA. Customer.io's click-
  // tracker sometimes strips non-UTM query params on redirect, so a
  // link generated as `?id=<uuid>&tool=export&utm_source=customer.io`
  // can land as `?id=<uuid>&utm_source=customer.io` — the intended
  // `&tool=export` param is lost. UTM params always survive, so
  // detecting the "clicked from welcome email" state via those (which
  // CIO always attaches) is the reliable signal. When present on a
  // `/pdf-composer?id=<uuid>` load, treat it like `?tool=export` and
  // open the ExportFormatModal.
  const utmSource = searchParams.get("utm_source");
  const utmMedium = searchParams.get("utm_medium");
  const cameFromWelcomeEmail =
    utmSource === "customer.io" && utmMedium === "email_action";
  // Flow 1 (spec 2026-09-09) post-signup landing: guest dropped a
  // non-PDF on /convert/*, silent-signed-up, was routed to
  // `/pdf-composer?convert-pending=1`. `<FlowOneConvertPendingOverlay/>`
  // owns the lifecycle from here — probes IDB, uploads the ORIGINAL
  // file for backend conversion, then `router.replace(?id=<newId>)`.
  // Skip Step 2's rehydrate entirely and (critically) do NOT clear
  // `isRestoringSession`; the shell's synchronous latch stays true so
  // the "no file → redirect to dashboard" effect can't fire mid-
  // conversion. Overlay releases the flag when it navigates to the
  // real doc URL (or on error path).
  const isConvertPending = searchParams.get("convert-pending") === "1";

  // Step 1a — synchronous tool-tile reset. Fires ASAP (no authLoaded gate)
  // so a stale file from the previous session is out of the store BEFORE
  // `PdfEditorShell` gets a chance to mount `<EditorLayout />` against it
  // and drag the user through `usePdfLoader` → `<EditorLoadingShell />`
  // for a doc the URL already declared "reset". Was previously coupled
  // with the auth-gated redirect and only cleared after Clerk finished
  // resolving — long enough for the loader shell to paint and, on some
  // slower auth resolutions, get stuck.
  //
  // QA 2026-08-27: preserve a file the caller placed on the store just
  // before `router.push` — the new marketing landing pages
  // (`/edit`, `/split-pdf`, `/compress`, …) route through `UploadWorkspace`
  // which calls `setFile(pdfFile)` and then navigates to
  // `/pdf-composer?tool=<slug>` with NO `?id=` for signed-out users.
  // Without this guard the reset nukes the file the user just uploaded
  // and the composer paints the drop-zone again ("two upload screens"
  // bug). Callers that legitimately want a fresh entry still add
  // `?fresh=1` (all `TOOL_ROUTE.*` entries do) so they keep working.
  useEffect(() => {
    if (resetRef.current) return;

    resetRef.current = true;

    if ((tool || exportFormat || isFreshEntry) && !docId) {
      const hasSameSessionFile = Boolean(usePdfEditorStore.getState().file);

      // 2026-09-05: skip `clearFile()` on a fresh page load with an empty
      // store. `clearFile()` in the Zustand store also resets
      // `isRestoringSession` to false (pdf-editor-store.ts:535, added
      // 2026-07-18 alongside the shell latch). On a post-auto-signup
      // return to `/pdf-composer?export=<fmt>`, `PdfEditorShell` has
      // just latched `isRestoringSession: true` synchronously in its
      // `useState` initializer to suppress the "no file → redirect
      // away" effect while Step 2's async IDB restore is in flight.
      // Calling `clearFile()` here wipes that latch, and once Clerk
      // hydrates the shell fires `router.replace(DASHBOARD)` before
      // Step 2 can call `setFile(pendingFile)` — user reports landing
      // on the dashboard after auto-signup instead of the paywall.
      // The store is trivially empty on a fresh load, so `clearFile()`
      // is a no-op for `file` here anyway — only the side effect on
      // `isRestoringSession` matters.
      if (isFreshEntry) {
        logger.breadcrumb("hydrator", "reset.tool_tile", {
          tool,
          exportFormat,
          isFreshEntry,
        });
        clearFile();
      } else if (hasSameSessionFile) {
        logger.breadcrumb("hydrator", "reset.tool_tile.skipped_has_file", {
          tool,
          exportFormat,
        });
      } else {
        logger.breadcrumb("hydrator", "reset.tool_tile.skipped_empty_store", {
          tool,
          exportFormat,
        });
      }
    }
  }, [clearFile, docId, exportFormat, isFreshEntry, tool]);

  // Step 1b — auth-gated redirects. Splitting them from the reset lets
  // the store clear happen ASAP and keeps the redirect decision (which
  // legitimately needs Clerk state) on its own effect.
  useEffect(() => {
    if (redirectRef.current) return;
    if (!authLoaded) return; // wait for auth so the gate doesn't misfire

    redirectRef.current = true;

    // Signed-in redirect (product decision 2026-07-23): when a signed-in
    // user lands on the composer with a specific tool but no doc id,
    // send them to the dashboard's document picker so they can pick
    // from their library instead of re-uploading. Signed-out users
    // keep the composer drop-zone since they have no library to pick
    // from. Only fires for tools (not bare `?fresh=1` or `?export=`
    // returns) so users who click "PDF Composer" itself still land on
    // the editor.
    // QA 2026-08-27: skip the redirect when the store already has a
    // file — that means UploadWorkspace on a marketing page
    // (`/edit`, `/split-pdf`, …) just placed the user's dropped PDF on
    // the store and navigated here. Bouncing them to the dashboard
    // picker would abandon the file they literally just dropped and
    // land them on an unrelated screen. Save-first-then-open lives in
    // UploadWorkspace; if that upload failed the user still expects to
    // continue with the file in-memory, not lose it to a picker.
    // QA 2026-09-06: ALSO require `?fresh=1` so post-signin restores
    // (returnTo = `/pdf-composer?tool=<slug>` with no fresh) don't
    // race Step 2's async IDB restore and bounce the user to the
    // dashboard. Dashboard tool tiles all use `TOOL_ROUTE.*` which
    // adds `?fresh=1`, so the picker redirect still fires for that
    // legitimate case. Post-signin returnTo strings from PasswordModal
    // / CompressModal / use-extract-images-editor deliberately OMIT
    // `?fresh=1` — the file lives in IDB and Step 2 will restore it
    // within tens of ms of Step 1b's decision.
    const hasSameSessionFile = Boolean(usePdfEditorStore.getState().file);

    if (tool && !docId && isSignedIn && !hasSameSessionFile && isFreshEntry) {
      logger.event(EVENTS.HYDRATOR_SIGNED_IN_REDIRECT_TO_PICKER, "info", {
        tool,
      });
      const returnTo = `${ROUTES.APP.DASHBOARD}?openPicker=${encodeURIComponent(tool)}`;

      window.location.assign(returnTo);

      return;
    }

    if (tool && AUTH_GATED_TOOLS.has(tool) && !isSignedIn) {
      logger.event(EVENTS.HYDRATOR_AUTH_GATED_REDIRECT_TO_SIGNIN, "info", {
        tool,
      });
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
  }, [authLoaded, docId, isFreshEntry, isSignedIn, tool]);

  // Step 2 — one-shot IDB rehydrate.
  //
  // Fast path (2026-08-28): hydrate the store from IDB IMMEDIATELY so the
  // editor opens with the user's pre-redirect file + Fabric edits. Step 3
  // handles the backend upload in the background — the user is no longer
  // blocked on `/documents/upload` completing before they see the PDF.
  //
  // Prior version ran a "save-first-then-navigate" branch for the
  // post-signin case (signed-in + `?tool=`/`?export=` + no `?id=`), which
  // uploaded the file to `/documents/upload` FIRST and only then swapped
  // in the doc-id URL. On slow networks / cold backends the "Finishing
  // up…" toast could sit at 99% indefinitely, and if the upload response
  // didn't resolve the editor never opened. User asked to flip this:
  // "open the pdf please, you can use the local storage for this one and
  // once the user is signup and pdf is loaded then flush it".
  //
  // IDB flush lives with `useSignedOutAutoPersist` / Step 5 mirror — once
  // Step 3's upload sets `currentDocumentId`, the mirror effect clears IDB
  // on the currentDocumentId branch, so we don't leak a stale copy.
  useEffect(() => {
    if (ranRef.current) return;
    if (!authLoaded) return; // wait so we can pick the right branch
    // Flow 1 overlay owns lifecycle when ?convert-pending=1 is set —
    // don't rehydrate + don't clear the restoring latch here.
    if (isConvertPending) {
      ranRef.current = true;

      return;
    }
    ranRef.current = true;

    let cancelled = false;

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

        // `?id=<X>` present → the cloud document loader
        // (`useEditorDocumentLoader`) is authoritative for `file`. Racing
        // an IDB restore against it either overwrites the correct cloud
        // bytes with a stale local mirror or vice-versa. Skip IDB here;
        // if the mirror needs cleanup we handle it in the file-mirror
        // effect once `currentDocumentId` propagates.
        if (docId) {
          return;
        }

        const pending = await loadPendingEditorFile();

        if (cancelled || !pending) return;

        const {
          file,
          fabricJsonByPage: pendingFabricState,
          extractedPages: pendingExtractedPages,
        } = pending;

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

        // Rehydrate synchronously. Editor opens with the pending file +
        // Fabric edits + extractedPages. Step 3 uploads to the backend
        // asynchronously; Step 4 fires the auto-launch (export /
        // tool-open) once the editor has settled with the file.
        setCurrentDocument(null);
        setFile(file);
        if (pendingFabricState && pendingFabricState.size > 0) {
          usePdfEditorStore
            .getState()
            .replaceFabricJsonByPage(pendingFabricState);
        }
        if (pendingExtractedPages && pendingExtractedPages.size > 0) {
          usePdfEditorStore.setState({ extractedPages: pendingExtractedPages });
        }
        // IDB entry is kept until Step 3 confirms the backend upload
        // succeeded — that way a mid-upload reload doesn't lose the file.
        // Step 5's mirror effect clears IDB once `currentDocumentId`
        // lands, and Step 3 does the same on success as a belt-and-braces.
        // Signed-out sessions keep mirroring via useSignedOutAutoPersist.
        const hasAutoLaunch = Boolean(tool || exportFormat);

        if (!(isSignedIn && hasAutoLaunch)) {
          await clearPendingEditorFile();
        }
        logger.breadcrumb("hydrator", "rehydrate.fast_path_ok", {
          hasAutoLaunch,
          isSignedIn: Boolean(isSignedIn),
        });
      } catch (err) {
        logger.captureError(err, "hydrator.rehydrate");
      } finally {
        // Clear the restoring flag no matter which path we took. The
        // shell's `useState` initializer flips it on synchronously when
        // the URL declares an auto-launch, so we must unconditionally
        // release it once Step 2 has settled — otherwise the shell sits
        // on `<EditorLoadingShell />` forever.
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
    isConvertPending,
    isFreshEntry,
    isSignedIn,
    setCurrentDocument,
    setFile,
    setIsRestoringSession,
    tool,
  ]);

  // Step 3 — background auto-save for signed-in users. Fires once per
  // file-without-doc-id combo. Failure is non-blocking; the editor still
  // opens and the user can hit Save manually.
  //
  // 2026-08-28: hard-gated on `isSignedIn`. Without this the effect fires
  // for signed-out visitors too — POST /documents/upload always 401s
  // for them, generating a red console error on every anonymous upload
  // (user report: "not logged in, uploaded a file, seeing 401 in
  // console"). Signed-out sessions still auto-persist through
  // `useSignedOutAutoPersist` (IDB mirror for post-signin restore); the
  // server upload only makes sense once auth is confirmed. Wait for
  // Clerk to finish loading before deciding so we don't skip a
  // legitimate signed-in save on first paint.
  useEffect(() => {
    if (autoSavedRef.current) return;
    if (!currentFile) return;
    if (currentDocumentId) return; // already tied to a document row
    if (!authLoaded) return; // Clerk still booting — defer the decision
    if (!isSignedIn) return; // anonymous session — IDB-only via `useSignedOutAutoPersist`

    // 2026-08-30: if Step 2 restored Fabric edits from IDB (user was
    // signed-out, edited the PDF, then signed in), the RAW file
    // upload below would ship the pristine original — losing all
    // the edits when the user opens the doc from their dashboard.
    // Set `pendingCloudSaveAfterReload=true` instead; that flag
    // makes `useEditorAutoPersist` fire once pdf.js finishes loading
    // and run the merge pipeline (`persistEditorDocument` bakes the
    // Fabric layer into a new PDF byte array + uploads THAT). The
    // raw-upload path below is only correct for the "signed-in user
    // drops a fresh PDF" case (no edits yet).
    const hasFabricEdits =
      usePdfEditorStore.getState().fabricJsonByPage.size > 0;

    if (hasFabricEdits) {
      autoSavedRef.current = true;
      usePdfEditorStore.setState({ pendingCloudSaveAfterReload: true });

      // Nothing else to do here — useEditorAutoPersist takes over
      // once pdfDocument is loaded. It calls persistEditorDocument
      // with force: true, which handles the merge + upload + sets
      // currentDocumentId + clears the flag.
      return;
    }

    autoSavedRef.current = true;

    void (async () => {
      try {
        const document = await documentsService.uploadDocument({
          file: currentFile,
        });

        setCurrentDocument({ id: document.id, name: document.filename });
        queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
        // Flush the IDB pending copy — the backend row is now the source
        // of truth. Step 2 leaves IDB in place for the post-signin
        // auto-launch case (so a mid-upload reload doesn't lose the
        // file); once the upload lands, clear it so the next visit
        // starts clean. Step 5's mirror effect also clears on the
        // `currentDocumentId` branch, but firing here is deterministic.
        await clearPendingEditorFile().catch(() => undefined);
        logger.event(EVENTS.HYDRATOR_BACKGROUND_AUTOSAVE_OK, "info", {
          documentId: document.id,
        });
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
        // captured for anything else.
        const status = (err as { response?: { status?: number } })?.response
          ?.status;

        if (status !== 401) {
          logger.captureError(err, "hydrator.background_autosave", { status });
        }
        autoSavedRef.current = false; // allow retry on next file load
      }
    })();
  }, [
    authLoaded,
    currentDocumentId,
    currentFile,
    isSignedIn,
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
  //
  // Tour-aware ordering (QA 2026-09-06 revised): on a FIRST visit the
  // editor tour auto-launches too — if the tool modal opens at the
  // same time, driver.js's overlay + HeroUI backdrop fight for the
  // top layer and any click tears both down together. Product ask:
  // show the tour first, then open the tool modal after the tour
  // ends. When `willTourAutoLaunch("editor")` is true at fire time,
  // wait for the `TOUR_ENDED_EVENT` (with a generous fallback cap)
  // before dispatching the auto-launch. Return visitors (tour
  // already seen) get the instant launch as before.
  useEffect(() => {
    if (launchedRef.current) return;
    if (!currentFile) return;
    // Include the UTM-derived welcome-email signal as a valid
    // auto-launch trigger — see `cameFromWelcomeEmail` docstring for
    // why `?tool=export` alone isn't reliable across CIO's tracker.
    if (!tool && !exportFormat && !cameFromWelcomeEmail) return;
    if (!authLoaded) return;

    launchedRef.current = true;
    logger.event(EVENTS.HYDRATOR_AUTO_LAUNCH, "info", {
      tool,
      exportFormat,
      cameFromWelcomeEmail,
    });

    const willTourRun = willTourAutoLaunch("editor");

    let toolTimeoutId: number | undefined;
    let fallbackTimeoutId: number | undefined;
    let tourEndedHandler: (() => void) | undefined;

    const runAutoLaunch = () => {
      // 400 ms lead-in so the file-load pipeline (Fabric mount +
      // pdf.js hydrate) settles before the tool modal opens on top.
      toolTimeoutId = window.setTimeout(() => {
        if (tool) {
          switch (tool) {
            case "compress":
              setIsCompressModalOpen(true);
              break;
            case "password":
              usePdfEditorStore.getState().setPasswordModalVariant("both");
              setIsPasswordModalOpen(true);
              break;
            case "unlock":
              // Dedicated Unlock PDF flow — hide the Add password tab so
              // the modal reads as a single-purpose remove-password
              // screen. Variant resets to "both" on close.
              usePdfEditorStore
                .getState()
                .setPasswordModalVariant("unlock-only");
              setIsPasswordModalOpen(true);
              break;
            case "manage":
              setIsManagePagesOpen(true);
              break;
            case "split":
              window.dispatchEvent(new CustomEvent("editor:open-split"));
              break;
            case "merge": {
              // Open the merge modal DIRECTLY via store state instead of
              // dispatching `editor:open-merge` through the HamburgerMenu
              // bridge. The bridge path depended on HamburgerMenu being
              // mounted + its `useEffect` having attached its listener
              // by the 400 ms fire mark; a slow first-paint or a
              // conditional render (guests, W-9 route) could drop the
              // event on the floor. Reading store setters here and
              // handing the file to `fileToMergeEntry` mirrors what
              // `openMergeModal` does — the MergeModalHost renders the
              // modal from store state, so this works for guests +
              // signed-in users alike. Skip the pre-merge cloud-save
              // for guests same as `HamburgerMenu`'s case "merge"
              // (QA 2026-09-06: unpaid users get the modal, hit paywall
              // at download).
              const store = usePdfEditorStore.getState();
              const target = store.file;

              if (!target) {
                logger.warn(
                  "auto-launch merge: no file on the store when firing",
                );
                break;
              }

              void (async () => {
                try {
                  const { fileToMergeEntry } = await import(
                    "@/lib/client/pdf-tools/merge-pdfs"
                  );
                  const entry = await fileToMergeEntry(target);

                  store.setMergeModalSource(entry);
                  store.setIsMergeModalOpen(true);
                } catch (err) {
                  logger.error("auto-launch merge: failed to open", err);
                }
              })();
              break;
            }
            case "watermark":
              setActiveTool("watermark");
              break;
            case "edit":
              // PRD §5/§6 — dashboard "Edit PDF" tile lands the user
              // directly in the edit-text tool instead of the generic
              // composer with no tool selected.
              setActiveTool("editText");
              break;
            case "sign":
              // PRD §5/§6 — dashboard "Sign & Watermark" tile lands the
              // user in the signature tool. Watermark stays reachable via
              // the toolbar.
              setActiveTool("signature");
              break;
            case "extract-images":
              window.dispatchEvent(new CustomEvent("editor:extract-images"));
              break;
            case "flatten":
              window.dispatchEvent(new CustomEvent("editor:open-flatten"));
              break;
            case "export":
              // Welcome-email button lands users here — opens
              // ExportFormatModal so the user picks their format
              // (PDF / DOCX / JPG / etc.) before the paywall /
              // download decision fires. Uses a store flag rather
              // than a CustomEvent because chrome hosts may not yet
              // have registered their event listener at the moment
              // this setTimeout fires (race on initial page load).
              // Chrome hosts subscribe to `pendingOpenExportModal`
              // and open their local modal state whenever it flips.
              usePdfEditorStore.getState().setPendingOpenExportModal(true);
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
        // Welcome-email fallback signal — see `cameFromWelcomeEmail`
        // above. Fires only when neither the explicit `tool` case nor
        // `exportFormat` case handled the arrival, so we don't double-
        // set the flag when a URL happens to carry both `?tool=export`
        // AND the CIO UTM params. Same store flag path as the tool
        // case above — see rationale in the store field docstring.
        if (cameFromWelcomeEmail && tool !== "export" && !exportFormat) {
          usePdfEditorStore.getState().setPendingOpenExportModal(true);
        }

        // Strip the one-shot auto-launch params from the URL so a browser
        // refresh doesn't re-fire the action. Without this, a user who
        // landed on `/pdf-editor?id=X&export=docx` and hit F5 mid-edit
        // would be dragged through the download flow again. `?id=` is kept
        // so the document loader can still hydrate on refresh.
        // Reported 2026-08-19 (QA: "refresh triggers unwanted download").
        const cleaned = new URLSearchParams(searchParams.toString());
        let mutated = false;

        if (cleaned.has("tool")) {
          cleaned.delete("tool");
          mutated = true;
        }
        if (cleaned.has("export")) {
          cleaned.delete("export");
          mutated = true;
        }
        if (cleaned.has("fresh")) {
          cleaned.delete("fresh");
          mutated = true;
        }
        // UTM params from the welcome-email click. Strip them after
        // the auto-launch fires so a refresh doesn't re-open the
        // ExportFormatModal — same reason we strip `?tool=` and
        // `?export=`. Only strip when they matched the welcome-email
        // signal we acted on; otherwise leave them for GA / analytics.
        if (cameFromWelcomeEmail) {
          for (const utmKey of [
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_content",
          ]) {
            if (cleaned.has(utmKey)) {
              cleaned.delete(utmKey);
              mutated = true;
            }
          }
        }
        if (mutated) {
          const q = cleaned.toString();

          router.replace(q ? `${pathname}?${q}` : pathname);
        }
      }, 400);
    };

    if (willTourRun) {
      // Wait for the tour to finish before opening the tool. Add a
      // 60 s hard cap so a stuck tour (user closed the tab mid-tour
      // in an earlier session and cleanup didn't fire) doesn't
      // strand the user without the tool they asked for.
      tourEndedHandler = () => {
        if (fallbackTimeoutId !== undefined) {
          window.clearTimeout(fallbackTimeoutId);
        }
        runAutoLaunch();
      };
      window.addEventListener(TOUR_ENDED_EVENT, tourEndedHandler, {
        once: true,
      });
      fallbackTimeoutId = window.setTimeout(() => {
        if (tourEndedHandler) {
          window.removeEventListener(TOUR_ENDED_EVENT, tourEndedHandler);
        }
        runAutoLaunch();
      }, 60_000);
    } else {
      runAutoLaunch();
    }

    return () => {
      if (toolTimeoutId !== undefined) window.clearTimeout(toolTimeoutId);
      if (fallbackTimeoutId !== undefined) {
        window.clearTimeout(fallbackTimeoutId);
      }
      if (tourEndedHandler) {
        window.removeEventListener(TOUR_ENDED_EVENT, tourEndedHandler);
      }
    };
  }, [
    authLoaded,
    currentFile,
    exportFormat,
    pathname,
    router,
    searchParams,
    setActiveTool,
    setIsCompressModalOpen,
    setIsManagePagesOpen,
    setIsPasswordModalOpen,
    tool,
  ]);

  // Step 5 — mirror the in-memory `file` to IndexedDB so a hard browser
  // refresh doesn't strand the user on the drop-zone.
  //
  // Why it's needed: signed-out visitors on `/pdf-composer` don't get a
  // `?id=<docId>` URL param (no cloud row to reference), and signed-in
  // users whose cloud save FAILED are in the same boat. With Zustand
  // reset on refresh and nothing else persisted, the previously opened
  // PDF vanishes and the composer boots into the empty upload screen —
  // exactly the QA report from 2026-08-21.
  //
  // We only mirror when the file is local-only (no `currentDocumentId`).
  // For cloud-backed files the cloud loader is the authoritative
  // rehydration source and duplicating to IDB just risks a stale mirror
  // outliving the doc.
  //
  // Fabric edits + extractedPages are intentionally omitted here (they
  // change on every stroke; writing 25 MB to IDB per stroke would jank
  // the UI). The sign-in redirect path in the sibling flows still saves
  // those explicitly. If hard-refresh edit restoration is needed later,
  // add a debounced mirror for those fields.
  useEffect(() => {
    // Track file-seen state OUT of the mirror-decision branch so a
    // fresh page load with `currentFile === null` doesn't record it
    // as "seen" — we want the null→clear branch below to skip on the
    // initial mount and only fire once the user has actually held a
    // file at some point in this session.
    if (currentFile) hasSeenFileRef.current = true;

    if (!currentFile) {
      // CRITICAL: don't wipe IDB during the fresh-mount window before
      // Step 2 has restored the post-signin pending file.
      //
      // Sequence on a fresh return to `/pdf-composer?export=<fmt>`:
      //   1. Store initialises with `file = null`.
      //   2. Clerk hasn't hydrated yet, so `authLoaded === false`.
      //   3. Step 2 early-returns (`if (!authLoaded) return`).
      //   4. This mirror USED TO fire unconditionally, see
      //      `currentFile === null`, wipe IDB.
      //   5. Clerk hydrates. Step 2 runs, reads EMPTY IDB. Drop-zone.
      //
      // Skip the clear when `hasSeenFileRef.current === false` — i.e.
      // we've never held a file this session. The user's active-clear
      // paths (Back button, close, clearFile) all involve currentFile
      // being truthy first, so `hasSeenFileRef.current === true` by
      // the time null flips in.
      if (!hasSeenFileRef.current) return;

      // File was cleared (new upload flow, close, or clearFile) — drop
      // the mirror so a refresh doesn't restore something the user just
      // navigated away from.
      void clearPendingEditorFile().catch((err) =>
        logger.warn("pending file mirror clear failed", err),
      );

      return;
    }

    // Cloud-backed doc — cloud is source of truth. Also clear any stale
    // mirror from a prior local-only session so cross-doc restore can't
    // fire.
    if (currentDocumentId) {
      void clearPendingEditorFile().catch((err) =>
        logger.warn("pending file mirror clear (cloud) failed", err),
      );

      return;
    }

    void savePendingEditorFile(currentFile).catch((err) =>
      logger.warn("pending file mirror save failed", err),
    );
  }, [currentFile, currentDocumentId]);

  return null;
}
