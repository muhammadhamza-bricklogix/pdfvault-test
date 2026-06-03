"use client";

import type {
  CompressFileInput,
  CompressFileResult,
} from "@/lib/shared/types/pdf-tools.types";

import { useMutation } from "@tanstack/react-query";

import { pdfToolsService } from "@/lib/shared/api/services/pdf-tools.service";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Compress mutation. Opens a loading toast, swaps it for success/error on
 * settle. The caller decides what to do with the returned blob (typically
 * trigger the browser download via `triggerBlobDownload`).
 */
export function useCompressFileMutation() {
  return useMutation<CompressFileResult, Error, CompressFileInput, string>({
    mutationFn: (input) => pdfToolsService.compress(input),
    onMutate: (input) =>
      toast.loading({
        title: "Compressing PDF",
        description: `${input.file.name} • ${input.preset} preset`,
      }),
    onSuccess: (result, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      toast.success({
        title: "Compression complete",
        description: `Ready to download — ${result.fileName}`,
      });
    },
    onError: (error, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      toast.error({
        title: "Compression failed",
        description: extractMessage(error),
      });
    },
  });
}

function extractMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;

  return "Something went wrong. Please try again.";
}
