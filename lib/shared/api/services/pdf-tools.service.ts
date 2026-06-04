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

import { apiClient } from "@/lib/config/api-client";
import { PDF_TOOLS } from "@/lib/shared/constants/endpoints";
import { ApiError } from "@/lib/shared/utils/api-error";
import { parseContentDispositionFilename } from "@/lib/shared/utils/download";

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

  return postForBlob(PDF_TOOLS.COMPRESS, formData, input.file.name, {
    signal: input.signal,
    suffix: "compressed",
  });
}

async function encrypt(input: EncryptFileInput): Promise<PdfToolBlobResult> {
  const formData = new FormData();

  formData.append("file", input.file);
  formData.append("userPassword", input.userPassword);
  if (input.ownerPassword) {
    formData.append("ownerPassword", input.ownerPassword);
  }
  formData.append("keyLength", input.keyLength);

  return postForBlob(PDF_TOOLS.ENCRYPT, formData, input.file.name, {
    signal: input.signal,
    suffix: "protected",
  });
}

async function decrypt(input: DecryptFileInput): Promise<PdfToolBlobResult> {
  const formData = new FormData();

  formData.append("file", input.file);
  formData.append("password", input.password);

  return postForBlob(PDF_TOOLS.DECRYPT, formData, input.file.name, {
    signal: input.signal,
    suffix: "unprotected",
  });
}

async function flatten(input: FlattenFileInput): Promise<PdfToolBlobResult> {
  const formData = new FormData();

  formData.append("file", input.file);

  return postForBlob(PDF_TOOLS.FLATTEN, formData, input.file.name, {
    signal: input.signal,
    suffix: "flattened",
  });
}

async function extractImages(
  input: ExtractImagesFileInput,
): Promise<ExtractImagesResult> {
  const formData = new FormData();

  formData.append("file", input.file);

  return postForBlob(PDF_TOOLS.EXTRACT_IMAGES, formData, input.file.name, {
    signal: input.signal,
    suffix: "images",
    ext: "zip",
  });
}

type PostBlobOptions = {
  signal?: AbortSignal;
  suffix: string;
  ext?: string;
};

async function postForBlob(
  url: string,
  formData: FormData,
  inputFileName: string,
  options: PostBlobOptions,
): Promise<PdfToolBlobResult> {
  try {
    const response = await apiClient.post<Blob>(url, formData, {
      headers: { Accept: "*/*" },
      responseType: "blob",
      // Ghostscript/qpdf on large PDFs can take 30+ seconds. Mirror the
      // conversion endpoint and disable axios' default timeout entirely.
      timeout: 0,
      signal: options.signal,
    });

    const fileName =
      parseContentDispositionFilename(
        response.headers["content-disposition"] as string | undefined,
      ) ?? deriveFallbackName(inputFileName, options.suffix, options.ext);

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

function deriveFallbackName(
  originalName: string,
  suffix: string,
  ext = "pdf",
): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "document";

  return `${base} (${suffix}).${ext}`;
}

export const pdfToolsService = {
  compress,
  encrypt,
  decrypt,
  flatten,
  extractImages,
};
