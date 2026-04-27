import type { ApiErrorResponse } from "@/lib/shared/types/api.types";
import type { AxiosError } from "axios";

import { isAxiosError } from "axios";

/**
 * Normalized API error thrown by the axios client.
 * Use this instead of inspecting raw AxiosError objects in callers.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly cause?: unknown;

  constructor(message: string, statusCode: number, cause?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

const STATUS_FALLBACK_MESSAGES: Record<number, string> = {
  400: "Invalid request.",
  401: "You need to sign in to continue.",
  403: "You do not have permission to perform this action.",
  404: "Resource not found.",
  409: "This action conflicts with the current state.",
  422: "Some fields are invalid. Please review and try again.",
  429: "Too many requests. Please slow down and try again.",
  500: "Something went wrong on our end. Please try again.",
};

const NETWORK_ERROR_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  return record.success === false && typeof record.message === "string";
}

/**
 * Convert any thrown value (AxiosError, ApiError, unknown) into a normalized ApiError.
 * Safe to call from React Query mutations / catch blocks.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (isAxiosError(error)) {
    return fromAxiosError(error);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 0, error);
  }

  return new ApiError("An unexpected error occurred.", 0, error);
}

function fromAxiosError(error: AxiosError): ApiError {
  // No response → network/CORS/abort.
  if (!error.response) {
    return new ApiError(NETWORK_ERROR_MESSAGE, 0, error);
  }

  const { status, data } = error.response;

  if (isApiErrorResponse(data)) {
    return new ApiError(data.message, data.statusCode ?? status, error);
  }

  const fallback =
    STATUS_FALLBACK_MESSAGES[status] ?? "Request failed. Please try again.";

  return new ApiError(fallback, status, error);
}

/** Convenience: extract a user-facing message from any thrown value. */
export function getApiErrorMessage(error: unknown): string {
  return toApiError(error).message;
}
