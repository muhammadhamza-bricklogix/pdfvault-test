"use client";

import type { Canvas } from "fabric";
import type { ManagePagesDraftSnapshot } from "@/lib/client/hooks/pdf-editor/manage-pages-types";

import { useAuth } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import NextImage from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";
import {
  UPLOAD_ACCEPT_MIME,
  uploadAsPdf,
} from "@/lib/client/file-conversion/upload-to-pdf";
import { loadPdfJs } from "@/lib/client/pdf-editor/load-pdfjs";
import { useAnnotationsEditor } from "@/lib/client/hooks/pdf-editor/use-annotations-editor";
import { useEditorDocumentLoader } from "@/lib/client/hooks/pdf-editor/use-editor-document-loader";
import { useExportEditor } from "@/lib/client/hooks/pdf-editor/use-export-editor";
import { useExtractImagesEditor } from "@/lib/client/hooks/pdf-editor/use-extract-images-editor";
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
import { toast } from "@/lib/shared/utils/toast";
import { FileUpload } from "@/components/ui/file-upload";

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
const PerformancePanel = dynamic(
  () => import("./PerformancePanel").then((m) => m.PerformancePanel),
  { ssr: false, loading: () => null },
);

function UploadScreenHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-[var(--pv-hairline,rgb(235,235,235))] bg-white px-4">
      <Link
        aria-label="PDFVault home"
        className="flex shrink-0 items-center"
        href={ROUTES.PUBLIC.HOME}
      >
        <NextImage
          alt="PDFVault"
          className="h-[32px] w-auto object-contain"
          height={32}
          src="/landing/logo-with-text.png"
          width={128}
        />
      </Link>
    </header>
  );
}

function UploadScreen() {
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setIsCreatePdfModalOpen = usePdfEditorStore(
    (s) => s.setIsCreatePdfModalOpen,
  );

  const handleSelect = async (file: File) => {
    const isAlreadyPdf = file.type === "application/pdf";
    const loadingKey = isAlreadyPdf
      ? null
      : toast.loading({
          description: `Preparing ${file.name} for the editor.`,
          title: "Converting to PDF",
        });

    try {
      const pdfFile = await uploadAsPdf(file);

      setFile(pdfFile);
    } catch (err) {
      toast.error({
        description: err instanceof Error ? err.message : undefined,
        title: "Couldn't open file",
      });
    } finally {
      if (loadingKey) toast.close(loadingKey);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <UploadScreenHeader />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-5xl space-y-4">
          <FileUpload
            accept={UPLOAD_ACCEPT_MIME}
            acceptLabel="PDF, Word, Excel, PowerPoint, Image"
            appearance="marketing"
            description="Upload a PDF to open it directly, or a Word, Excel, PowerPoint, or image file — we'll convert it to PDF first."
            heading="Drop your file here"
            marketingFootnote="PDF, Word, Excel, PowerPoint, Image · Up to 100 MB"
            onFileSelect={handleSelect}
          />
          <p className="text-center text-sm text-default-400">
            or{" "}
            <button
              className="text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
              type="button"
              onClick={() => setIsCreatePdfModalOpen(true)}
            >
              create a blank PDF
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function EditorLayout() {
  const { error, isLoading } = usePdfLoader();
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const isManagePagesOpen = usePdfEditorStore((s) => s.isManagePagesOpen);
  const applyManagePagesSave = usePdfEditorStore((s) => s.applyManagePagesSave);
  const file = usePdfEditorStore((s) => s.file);
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
  usePageNumbersEditor(fabricCanvas);
  useFormFieldsEditor(fabricCanvas);
  useAnnotationsEditor(fabricCanvas);
  useSignedOutAutoPersist(fabricCanvas);

  const { goToNext: searchGoToNext, goToPrev: searchGoToPrev } = usePdfSearch();

  useProductTour("editor");

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
      fabricCanvas,
      fabricJsonByPage,
      file,
      historyByPage,
      historyIndexByPage,
    ],
  );

  if (isLoading) {
    return <EditorLoadingShell />;
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-red-500">{error}</span>
      </div>
    );
  }

  if (!pdfDocument) return null;

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
  const { isSignedIn } = useAuth();
  const shellSearchParams = useSearchParams();

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

  const file = usePdfEditorStore((s) => s.file);
  const createPdfModalKey = usePdfEditorStore((s) => s.createPdfModalKey);
  const isCreatePdfModalOpen = usePdfEditorStore((s) => s.isCreatePdfModalOpen);
  const setIsCreatePdfModalOpen = usePdfEditorStore(
    (s) => s.setIsCreatePdfModalOpen,
  );
  const setIsSignedIn = usePdfEditorStore((s) => s.setIsSignedIn);
  const pendingDocumentId = shellSearchParams.get("id");

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
  let content: React.ReactNode;

  if (file) {
    content = <EditorLayout />;
  } else if (pendingDocumentId || isRestoringSession) {
    content = <EditorLoadingShell />;
  } else {
    content = <UploadScreen />;
  }

  return (
    <div className="flex h-full flex-col">
      {content}
      <CreatePdfModal
        key={createPdfModalKey}
        isOpen={isCreatePdfModalOpen}
        onClose={() => setIsCreatePdfModalOpen(false)}
      />
      <CompressModal />
      <PasswordModal />
      <ShareModal />
      <VersionHistoryModalHost />
      <PageNumbersModal />
      <FormFieldsModal />
      <ReloadConfirmModal />
    </div>
  );
}
