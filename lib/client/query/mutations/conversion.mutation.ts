"use client";

import type {
  ConvertFileInput,
  ConvertFileResult,
} from "@/lib/shared/types/conversion.types";

import { useMutation } from "@tanstack/react-query";

import { PAYWALL_CANCELLED_ERR_NAME } from "@/lib/client/hooks/billing/paywall-bus";
import { conversionService } from "@/lib/shared/api/services/conversion.service";
import { toast } from "@/lib/shared/utils/toast";

/**
 * One-shot file conversion. Opens a loading toast and replaces it with a
 * success or error toast on settle. The resulting blob is returned to the
 * caller — the UI decides when (and whether) to trigger the browser download.
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
      toast.success({
        title: "Conversion complete",
        description: `Ready to download — ${result.fileName}`,
      });
    },
    onError: (error, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      // Suppress the failure toast when the user cancelled the paywall
      // mid-request — the axios interceptor throws PaywallCancelledError
      // and the caller already knows to bail out silently.
      if ((error as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
        return;
      }
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
