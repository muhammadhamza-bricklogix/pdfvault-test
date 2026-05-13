"use client";

import type { Canvas } from "fabric";

import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useEditorDocumentLoader } from "@/lib/client/hooks/pdf-editor/use-editor-document-loader";
import { useExportEditor } from "@/lib/client/hooks/pdf-editor/use-export-editor";
import { usePdfLoader } from "@/lib/client/hooks/pdf-editor/use-pdf-loader";
import { useSaveEditor } from "@/lib/client/hooks/pdf-editor/use-save-editor";
import { useIsMobile } from "@/lib/client/hooks/use-is-mobile";
import { usePdfEditorStore } from "@/lib/client/stores";
import { FileUpload } from "@/components/ui/file-upload";

import { BottomDock } from "./BottomDock";
import { CreatePdfModal } from "./CreatePdfModal";
import { EditorInfoBar, EditorToolBar } from "./EditorTopBar";
import { EditorLoadingShell } from "./EditorLoadingShell";
import { PdfViewerCanvas } from "./PdfViewerCanvas";
import { PerformancePanel } from "./PerformancePanel";
import { RightSidebar } from "./RightSidebar";
import { ThumbnailSidebar } from "./ThumbnailSidebar";

function UploadScreen() {
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setIsCreatePdfModalOpen = usePdfEditorStore(
    (s) => s.setIsCreatePdfModalOpen,
  );

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-4">
        <FileUpload
          accept={["application/pdf"]}
          acceptLabel="PDF"
          description="Upload a PDF to open it in the editor."
          heading="Drop your PDF here"
          onFileSelect={setFile}
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
  );
}

function EditorLayout() {
  const { error, isLoading } = usePdfLoader();
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
  const fabricCanvasInstanceRef = useRef<Canvas | null>(null);
  const [isPerformancePanelOpen, setIsPerformancePanelOpen] = useState(false);
  const isMobile = useIsMobile();

  useSaveEditor(fabricCanvas, fabricCanvasInstanceRef);
  useExportEditor(fabricCanvas, fabricCanvasInstanceRef);

  const handleFabricCanvasReady = useCallback(
    (canvas: Canvas | null) => setFabricCanvas(canvas),
    [],
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

  if (isMobile) {
    return (
      <>
        <EditorInfoBar />
        <div className="relative flex flex-1 overflow-hidden">
          <PdfViewerCanvas
            fabricInstanceRef={fabricCanvasInstanceRef}
            onFabricCanvasReady={handleFabricCanvasReady}
          />
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
        <BottomDock fabricCanvas={fabricCanvas} />
      </>
    );
  }

  return (
    <>
      <EditorInfoBar />
      <EditorToolBar />
      <div className="relative flex flex-1 overflow-hidden">
        <ThumbnailSidebar />
        <PdfViewerCanvas
          fabricInstanceRef={fabricCanvasInstanceRef}
          onFabricCanvasReady={handleFabricCanvasReady}
        />
        <div aria-hidden className="w-44 shrink-0 bg-default-100" />
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
    </div>
  );
}
