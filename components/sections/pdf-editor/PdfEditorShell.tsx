"use client";

import type { Canvas } from "fabric";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

import { useEditorDocumentLoader } from "@/lib/client/hooks/pdf-editor/use-editor-document-loader";
import { usePdfLoader } from "@/lib/client/hooks/pdf-editor/use-pdf-loader";
import { usePdfEditorStore } from "@/lib/client/stores";
import { FileUpload } from "@/components/ui/file-upload";

import { EditorInfoBar, EditorToolBar } from "./EditorTopBar";
import { PdfViewerCanvas } from "./PdfViewerCanvas";
import { PerformancePanel } from "./PerformancePanel";
import { RightSidebar } from "./RightSidebar";
import { ThumbnailSidebar } from "./ThumbnailSidebar";

function UploadScreen() {
  const setFile = usePdfEditorStore((s) => s.setFile);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <FileUpload
          accept={["application/pdf"]}
          acceptLabel="PDF"
          description="Upload a PDF to open it in the editor."
          heading="Drop your PDF here"
          onFileSelect={setFile}
        />
      </div>
    </div>
  );
}

function EditorLayout() {
  const { error, isLoading } = usePdfLoader();
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
  const [isPerformancePanelOpen, setIsPerformancePanelOpen] = useState(false);

  const handleFabricCanvasReady = useCallback(
    (canvas: Canvas | null) => setFabricCanvas(canvas),
    [],
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-[var(--app-muted)]">Loading PDF…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-red-500">{error}</span>
      </div>
    );
  }

  if (!pdfDocument) return null;

  return (
    <>
      <EditorInfoBar />
      <EditorToolBar />
      <div className="relative flex flex-1 overflow-hidden">
        <ThumbnailSidebar />
        <PdfViewerCanvas onFabricCanvasReady={handleFabricCanvasReady} />
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
  const setIsSignedIn = usePdfEditorStore((s) => s.setIsSignedIn);

  useEditorDocumentLoader();

  useEffect(() => {
    setIsSignedIn(isSignedIn ?? false);
  }, [isSignedIn, setIsSignedIn]);

  return (
    <div className="flex h-full flex-col">
      {file ? <EditorLayout /> : <UploadScreen />}
    </div>
  );
}
