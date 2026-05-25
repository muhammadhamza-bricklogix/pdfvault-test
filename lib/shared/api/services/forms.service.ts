import type {
  FinalizeFormSessionInput,
  FinalizeFormSessionResult,
  FormSession,
  StartFormSessionInput,
  UploadSignatureInput,
  UploadSignatureResult,
} from "@/lib/shared/types/forms.types";

import { apiClient } from "@/lib/config/api-client";
import { FORMS } from "@/lib/shared/constants/endpoints";

type StartSessionResponse = {
  sessionId: string;
  schema: unknown;
  pdfUrl: string;
};

async function startFormSession(
  input: StartFormSessionInput,
): Promise<FormSession> {
  // The backend identifies templates by slug (e.g. "w-9"). `input.formId` IS
  // the slug — the type was named before the endpoint shape was finalized.
  // The /start endpoint accepts an optional `values` body; pass empty.
  const { data } = await apiClient.post<StartSessionResponse>(
    FORMS.START(input.formId),
    {},
  );

  // Backend returns a slim response; widen it into the FormSession shape the
  // rest of the frontend already consumes (values/signatureKey/finalizedUrl
  // are populated by later mutations).
  return {
    id: data.sessionId,
    formId: input.formId,
    schema: data.schema as FormSession["schema"],
    pdfUrl: data.pdfUrl,
    values: {},
    signatureKey: null,
    finalizedUrl: null,
    updatedAt: new Date().toISOString(),
  };
}

async function uploadSignature(
  input: UploadSignatureInput,
): Promise<UploadSignatureResult> {
  const formData = new FormData();

  formData.append("file", input.blob, "signature.png");

  const { data } = await apiClient.post<UploadSignatureResult>(
    FORMS.SIGNATURE(input.sessionId),
    formData,
  );

  return data;
}

async function finalizeFormSession(
  input: FinalizeFormSessionInput,
): Promise<FinalizeFormSessionResult> {
  const { data } = await apiClient.post<FinalizeFormSessionResult>(
    FORMS.FINALIZE(input.sessionId),
    {
      values: input.values,
      signatureKey: input.signatureKey,
    },
  );

  return data;
}

export const formsService = {
  startFormSession,
  uploadSignature,
  finalizeFormSession,
};
