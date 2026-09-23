"use client";

import type { Canvas } from "fabric";
import type { ManagePagesDraftSnapshot } from "@/lib/client/hooks/pdf-editor/manage-pages-types";

import { useAuth } from "@clerk/nextjs";
import { Alert01Icon, CloudUploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import "@/app/(landing)/landing-theme.css";
import { loadPdfJs } from "@/lib/client/pdf-editor/load-pdfjs";
import { useAnnotationsEditor } from "@/lib/client/hooks/pdf-editor/use-annotations-editor";
import { useEditorDocumentLoader } from "@/lib/client/hooks/pdf-editor/use-editor-document-loader";
import { useExportEditor } from "@/lib/client/hooks/pdf-editor/use-export-editor";
import { useExtractImagesEditor } from "@/lib/client/hooks/pdf-editor/use-extract-images-editor";
import { useFlattenEditor } from "@/lib/client/hooks/pdf-editor/use-flatten-editor";
import { useObjectClipboard } from "@/lib/client/hooks/pdf-editor/use-object-clipboard";
import { useShareBaker } from "@/lib/client/hooks/pdf-editor/use-share-baker";
import { useFormFieldsEditor } from "@/lib/client/hooks/pdf-editor/use-form-fields-editor";
import { usePageNumbersEditor } from "@/lib/client/hooks/pdf-editor/use-page-numbers-editor";
import { usePdfLoader } from "@/lib/client/hooks/pdf-editor/use-pdf-loader";
import { usePdfSearch } from "@/lib/client/hooks/pdf-editor/use-pdf-search";
import { useEditorAutoPersist } from "@/lib/client/hooks/pdf-editor/use-editor-auto-persist";
import { useEditorNavigationSave } from "@/lib/client/hooks/pdf-editor/use-editor-navigation-save";
import { useSaveEditor } from "@/lib/client/hooks/pdf-editor/use-save-editor";
import { useSignedOutAutoPersist } from "@/lib/client/hooks/pdf-editor/use-signed-out-auto-persist";
import { useIsMobile } from "@/lib/client/hooks/use-is-mobile";
import { useProductTour } from "@/lib/client/tour/use-product-tour";
import { buildPdfFromDraft } from "@/lib/client/pdf-editor/build-pages-pdf";
import { remapFabricAfterPageOps } from "@/lib/client/pdf-editor/remap-fabric-after-page-ops";
import {
  detectPageNumberFormat,
  formatPageNumberLabel,
  renumberPageNumbersInFabricJson,
} from "@/lib/client/pdf-editor/renumber-page-numbers";
import { sanitizeSourceBytesForPdfLib } from "@/lib/client/pdf-editor/sanitize-source-bytes";
import { flushLiveFabricPage } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ComposerI18nProvider } from "@/lib/client/i18n/composer-i18n-provider";
import { stripLocalePrefix } from "@/lib/shared/constants/locale-map";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

import { BottomDock } from "./BottomDock";
import { EditorInfoBar } from "./EditorTopBar";
import { EditorLoadingShell } from "./EditorLoadingShell";
import { PdfSearchBar } from "./PdfSearchBar";
import { PdfViewerCanvas } from "./PdfViewerCanvas";
import { TopAppBar, ToolToolbar } from "./PvEditorTopChrome";
import { RightSidebar } from "./RightSidebar";
import { ThumbnailSidebar } from "./ThumbnailSidebar";

