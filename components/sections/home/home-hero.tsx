"use client";

import type { CloudSelectedFile } from "@/lib/client/hooks/upload/use-cloud-upload";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { DuplicateUploadModal } from "@/components/sections/dashboard/duplicate-upload-modal";
import { FileUpload } from "@/components/ui/file-upload";
import {
  UPLOAD_ACCEPT_MIME,
  uploadAsPdf,
} from "@/lib/client/file-conversion/upload-to-pdf";
import { findDuplicateByFilename } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { useUploadCloudDocumentMutation } from "@/lib/client/query/mutations/documents.mutation";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

import { HomeCloudUploadRow } from "./home-cloud-upload-row";
import { HomeStats } from "./home-stats";

export function HomeHero() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [cloudSelection, setCloudSelection] =
    useState<CloudSelectedFile | null>(null);
  const uploadCloudMutation = useUploadCloudDocumentMutation();
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);
  // Holds the cloud upload waiting on a duplicate-name decision from the
  // user. Same UX as the device upload's `useUploadWithDuplicateCheck`:
  // we surface the existing filename in a modal and let the user pick
  // overwrite (re-uploads targeting `existingDocumentId`) or ignore
  // (drops the upload). Cleared when the modal closes either way.
  const [pendingCloudDuplicate, setPendingCloudDuplicate] = useState<{
    existingDocumentId: string;
    filename: string;
    selection: CloudSelectedFile;
    safeName: string;
  } | null>(null);

  const requireSignInForCloud = useCallback(() => {
    toast.info({
      description: "Cloud import saves the PDF to your account.",
      title: "Sign in required",
    });
    router.push(
      `${ROUTES.AUTH.LOGIN}?redirect_url=${encodeURIComponent(ROUTES.PUBLIC.HOME)}`,
    );
  }, [router]);

  const handleFileSelect = async (file: File) => {
    const isAlreadyPdf = file.type === "application/pdf";
    const loadingKey = isAlreadyPdf
      ? null
      : toast.loading({
          description: `Preparing ${file.name} for the editor.`,
          title: "Converting to PDF",
        });

    try {
      const pdfFile = await uploadAsPdf(file);

      setCloudSelection(null);
      setCurrentDocument(null);
      setFile(pdfFile);
      router.push(ROUTES.TOOLS.PDF_EDITOR);
    } catch (err) {
      toast.error({
        description: err instanceof Error ? err.message : undefined,
        title: "Couldn't open file",
      });
    } finally {
      if (loadingKey) toast.close(loadingKey);
    }
  };

  const finalizeCloudUpload = async (
    selection: CloudSelectedFile,
    safeName: string,
    documentId?: string,
  ) => {
    const uploaded = await uploadCloudMutation.mutateAsync({
      accessToken: selection.accessToken,
      documentId,
      fileId: selection.id,
      fileName: safeName,
      mimeType: selection.mimeType,
      provider: selection.provider,
    });

    setFile(null);
    setCurrentDocument({ id: uploaded.id, name: uploaded.filename });
    setCloudSelection(selection);
    toast.info({ title: "Opening imported document..." });
    router.push(`${ROUTES.TOOLS.PDF_EDITOR}?id=${uploaded.id}`);
  };

  const handleCloudUpload = async (selection: CloudSelectedFile) => {
    if (!isSignedIn) {
      requireSignInForCloud();
      throw new Error("SIGN_IN_REQUIRED");
    }

    // The Google Picker filters by mime type, so the file IS a PDF — but the
    // Drive filename often has no `.pdf` extension. The backend derives the
    // type from the filename extension, so an extension-less name routes
    // through the conversion path and 400s. Force `.pdf` here.
    const isPdfMime = selection.mimeType === "application/pdf";
    const safeName =
      isPdfMime && !/\.pdf$/i.test(selection.name)
        ? `${selection.name}.pdf`
        : selection.name;

    // Duplicate-name guard — same UX as the device upload path
    // (`useUploadWithDuplicateCheck`). Cloud uploads were skipping this
    // check entirely (QA report 2026-06-18: "while uploading the file
    // from google drive it failed to check the duplicate file name").
    // On match: stash the pending upload, surface the modal, and let
    // the user pick overwrite vs ignore. If the lookup itself fails
    // (network / auth), fall through to the upload so a transient
    // error doesn't block the user.
    try {
      const existing = await findDuplicateByFilename(safeName);

      if (existing) {
        setPendingCloudDuplicate({
          existingDocumentId: existing.id,
          filename: existing.filename,
          selection,
          safeName,
        });

        return;
      }
    } catch (err) {
      logger.error("Cloud duplicate-name check failed", err);
    }

    await finalizeCloudUpload(selection, safeName);
  };

  const handleCloudDuplicateOverwrite = () => {
    if (!pendingCloudDuplicate) return;
    const pending = pendingCloudDuplicate;

    setPendingCloudDuplicate(null);
    void finalizeCloudUpload(
      pending.selection,
      pending.safeName,
      pending.existingDocumentId,
    ).catch((err: unknown) => {
      toast.error({
        title: "Cloud upload failed",
        description: err instanceof Error ? err.message : undefined,
      });
    });
  };

  const handleCloudDuplicateIgnore = () => {
    setPendingCloudDuplicate(null);
  };

  const cloudImportAllowed = isLoaded && Boolean(isSignedIn);

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
            accept={UPLOAD_ACCEPT_MIME}
            acceptLabel="PDF"
            appearance="marketing"
            heading="Drop your file here"
            onFileSelect={handleFileSelect}
          />
          <div className="mt-6 border-t border-dashed border-default-300 pt-7 dark:border-default-600">
            <HomeCloudUploadRow
              cloudImportAllowed={cloudImportAllowed}
              cloudUploadPending={uploadCloudMutation.isPending}
              onCloudSelection={setCloudSelection}
              onCloudUpload={handleCloudUpload}
              onFileSelect={handleFileSelect}
              onRequireSignInForCloud={requireSignInForCloud}
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
      <DuplicateUploadModal
        filename={pendingCloudDuplicate?.filename ?? null}
        onIgnore={handleCloudDuplicateIgnore}
        onOverwrite={handleCloudDuplicateOverwrite}
      />
    </section>
  );
}
