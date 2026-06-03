import type {
  CompressFileInput,
  CompressFileResult,
} from "@/lib/shared/types/pdf-tools.types";

import { apiClient } from "@/lib/config/api-client";
import { PDF_TOOLS } from "@/lib/shared/constants/endpoints";
import { ApiError } from "@/lib/shared/utils/api-error";
import { parseContentDispositionFilename } from "@/lib/shared/utils/download";

const COMPRESS_FALLBACK = "compressed.pdf";

async function compress(input: CompressFileInput): Promise<CompressFileResult> {
  const formData = new FormData();

  formData.append("file", input.file);
  formData.append("preset", input.preset);

  if (input.quality !== undefined) {
    formData.append("quality", String(input.quality));
  }
  if (input.maxImageDpi !== undefined) {
    formData.append("maxImageDpi", String(input.maxImageDpi));
  }
  if (input.grayscale !== undefined) {
    formData.append("grayscale", String(input.grayscale));
  }

  try {
    const response = await apiClient.post<Blob>(PDF_TOOLS.COMPRESS, formData, {
      headers: { Accept: "*/*" },
      responseType: "blob",
      // Ghostscript on a large PDF can take 30+ seconds. Match the
      // conversion path and disable axios' default timeout entirely.
      timeout: 0,
      signal: input.signal,
    });

    const fileName =
      parseContentDispositionFilename(
        response.headers["content-disposition"] as string | undefined,
      ) ?? deriveFallbackName(input.file.name);

    return { blob: response.data, fileName };
  } catch (error) {
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

function deriveFallbackName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "");

  return base ? `${base} (compressed).pdf` : COMPRESS_FALLBACK;
}

export const pdfToolsService = {
  compress,
};