// Heavy modals — lazy-loaded so they don't inflate the editor's initial bundle.
const CompressModal = dynamic(
  () => import("./CompressModal").then((m) => m.CompressModal),
  { ssr: false, loading: () => null },
);
const CreatePdfModal = dynamic(
  () => import("./CreatePdfModal").then((m) => m.CreatePdfModal),
  { ssr: false, loading: () => null },
);
const FindReplaceModal = dynamic(
  () => import("./FindReplaceModal").then((m) => m.FindReplaceModal),
  { ssr: false, loading: () => null },
);
const FormFieldsModal = dynamic(
  () => import("./FormFieldsModal").then((m) => m.FormFieldsModal),
  { ssr: false, loading: () => null },
);
const ManagePagesModal = dynamic(
  () => import("./ManagePagesModal").then((m) => m.ManagePagesModal),
  { ssr: false, loading: () => null },
);
const PageNumbersModal = dynamic(
  () => import("./PageNumbersModal").then((m) => m.PageNumbersModal),
  { ssr: false, loading: () => null },
);
const ReloadConfirmModal = dynamic(
  () => import("./ReloadConfirmModal").then((m) => m.ReloadConfirmModal),
  { ssr: false, loading: () => null },
);
const PasswordModal = dynamic(
  () => import("./PasswordModal").then((m) => m.PasswordModal),
  { ssr: false, loading: () => null },
);
// Mounted at shell level (not inside HamburgerMenu) so the modal survives
// the EditorLayout unmount that fires during the post-save pdf.js reload
// — see comment in ShareModal.tsx for the full trace.
const ShareModal = dynamic(
  () => import("./ShareModal").then((m) => m.ShareModal),
  { ssr: false, loading: () => null },
);
// Same shell-level pattern as ShareModal — Version History runs a
// `saveBeforeAction` before opening which triggers a pdf.js reload
// that unmounts `HamburgerMenu`, wiping any local modal state.
const VersionHistoryModalHost = dynamic(
  () =>
    import("./VersionHistoryModalHost").then((m) => m.VersionHistoryModalHost),
  { ssr: false, loading: () => null },
);
// Same shell-level pattern — Merge runs a `saveBeforeAction` (added
// 2026-08-24 so shapes/drawings/images are baked into the source
// before merging with additional PDFs) which triggers a pdf.js reload
// that unmounts `HamburgerMenu`. Open state + source live in the
// store (`isMergeModalOpen` / `mergeModalSource`) so the modal
// appears once the reset lands.
const MergeModalHost = dynamic(
  () => import("./MergeModalHost").then((m) => m.MergeModalHost),
  { ssr: false, loading: () => null },
);
const PerformancePanel = dynamic(
  () => import("./PerformancePanel").then((m) => m.PerformancePanel),
  { ssr: false, loading: () => null },
);

