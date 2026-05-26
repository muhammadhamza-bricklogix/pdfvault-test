"use client";

import type {
  ConvertFileInput,
  ConvertFileResult,
} from "@/lib/shared/types/conversion.types";

import { useMutation } from "@tanstack/react-query";

import { conversionService } from "@/lib/shared/api/services/conversion.service";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { toast } from "@/lib/shared/utils/toast";

/**
 * One-shot file conversion. Opens a loading toast, replaces it with a
 * success or error toast, and (on success) triggers a browser download for
 * the returned blob.
 */
export function useConvertFileMutation() {
  return useMutation<ConvertFileResult, Error, ConvertFileInput, string>({
    mutationFn: (input) => conversionService.convert(input),
    onMutate: (input) =>
      toast.loading({
        title: "Converting your file",
        description: `${input.file.name} → ${input.type.split("_to_")[1]?.toUpperCase() ?? "result"}`,
      }),
    onSuccess: (result, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      triggerBlobDownload(result.blob, result.fileName);
      toast.success({
        title: "Conversion complete",
        description: `Downloaded ${result.fileName}`,
      });
    },
    onError: (error, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      toast.error({
        title: "Conversion failed",
        description: extractMessage(error),
      });
    },
  });
}

function extractMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;

  return "Something went wrong. Please try again.";
}
