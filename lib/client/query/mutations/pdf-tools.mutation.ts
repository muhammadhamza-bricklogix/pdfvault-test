"use client";

import type {
  CompressFileInput,
  CompressFileResult,
  DecryptFileInput,
  EncryptFileInput,
  ExtractImagesFileInput,
  ExtractImagesResult,
  FlattenFileInput,
  PdfToolBlobResult,
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

export function useEncryptFileMutation() {
  return useMutation<PdfToolBlobResult, Error, EncryptFileInput, string>({
    mutationFn: (input) => pdfToolsService.encrypt(input),
    onMutate: (input) =>
      toast.loading({
        title: "Encrypting PDF",
        description: `${input.file.name} • AES-${input.keyLength}`,
      }),
    onSuccess: (result, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      toast.success({
        title: "Encrypted",
        description: `Ready to download — ${result.fileName}`,
      });
    },
    onError: (error, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      toast.error({
        title: "Encryption failed",
        description: extractMessage(error),
      });
    },
  });
}

export function useDecryptFileMutation() {
  return useMutation<PdfToolBlobResult, Error, DecryptFileInput, string>({
    mutationFn: (input) => pdfToolsService.decrypt(input),
    onMutate: (input) =>
      toast.loading({
        title: "Removing password",
        description: input.file.name,
      }),
    onSuccess: (result, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      toast.success({
        title: "Password removed",
        description: `Ready to download — ${result.fileName}`,
      });
    },
    onError: (error, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      toast.error({
        title: "Decryption failed",
        description: extractMessage(error),
      });
    },
  });
}

export function useFlattenFileMutation() {
  return useMutation<PdfToolBlobResult, Error, FlattenFileInput, string>({
    mutationFn: (input) => pdfToolsService.flatten(input),
    onMutate: (input) =>
      toast.loading({
        title: "Flattening form fields",
        description: input.file.name,
      }),
    onSuccess: (result, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      toast.success({
        title: "Flatten complete",
        description: `Ready to download — ${result.fileName}`,
      });
    },
    onError: (error, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      toast.error({
        title: "Flatten failed",
        description: extractMessage(error),
      });
    },
  });
}

export function useExtractImagesMutation() {
  return useMutation<
    ExtractImagesResult,
    Error,
    ExtractImagesFileInput,
    string
  >({
    mutationFn: (input) => pdfToolsService.extractImages(input),
    onMutate: (input) =>
      toast.loading({
        title: "Extracting images",
        description: input.file.name,
      }),
    onSuccess: (result, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      toast.success({
        title: "Images extracted",
        description: `Ready to download — ${result.fileName}`,
      });
    },
    onError: (error, _input, loadingKey) => {
      if (loadingKey) toast.close(loadingKey);
      toast.error({
        title: "Image extraction failed",
        description: extractMessage(error),
      });
    },
  });
}

function extractMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;

  return "Something went wrong. Please try again.";
}