function EditorLayout() {
  const { error, isLoading } = usePdfLoader();
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  // Sticky store latch — flips to true the first time a non-null doc
  // lands and stays true across subsequent reloads (post-save file
  // swap, restore-version). Read below so `isLoading` cycles after
  // the first paint don't blank the editor to `<EditorLoadingShell />`.
  // The Fabric canvas + `usePageRenderer` still cycle correctly (see
  // `PdfViewerCanvas.effectivePage` + `usePageRenderer` line 165) so
  // the sweep-then-remount sync that keeps the merge pipeline honest
  // is preserved. QA report 2026-08-24 ("save reloads the pdf which
  // is bad UX behaviour").
  const hasEverLoaded = usePdfEditorStore((s) => s.hasEverLoadedPdf);
  const isManagePagesOpen = usePdfEditorStore((s) => s.isManagePagesOpen);
  const applyManagePagesSave = usePdfEditorStore((s) => s.applyManagePagesSave);
  const file = usePdfEditorStore((s) => s.file);
  const extractedPages = usePdfEditorStore((s) => s.extractedPages);
  const fabricJsonByPage = usePdfEditorStore((s) => s.fabricJsonByPage);
  const historyByPage = usePdfEditorStore((s) => s.historyByPage);
  const historyIndexByPage = usePdfEditorStore((s) => s.historyIndexByPage);
  const reorderPages = usePdfEditorStore((s) => s.reorderPages);
  const replaceFabricJsonByPage = usePdfEditorStore(
    (s) => s.replaceFabricJsonByPage,
  );
  const setIsManagePagesOpen = usePdfEditorStore((s) => s.setIsManagePagesOpen);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
  const [isPerformancePanelOpen, setIsPerformancePanelOpen] = useState(false);
  const isMobile = useIsMobile();

  useSaveEditor(fabricCanvas);
  useEditorAutoPersist(fabricCanvas);
  useEditorNavigationSave(fabricCanvas);
  useExportEditor(fabricCanvas);
  useExtractImagesEditor(fabricCanvas);
  useFlattenEditor(fabricCanvas);
  useShareBaker(fabricCanvas);
  useObjectClipboard(fabricCanvas);
  usePageNumbersEditor(fabricCanvas);
  useFormFieldsEditor(fabricCanvas);
  useAnnotationsEditor(fabricCanvas);
  useSignedOutAutoPersist(fabricCanvas);

  const { goToNext: searchGoToNext, goToPrev: searchGoToPrev } = usePdfSearch();

  // Suppress the editor product tour on the W-9 route. `/w-9-form`
  // (and its locale-prefixed forms — `/de/w-9-form`, `/fr/w-9-form`, …)
  // reuse <PdfEditorShell /> but the tour's anchors + step copy
  // reference generic composer surfaces (Editor menu, Tools) that
  // don't apply — QA 2026-09-06: "Editor menu: Open, save, import,
  // and manage the whole document from one place" popover appeared
  // over the yellow W-9 field overlays. `TourHelpButton` on this
  // route is already hidden (PvEditorTopChrome guard), but the shell-
  // level `useProductTour("editor")` call still fired the auto-launch.
  // Normalise via `stripLocalePrefix` so the guard fires on EVERY
  // locale — the raw `usePathname()` returns `/de/w-9-form` etc.
  const layoutPathname = usePathname();
  const isW9Layout =
    stripLocalePrefix(layoutPathname) === ROUTES.FORMS.W9_SHORT;

  // QA 2026-09-06 (revised): show the tour FIRST on a first-time
  // visit, then open the tool modal AFTER the tour finishes. The
  // hydrator's Step 4 owns the deferral logic — it checks
  // `willTourAutoLaunch("editor")` at fire time and, when true,
  // waits for the `TOUR_ENDED_EVENT` before dispatching the tool
  // auto-launch. Return visitors (tour already seen) get the
  // straight-through experience with no delay. Nothing to gate here
  // — the tour hook is safe to run alongside the auto-launching URL.
  useProductTour("editor", !isW9Layout);

  const handleFabricCanvasReady = useCallback(
    (canvas: Canvas | null) => setFabricCanvas(canvas),
    [],
  );

  const handleReorderPages = useCallback(
    (fromDisplay: number, toDisplay: number) => {
      if (fabricCanvas) {
        flushLiveFabricPage(currentPage, fabricCanvas);
      }

      reorderPages(fromDisplay, toDisplay);

      // After the reorder, page-number IText overlays on each page
      // still read the OLD display number ("Page 3 of 10" stuck on
      // what is now slot 1). The store's reorder doesn't touch overlay
      // contents — it only permutes `pageOrder`. Walk the (source-keyed)
      // fabricJsonByPage and rewrite each detected page-number label
      // to match its NEW display slot. No-op when no page-number
      // overlays exist.
      const afterState = usePdfEditorStore.getState();
      const newPageOrder = afterState.pageOrder;
      const sourceToDisplay = new Map<number, number>();

      newPageOrder.forEach((sourceIdx, i) => {
        sourceToDisplay.set(sourceIdx, i + 1);
      });

      const renumbered = renumberPageNumbersInFabricJson(
        afterState.fabricJsonByPage,
        (sourceKey) => sourceToDisplay.get(sourceKey) ?? null,
      );

      if (renumbered !== afterState.fabricJsonByPage) {
        replaceFabricJsonByPage(renumbered);

        // The stored JSON now matches the new arrangement, but the
        // LIVE canvas (currently mounted on whatever source page the
        // user was viewing) still holds the old IText instance with
        // the stale label. If that source page has a page-number
        // overlay, update its `text` in place so the user sees the
        // new number without a remount.
        if (fabricCanvas) {
          const currentSource =
            afterState.pageOrder[afterState.currentPage - 1];
          const currentSlot = sourceToDisplay.get(currentSource);
          const totalPages = newPageOrder.length;

          if (currentSlot !== undefined) {
            fabricCanvas.getObjects().forEach((obj) => {
              const editorType = (obj as { editorType?: string }).editorType;

              if (editorType !== "pageNumber") return;
              const iText = obj as unknown as {
                text?: string;
                set: (key: string, value: unknown) => void;
                dirty?: boolean;
              };
              const detected = detectPageNumberFormat(String(iText.text ?? ""));

              if (!detected) return;
              const newLabel = formatPageNumberLabel(
                detected.format,
                currentSlot,
                totalPages,
              );

              if (iText.text === newLabel) return;
              iText.set("text", newLabel);
              iText.dirty = true;
            });
            fabricCanvas.requestRenderAll();
          }
        }
      }
    },
    [currentPage, fabricCanvas, replaceFabricJsonByPage, reorderPages],
  );

  const handleManagePagesSave = useCallback(
    async (snapshot: ManagePagesDraftSnapshot) => {
      if (!file) return;

      if (fabricCanvas) {
        flushLiveFabricPage(currentPage, fabricCanvas);
      }

      try {
        const rawSourceBytes = await file.arrayBuffer();
        const sourceBytes = pdfDocument
          ? await sanitizeSourceBytesForPdfLib(rawSourceBytes, pdfDocument)
          : rawSourceBytes;
        const bytes = await buildPdfFromDraft({
          importedPdfs: snapshot.importedPdfs,
          pages: snapshot.pages,
          pdfDocument,
          sourceBytes,
        });
        const newFile = new File([Uint8Array.from(bytes)], file.name, {
          type: "application/pdf",
        });
        const remapped = remapFabricAfterPageOps({
          newPages: snapshot.pages,
          oldExtractedPages: extractedPages,
          oldFabricJsonByPage: fabricJsonByPage,
          oldHistoryByPage: historyByPage,
          oldHistoryIndexByPage: historyIndexByPage,
        });
        // Reordering / deleting / duplicating pages leaves the
        // page-number IText labels stale ("Page 5 of 10" stuck on what
        // is now slot 2). Renumber overlays here so the labels match
        // the new slot order. No-op when no page-number overlays exist
        // — returns the same Map by reference.
        const renumberedFabricJson = renumberPageNumbersInFabricJson(
          remapped.fabricJsonByPage,
        );
        const newPageCount = snapshot.pages.length;
        const clampedPage = Math.min(currentPage, Math.max(1, newPageCount));

        applyManagePagesSave({
          currentPage: clampedPage,
          extractedPages: remapped.extractedPages,
          fabricJsonByPage: renumberedFabricJson,
          file: newFile,
          historyByPage: remapped.historyByPage,
          historyIndexByPage: remapped.historyIndexByPage,
        });
      } catch {
        toast.error({
          title: "Could not apply page changes",
          description: "Saving your page edits failed. Please try again.",
        });
      }
    },
    [
      applyManagePagesSave,
      currentPage,
      extractedPages,
      fabricCanvas,
      fabricJsonByPage,
      file,
      historyByPage,
      historyIndexByPage,
    ],
  );

  // Only show the full loading shell on the FIRST load. Subsequent
  // reloads (post-save file swap, restore-version) keep the previous
  // frame visible so the user doesn't see a jarring blank flash after
  // every Save — the pdf.js re-parse is invisible; the Fabric layer
  // briefly disappears and reappears with the swept overlays.
  if (isLoading && !hasEverLoaded) {
    return <EditorLoadingShell />;
  }

  if (error) {
    return <EditorLoadFailure message={error} />;
  }

  // Once we've rendered at least one doc, keep the editor tree mounted
  // even while `pdfDocument` is momentarily null (post-save reload,
  // restore-version). The pdf.js canvas element retains its last-
  // rendered frame so the user sees the previous content until the
  // new doc lands. The Fabric layer + tool components handle a null
  // pdfDocument safely (grep for `!pdfDocument` in child components).
  if (!pdfDocument && !hasEverLoaded) return null;

  const managePagesModal = (
    <ManagePagesModal
      isOpen={isManagePagesOpen}
      onClose={() => setIsManagePagesOpen(false)}
      onSave={handleManagePagesSave}
    />
  );

  // Mounted inside EditorLayout (not the outer shell) because it needs the
  // live `fabricCanvas` ref to mutate the current page's IText overlays.
  const findReplaceModal = <FindReplaceModal fabricCanvas={fabricCanvas} />;

  if (isMobile) {
    return (
      <>
        <EditorInfoBar />
        <div className="relative flex flex-1 overflow-hidden">
          <PdfSearchBar goToNext={searchGoToNext} goToPrev={searchGoToPrev} />
          <PdfViewerCanvas onFabricCanvasReady={handleFabricCanvasReady} />
          <div className="pointer-events-none absolute right-4 top-4 z-10">
            <div className="pointer-events-auto">
              <PerformancePanel
                fabricCanvas={fabricCanvas}
                isOpen={isPerformancePanelOpen}
                setIsOpen={setIsPerformancePanelOpen}
              />
            </div>
          </div>
        </div>
        <BottomDock
          fabricCanvas={fabricCanvas}
          onReorderPages={handleReorderPages}
        />
        {managePagesModal}
        {findReplaceModal}
      </>
    );
  }

  return (
    <>
      <TopAppBar />
      <div className="relative flex flex-1 overflow-hidden">
        <ThumbnailSidebar onReorderPages={handleReorderPages} />
        <div className="relative flex flex-1 flex-col overflow-hidden bg-[var(--pv-canvas,#f5f5f7)]">
          <ToolToolbar />
          <PdfSearchBar goToNext={searchGoToNext} goToPrev={searchGoToPrev} />
          <PdfViewerCanvas onFabricCanvasReady={handleFabricCanvasReady} />
        </div>
        <RightSidebar fabricCanvas={fabricCanvas} />

        <div className="pointer-events-none absolute bottom-4 right-[17rem] z-10">
          <div className="pointer-events-auto">
            <PerformancePanel
              fabricCanvas={fabricCanvas}
              isOpen={isPerformancePanelOpen}
              setIsOpen={setIsPerformancePanelOpen}
            />
          </div>
        </div>
      </div>
      {managePagesModal}
      {findReplaceModal}
    </>
  );
}

