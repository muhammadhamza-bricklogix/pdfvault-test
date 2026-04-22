"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

import { usePdfLoader } from "@/lib/client/hooks/pdf-editor/use-pdf-loader";
import { usePdfEditorStore } from "@/lib/client/stores";
import { FileUpload } from "@/components/ui/file-upload";

import { EditorTopBar } from "./EditorTopBar";
import { PdfViewerCanvas } from "./PdfViewerCanvas";
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
      <EditorTopBar />
      <div className="flex flex-1 overflow-hidden">
        <ThumbnailSidebar />
        <PdfViewerCanvas />
      </div>
    </>
  );
}

export function PdfEditorShell() {
  const { isSignedIn } = useAuth();
  const file = usePdfEditorStore((s) => s.file);
  const setIsSignedIn = usePdfEditorStore((s) => s.setIsSignedIn);

  useEffect(() => {
    setIsSignedIn(isSignedIn ?? false);
  }, [isSignedIn, setIsSignedIn]);

  return (
    <div className="flex h-full flex-col">
      {file ? <EditorLayout /> : <UploadScreen />}
    </div>
  );
}
