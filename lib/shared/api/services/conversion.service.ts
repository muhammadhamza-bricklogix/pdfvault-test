import type {
  ConvertFileInput,
  ConvertFileResult,
} from "@/lib/shared/types/conversion.types";

import { apiClient } from "@/lib/config/api-client";
import { CONVERSION } from "@/lib/shared/constants/endpoints";
import { ApiError } from "@/lib/shared/utils/api-error";
import { parseContentDispositionFilename } from "@/lib/shared/utils/download";

const FALLBACK_FILENAME = "converted-file";

async function convert(input: ConvertFileInput): Promise<ConvertFileResult> {
  const formData = new FormData();

  formData.append("file", input.file);
  formData.append("type", input.type);

  try {
    const response = await apiClient.post<Blob>(CONVERSION.CONVERT, formData, {
      headers: {
        Accept: "*/*",
      },
      responseType: "blob",
      // CloudConvert jobs can run for tens of seconds for large/complex files.
      // Disable Axios' default timeout so the request waits for the backend.
      timeout: 0,
      signal: input.signal,
    });

    const fileName =
      parseContentDispositionFilename(
        response.headers["content-disposition"] as string | undefined,
      ) ?? deriveFallbackName(input);

    return { blob: response.data, fileName };
  } catch (error) {
    // With responseType: "blob", error bodies arrive as Blob instead of JSON.
    // Inflate the blob back to text so the user sees the backend's specific
    // message ("Invalid file extension...", "File size exceeds...") rather
    // than the generic fallback from `toApiError`.
    throw await inflateBlobError(error);
  }
}

async function inflateBlobError(error: unknown): Promise<Error> {
  if (!(error instanceof ApiError)) return error as Error;

  const raw = (error.cause as { response?: { data?: unknown } } | undefined)
    ?.response?.data;

  if (!(raw instanceof Blob)) return error;

  try {
    const text = await raw.text();
    const parsed = JSON.parse(text) as { message?: string };

    if (parsed.message) {
      return new ApiError(parsed.message, error.statusCode, error.cause);
    }
  } catch {
    // Blob wasn't JSON — leave the original error.
  }

  return error;
}

function deriveFallbackName(input: ConvertFileInput): string {
  // Last-resort filename if the server didn't send Content-Disposition.
  // Backend always does, but guard against proxy stripping in production.
  const base = input.file.name.replace(/\.[^.]+$/, "");
  const ext = input.type.split("_to_")[1];

  if (!base) return ext ? `${FALLBACK_FILENAME}.${ext}` : FALLBACK_FILENAME;

  return ext ? `${base}.${ext}` : base;
}

export const conversionService = {
  convert,
};
