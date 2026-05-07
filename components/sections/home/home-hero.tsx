"use client";

import type { CloudSelectedFile } from "@/lib/client/hooks/upload/use-cloud-upload";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FileUpload } from "@/components/ui/file-upload";
import { useUploadCloudDocumentMutation } from "@/lib/client/query/mutations/documents.mutation";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

import { HomeCloudUploadRow } from "./home-cloud-upload-row";
import { HomeStats } from "./home-stats";

export function HomeHero() {
  const router = useRouter();
  const [cloudSelection, setCloudSelection] =
    useState<CloudSelectedFile | null>(null);
  const uploadCloudMutation = useUploadCloudDocumentMutation();
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);

  const handleFileSelect = (file: File) => {
    setCloudSelection(null);
    setCurrentDocument(null);
    setFile(file);
    router.push(ROUTES.TOOLS.PDF_EDITOR);
  };

  const handleCloudUpload = async (selection: CloudSelectedFile) => {
    const uploaded = await uploadCloudMutation.mutateAsync({
      accessToken: selection.accessToken,
      fileId: selection.id,
      fileName: selection.name,
      mimeType: selection.mimeType,
      provider: selection.provider,
    });

    setCurrentDocument({ id: uploaded.id, name: uploaded.filename });
    setCloudSelection(selection);
    toast.info({ title: "Opening imported document..." });
    router.push(`${ROUTES.TOOLS.PDF_EDITOR}?id=${uploaded.id}`);
  };

  return (
    <section className="flex w-full flex-col items-center py-4 sm:py-8">
      <div className="flex w-full max-w-5xl flex-col items-center gap-8 text-center">
        <div className="space-y-5">
          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl xl:text-7xl">
            All-in-One Online{" "}
            <span className="text-[var(--color-accent)]">PDF</span> Editor
          </h1>
          <p className="mx-auto max-w-3xl text-lg leading-8 text-default-600 sm:text-xl dark:text-default-400">
            Easily edit, convert and sign PDFs. Fast, simple and secure.
          </p>
        </div>

        <div className="w-full max-w-5xl rounded-[2rem] border border-dashed border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)] bg-[var(--color-background)]/75 p-5 backdrop-blur-sm dark:border-[color-mix(in_oklab,var(--color-accent)_25%,transparent)] sm:p-6">
          <FileUpload
            marketingGrouped
            accept={["application/pdf"]}
            acceptLabel="PDF"
            appearance="marketing"
            heading="Drop your file here"
            onFileSelect={handleFileSelect}
          />
          <div className="mt-6 border-t border-dashed border-default-300 pt-7 dark:border-default-600">
            <HomeCloudUploadRow
              cloudUploadPending={uploadCloudMutation.isPending}
              onCloudSelection={setCloudSelection}
              onCloudUpload={handleCloudUpload}
              onFileSelect={handleFileSelect}
            />
            {cloudSelection ? (
              <p className="mt-4 text-center text-sm text-default-600 dark:text-default-400">
                Cloud file selected:{" "}
                <span className="font-medium text-foreground">
                  {cloudSelection.name}
                </span>
                . Import will open in editor automatically.
              </p>
            ) : null}
          </div>
        </div>

        <HomeStats />
      </div>
    </section>
  );
}
