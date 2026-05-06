"use client";

import { useRouter } from "next/navigation";

import { FileUpload } from "@/components/ui/file-upload";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";

import { HomeCloudUploadRow } from "./home-cloud-upload-row";
import { HomeStats } from "./home-stats";

export function HomeHero() {
  const router = useRouter();
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);

  const handleFileSelect = (file: File) => {
    setCurrentDocument(null);
    setFile(file);
    router.push(ROUTES.TOOLS.PDF_EDITOR);
  };

  return (
    <section className="flex w-full flex-col items-center py-4 sm:py-8">
      <div className="flex w-full max-w-5xl flex-col items-center gap-8 text-center">
        <div className="space-y-4">
          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl xl:text-7xl">
            All-in-One Online PDF Editor
          </h1>
          <p className="mx-auto max-w-3xl text-lg leading-8 text-default-600 sm:text-xl dark:text-default-400">
            Easily edit, convert and sign PDFs. Fast, simple and secure.
          </p>
        </div>

        <div className="w-full max-w-5xl rounded-[2rem] border border-dashed border-default-300 bg-[var(--color-background)]/75 p-5 backdrop-blur-sm dark:border-default-600 sm:p-6">
          <FileUpload
            marketingGrouped
            accept={["application/pdf"]}
            acceptLabel="PDF"
            appearance="marketing"
            heading="Drop your file here"
            onFileSelect={handleFileSelect}
          />
          <div className="mt-6 border-t border-dashed border-default-300 pt-7 dark:border-default-600">
            <HomeCloudUploadRow onFileSelect={handleFileSelect} />
          </div>
        </div>

        <HomeStats />
      </div>
    </section>
  );
}
