"use client";

import type { Canvas } from "fabric";
import type { ManagePagesDraftSnapshot } from "@/lib/client/hooks/pdf-editor/manage-pages-types";

import { useAuth } from "@clerk/nextjs";
import NextImage from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";
import {
  UPLOAD_ACCEPT_MIME,
  uploadAsPdf,
} from "@/lib/client/file-conversion/upload-to-pdf";
import { useAnnotationsEditor } from "@/lib/client/hooks/pdf-editor/use-annotations-editor";
import { useEditorDocumentLoader } from "@/lib/client/hooks/pdf-editor/use-editor-document-loader";
import { useExportEditor } from "@/lib/client/hooks/pdf-editor/use-export-editor";
import { useExtractImagesEditor } from "@/lib/client/hooks/pdf-editor/use-extract-images-editor";
import { useFormFieldsEditor } from "@/lib/client/hooks/pdf-editor/use-form-fields-editor";
import { usePageNumbersEditor } from "@/lib/client/hooks/pdf-editor/use-page-numbers-editor";
import { usePdfLoader } from "@/lib/client/hooks/pdf-editor/use-pdf-loader";
import { useEditorAutoPersist } from "@/lib/client/hooks/pdf-editor/use-editor-auto-persist";
import { useEditorNavigationSave } from "@/lib/client/hooks/pdf-editor/use-editor-navigation-save";
import { useSaveEditor } from "@/lib/client/hooks/pdf-editor/use-save-editor";
import { useIsMobile } from "@/lib/client/hooks/use-is-mobile";
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
import { CompressModal } from "./CompressModal";
import { CreatePdfModal } from "./CreatePdfModal";
import { FindReplaceModal } from "./FindReplaceModal";
import { FormFieldsModal } from "./FormFieldsModal";
import { PageNumbersModal } from "./PageNumbersModal";
import { PasswordModal } from "./PasswordModal";
import { EditorInfoBar } from "./EditorTopBar";
import { EditorLoadingShell } from "./EditorLoadingShell";
import { PdfViewerCanvas } from "./PdfViewerCanvas";
import { PerformancePanel } from "./PerformancePanel";
import { TopAppBar, ToolToolbar } from "./PvEditorTopChrome";
import { RightSidebar } from "./RightSidebar";
import { ManagePagesModal } from "./ManagePagesModal";
import { ThumbnailSidebar } from "./ThumbnailSidebar";

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
          className="h-[26px] w-auto object-contain"
          height={26}
          src="/landing/logo-with-text.png"
          width={104}
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
        <div className="w-full max-w-2xl space-y-4">
          <FileUpload
            accept={UPLOAD_ACCEPT_MIME}
            acceptLabel="PDF, Word, Excel, PowerPoint, Image"
            description="Upload a PDF to open it directly, or a Word, Excel, PowerPoint, or image file — we'll convert it to PDF first."
            heading="Drop your file here"
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
        <div className="flex flex-1 flex-col overflow-hidden bg-[var(--pv-canvas,#f5f5f7)]">
          <ToolToolbar />
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
  const file = usePdfEditorStore((s) => s.file);
  const createPdfModalKey = usePdfEditorStore((s) => s.createPdfModalKey);
  const isCreatePdfModalOpen = usePdfEditorStore((s) => s.isCreatePdfModalOpen);
  const setIsCreatePdfModalOpen = usePdfEditorStore(
    (s) => s.setIsCreatePdfModalOpen,
  );
  const setIsSignedIn = usePdfEditorStore((s) => s.setIsSignedIn);
  const searchParams = useSearchParams();
  const pendingDocumentId = searchParams.get("id");

  useEditorDocumentLoader();

  useEffect(() => {
    setIsSignedIn(isSignedIn ?? false);
  }, [isSignedIn, setIsSignedIn]);

  let content: React.ReactNode;

  if (file) {
    content = <EditorLayout />;
  } else if (pendingDocumentId) {
    // Doc referenced by URL but not yet hydrated — show editor chrome with
    // skeletons rather than the empty upload screen.
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
      <PageNumbersModal />
      <FormFieldsModal />
    </div>
  );
}