export function PdfEditorShell() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const shellSearchParams = useSearchParams();
  const shellRouter = useRouter();

  // Synchronous fresh-entry clear — runs BEFORE the store selectors
  // below read `file` on first render. Kills the stale-file →
  // <EditorLayout /> → usePdfLoader → <EditorLoadingShell /> race that
  // leaves users stuck on the composer loader after in-SPA navigation
  // (composer → landing → tool-tile → composer). The hydrator also
  // clears in its effect, but effects run AFTER first render, so
  // <EditorLayout /> would still mount for a frame and kick off a pdf.js
  // parse against a stale File. useState's initializer is the standard
  // "run once before first render" hook; the return value is ignored.
  useState(() => {
    if (
      shellSearchParams.get("fresh") === "1" &&
      !shellSearchParams.get("id")
    ) {
      usePdfEditorStore.getState().clearFile();
    }

    return true;
  });

  // QA 2026-08-28: signed-out user edits a PDF, clicks Done, signs up via
  // Google, returns to `/pdf-composer?export=<fmt>`. `useExportEditor`
  // already snapshotted the file + Fabric edits to IDB before the
  // redirect, and `PendingEditorFileHydrator` Step 2 knows how to
  // restore them (post-signin branch: upload → router.replace to add
  // `?id=<newId>`). But Step 2 only sets `isRestoringSession=true`
  // AFTER `await loadPendingEditorFile()` — an async gap of tens of ms.
  // In that gap, this shell's first render sees `!file && !pendingDocumentId
  // && !isRestoringSession` → `shouldRedirectAway=true` → the redirect
  // effect fires `router.replace('/dashboard')` and the user lands on
  // My PDFs with the upload toast stuck at 99% because the hydrator's
  // async upload keeps running on an unmounted tree.
  //
  // Latch `isRestoringSession=true` synchronously in a useState
  // initializer when the URL declares an auto-launch (`?export=` or
  // `?tool=` without `?id=`). Runs before first paint, so the shell's
  // first render sees the flag true and skips the redirect. Step 2's
  // `finally` clears it once async work settles — either the restore
  // succeeded (file set OR `?id=` added → `shouldRedirectAway=false`
  // for a different reason) or IDB was empty and the redirect fires
  // legitimately on the next render.
  useState(() => {
    const hasAutoLaunch = Boolean(
      (shellSearchParams.get("export") || shellSearchParams.get("tool")) &&
        !shellSearchParams.get("id"),
    );
    // 2026-08-30: also latch for the bare `/pdf-composer` refresh
    // case. Signed-out users editing a locally-dropped PDF have
    // their file + fabricJsonByPage mirrored to IDB by
    // `useSignedOutAutoPersist`; on a hard-refresh the shell was
    // firing its "no file → redirect away" effect BEFORE the
    // hydrator could probe IDB, so users lost the file + edits
    // even though the snapshot was safely persisted. Latching
    // isRestoringSession=true for any /pdf-composer entry without
    // `?fresh=1` or `?id=` (the two cases the hydrator explicitly
    // handles: fresh wipes IDB, ?id is loader-owned) gives the
    // IDB probe a chance to restore. Hydrator's `finally` clears
    // the flag regardless of the branch, so if IDB was empty the
    // shell's redirect fires normally on the next render.
    const isFresh = shellSearchParams.get("fresh") === "1";
    const hasId = Boolean(shellSearchParams.get("id"));
    const shouldLatchForRestore = hasAutoLaunch || (!isFresh && !hasId);

    if (shouldLatchForRestore) {
      usePdfEditorStore.setState({ isRestoringSession: true });
    }

    return true;
  });

  // Reset any leftover `postSaveReloadPending` from a prior shell
  // instance that unmounted mid-save-reload — most commonly the
  // Hamburger → "My PDFs" flow, where `useEditorNavigationSave` fires
  // `applyPostSaveReset(savedFile)` (sets the flag true) and
  // immediately `router.push('/dashboard')`. The shell unmounts before
  // `editor:post-save-render-done` can dispatch, so
  // `clearPostSaveReloadPending()` never runs. On the next PDF open
  // the flag is still true, which makes `usePdfLoader` skip clearing
  // the destroyed `pdfDocument` proxy from the store — subsequent
  // `pdfDocument.getPage()` calls (in `PdfViewerCanvas`) then throw
  // synchronously with `Cannot read properties of null (reading
  // 'sendWithPromise')` because the proxy's `messageHandler` was
  // nulled by the previous unmount's `loadingTask.destroy()`. The flag
  // is only meaningful within a single mounted shell lifetime, so
  // clearing it at mount time is safe — a genuine in-session save-
  // reload sets it AFTER this initializer runs. QA repro
  // 2026-08-25: edit → hamburger → My PDFs → re-open same PDF →
  // "Something went wrong. The tool failed to load."
  useState(() => {
    const state = usePdfEditorStore.getState();

    if (state.postSaveReloadPending) {
      // Also clear the stale pdfDocument. If the flag was stuck true,
      // the store still holds the destroyed proxy from the previous
      // session — `usePdfLoader` won't clear it (flag guard), and
      // `PdfViewerCanvas` reads directly from the store on mount, so
      // we need to null it here BEFORE any child hook runs a read.
      state.setPdfDocument(null, 0);
      state.clearPostSaveReloadPending();
    }

    return true;
  });

  const file = usePdfEditorStore((s) => s.file);
  const createPdfModalKey = usePdfEditorStore((s) => s.createPdfModalKey);
  const isCreatePdfModalOpen = usePdfEditorStore((s) => s.isCreatePdfModalOpen);
  const setIsCreatePdfModalOpen = usePdfEditorStore(
    (s) => s.setIsCreatePdfModalOpen,
  );
  const setIsSignedIn = usePdfEditorStore((s) => s.setIsSignedIn);
  const pendingDocumentId = shellSearchParams.get("id");
  // QA 2026-08-27: signed-in user opens a locked file on `/unlock-pdf` (or
  // any `?tool=unlock` entry) — the PasswordModal opens over the editor,
  // but the loaded PDF content is still readable behind the backdrop,
  // "which makes the password protection a bit useless." Blur the editor
  // shell while unlock is pending so the content stays obscured until
  // the correct password is entered. HeroUI's Modal portals to
  // `document.body`, so blurring this wrapper doesn't affect the modal.
  const isPasswordModalOpen = usePdfEditorStore((s) => s.isPasswordModalOpen);
  const passwordModalVariant = usePdfEditorStore((s) => s.passwordModalVariant);
  const blurUnderlyingContent =
    isPasswordModalOpen && passwordModalVariant === "unlock-only";

  useEditorDocumentLoader();

  useEffect(() => {
    setIsSignedIn(isSignedIn ?? false);
  }, [isSignedIn, setIsSignedIn]);

  // PRD §7.1 — prefetch the pdf.js legacy build + worker as soon as the
  // editor mounts, so the first file lands into a warm module cache. On a
  // cold session this saves ~200–800ms depending on browser cache state
  // (the module + `pdf.worker.min.mjs` fetches are the bulk of first-
  // upload variability). Fire-and-forget; loadPdfJs handles polyfills
  // and the dynamic import is memoized by the runtime, so a subsequent
  // real `usePdfLoader` call gets the cached module for free.
  useEffect(() => {
    void loadPdfJs().catch(() => {
      // Prefetch failures are harmless — the real load call surfaces
      // the error to the user with the friendly PasswordException /
      // InvalidPDFException / generic branches in usePdfLoader.
    });
  }, []);

  const isRestoringSession = usePdfEditorStore((s) => s.isRestoringSession);

  // Loader is authoritative on two signals now:
  //  - `pendingDocumentId` — URL carries `?id=`, doc loader is fetching
  //  - `isRestoringSession` — hydrator's IDB probe + optional
  //    save-first upload are in flight. Flag flips off in the
  //    hydrator's `finally` regardless of which branch it took.
  //
  // Before 2026-07-23 there was a third gate keyed off the URL alone
  // (`?tool=` or `?export=` with no `?id=`) meant to prevent a
  // drop-zone flash on post-signin returns. It caused the "stuck on
  // loading PDF" bug when a user landed on `/pdf-composer?fresh=1&tool=X`
  // with an empty IDB: nothing to hydrate, nothing to upload, but the
  // loader stayed up forever. Bounding the loader to
  // `isRestoringSession` gives us the same flash-suppression without
  // the stuck state, because the hydrator sets that flag at the very
  // top of its effect.
  // 2026-08-28: user asked to permanently remove the shell-level
  // "Drop your file here" screen. Landing on /pdf-composer with no
  // file loaded and no pending document / session-restore in flight
  // now redirects instead — signed-in users land on their dashboard,
  // signed-out users land on the marketing home (which has its own
  // hero drop-zone). Effect runs post-render, so the fallback content
  // stays on `<EditorLoadingShell />` for the ~1 frame between the
  // decision and the redirect committing.
  const shouldRedirectAway = !file && !pendingDocumentId && !isRestoringSession;

  useEffect(() => {
    if (!shouldRedirectAway) return;
    // 2026-08-30: wait for Clerk to hydrate before deciding target.
    // Without this guard the first render after a full-page nav
    // (post-signup / post-signin — invariant #15's
    // `window.location.assign`) evaluates `isSignedIn === undefined`
    // (Clerk client-boot in flight), the ternary picks the falsy
    // branch, and users end up on the marketing HOME (`/`) instead
    // of their DASHBOARD. User reported edits appearing "lost"
    // after signup because the composer redirect fired before the
    // hydrator could restore the file, and even if the hydrator
    // did fire the redirect was to `/` — no evidence the composer
    // ever tried to reopen the doc. Waiting for `authLoaded` gives
    // the hydrator time to complete its IDB restore AND Clerk time
    // to populate `isSignedIn`, so any redirect that DOES fire
    // lands on the correct signed-in dashboard.
    if (!authLoaded) return;
    const target = isSignedIn ? ROUTES.APP.DASHBOARD : ROUTES.PUBLIC.HOME;

    shellRouter.replace(target);
  }, [shouldRedirectAway, authLoaded, isSignedIn, shellRouter]);

  let content: React.ReactNode;

  if (file) {
    content = <EditorLayout />;
  } else {
    // Covers the loading branch (pendingDocumentId / isRestoringSession)
    // AND the redirect branch — a brief spinner while `router.replace`
    // takes effect avoids a flash of blank white.
    content = <EditorLoadingShell />;
  }

  return (
    <ComposerI18nProvider>
      <div className="flex h-full flex-col">
        <div
          aria-hidden={blurUnderlyingContent || undefined}
          className={`flex h-full flex-col transition-[filter] duration-200 ${
            blurUnderlyingContent
              ? "pointer-events-none select-none blur-lg"
              : ""
          }`}
        >
          {content}
        </div>
        <CreatePdfModal
          key={createPdfModalKey}
          isOpen={isCreatePdfModalOpen}
          onClose={() => setIsCreatePdfModalOpen(false)}
        />
        <CompressModal />
        <PasswordModal />
        <ShareModal />
        <VersionHistoryModalHost />
        <MergeModalHost />
        <PageNumbersModal />
        <FormFieldsModal />
        <ReloadConfirmModal />
      </div>
    </ComposerI18nProvider>
  );
}

