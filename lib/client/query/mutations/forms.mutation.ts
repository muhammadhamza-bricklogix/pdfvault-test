"use client";

import type {
  FinalizeFormSessionInput,
  FinalizeFormSessionResult,
  FormSession,
  StartFormSessionInput,
  UploadSignatureInput,
  UploadSignatureResult,
} from "@/lib/shared/types/forms.types";

import { useMutation } from "@tanstack/react-query";

import { formsService } from "@/lib/shared/api/services/forms.service";

export function useStartFormSessionMutation() {
  return useMutation<FormSession, Error, StartFormSessionInput>({
    mutationFn: (input) => formsService.startFormSession(input),
  });
}

export function useUploadSignatureMutation() {
  return useMutation<UploadSignatureResult, Error, UploadSignatureInput>({
    mutationFn: (input) => formsService.uploadSignature(input),
  });
}

export function useFinalizeFormSessionMutation() {
  return useMutation<
    FinalizeFormSessionResult,
    Error,
    FinalizeFormSessionInput
  >({
    mutationFn: (input) => formsService.finalizeFormSession(input),
  });
}
