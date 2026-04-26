"use client";

import { useRouter } from "next/navigation";

import { FileUpload } from "@/components/ui/file-upload";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";

export function HomeHero() {
  const router = useRouter();
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);

  const handleFileSelect = (file: File) => {
    // Local-only open: don't upload until the user explicitly Saves in the
    // editor (which will prompt sign-in if needed).
    setCurrentDocument(null);
    setFile(file);
    router.push(ROUTES.TOOLS.PDF_EDITOR);
  };

  return (
    <section className="flex w-full flex-col items-center py-4 sm:py-8">
      <div className="flex w-full max-w-5xl flex-col items-center gap-8 text-center">
        <div className="space-y-4">
          <h1 className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Online PDF tools for the work you do every day.
          </h1>
          <p className="mx-auto max-w-3xl text-lg leading-8 text-[var(--app-muted)] sm:text-xl">
            Upload a file, choose a task, and move through your document work
            without friction.
          </p>
        </div>

        <FileUpload
          accept={["application/pdf"]}
          acceptLabel="PDF"
          description="Merge, convert, and prepare documents from one calm workspace."
          heading="Drop your PDF files here"
          onFileSelect={handleFileSelect}
        />

        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[var(--app-muted)] sm:text-base">
          <span className="font-semibold text-[var(--color-foreground)]">
            Great
          </span>
          <div
            aria-label="Five star rating"
            className="flex items-center gap-1"
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <span
                key={index}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-accent)] text-xs font-semibold text-[var(--color-background)]"
              >
                &#9733;
              </span>
            ))}
          </div>
          <span>44,000+ reviews from people handling PDFs every day.</span>
        </div>
      </div>
    </section>
  );
}