/**
 * Full-page failure state shown when `usePdfLoader` can't parse the
 * source document (invalid PDF, corrupt bytes, etc.). Retains the
 * branded header + gives the user actionable recovery paths (Try
 * another file, Go home) instead of dead-ending on a bare red string
 * that only leaves the browser Back button.
 */
function EditorLoadFailure({ message }: { message: string }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center border-b border-[var(--pv-hairline,rgb(235,235,235))] bg-white px-4">
        <Link
          aria-label="Home"
          className="flex items-center gap-2"
          href={ROUTES.PUBLIC.HOME}
        >
          <Image
            alt="PDFVault"
            className="h-[32px] w-auto object-contain"
            height={32}
            src="/landing/logo-with-text.png"
            width={128}
          />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <HugeiconsIcon icon={Alert01Icon} size={32} />
          </div>
          <h1 className="mt-6 text-xl font-semibold text-[var(--pv-text-strong,#1a1c21)] sm:text-2xl">
            We couldn&apos;t open this file
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--pv-text-body,#5c5c5c)]">
            {message}
          </p>
          <div className="mt-8 flex flex-col-reverse items-center gap-3 sm:flex-row">
            <Link
              className="inline-flex h-10 items-center justify-center rounded-full border border-default-200 bg-white px-5 text-[14px] font-semibold text-[var(--pv-text-primary,#1a1c21)] transition-colors hover:bg-default-100"
              href={ROUTES.PUBLIC.HOME}
            >
              Return home
            </Link>
            <Button
              className="!h-10 !cursor-pointer !gap-2 !rounded-full !bg-[#f12c23] !px-5 !text-[14px] !font-semibold !text-white hover:!opacity-90"
              onPress={() => router.back()}
            >
              <HugeiconsIcon
                className="text-white"
                icon={CloudUploadIcon}
                size={18}
              />
              Try another file
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
