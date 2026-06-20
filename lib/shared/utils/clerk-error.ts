type ClerkFieldErrorLike = {
  longMessage?: string;
  message: string;
} | null;

type ClerkGlobalErrorLike = {
  longMessage?: string;
  message: string;
} | null;

type ClerkApiError = {
  code?: string;
  longMessage?: string;
  message: string;
  meta?: { paramName?: string };
};

type ClerkErrorEnvelope = {
  errors?: ClerkApiError[] | null;
};

function unwrapClerkErrors(
  error:
    | ClerkApiError
    | ClerkApiError[]
    | ClerkErrorEnvelope
    | null
    | undefined,
): ClerkApiError[] {
  if (!error) return [];
  if (Array.isArray(error)) return error;

  const envelope = error as ClerkErrorEnvelope;

  if (Array.isArray(envelope.errors) && envelope.errors.length > 0) {
    return envelope.errors;
  }

  return [error as ClerkApiError];
}

export const getClerkErrorMessage = (error?: ClerkFieldErrorLike) =>
  error?.longMessage ?? error?.message ?? null;

export const getClerkGlobalErrorMessage = (
  errors?: ClerkGlobalErrorLike[] | null,
) => {
  if (!errors?.length) {
    return null;
  }

  return errors
    .map((error) => getClerkErrorMessage(error))
    .filter(Boolean)
    .join(" ");
};

const CLERK_PARAM_TO_FIELD: Record<string, string> = {
  email_address: "emailAddress",
  identifier: "emailAddress",
  password: "password",
  code: "code",
};

// Custom copy for specific Clerk error codes. Clerk's default messages are
// curt and unhelpful ("That email address is taken. Please try another.");
// these overrides match the product's friendlier voice and point users at
// the next action (sign in / reset).
const CLERK_CODE_MESSAGE_OVERRIDES: Record<string, string> = {
  form_identifier_exists:
    "An account with this email already exists. Would you like to log in or reset your password?",
};

type ParsedClerkError = {
  fieldErrors: Record<string, string>;
  serverError: string | null;
};

export function parseClerkError(
  error:
    | ClerkApiError
    | ClerkApiError[]
    | ClerkErrorEnvelope
    | null
    | undefined,
): ParsedClerkError {
  const result: ParsedClerkError = { fieldErrors: {}, serverError: null };
  const errors = unwrapClerkErrors(error);

  if (errors.length === 0) {
    return result;
  }

  for (const err of errors) {
    const override = err.code
      ? CLERK_CODE_MESSAGE_OVERRIDES[err.code]
      : undefined;
    const message = override ?? err.longMessage ?? err.message;

    if (!message) continue;

    const paramName = err.meta?.paramName;
    const fieldName = paramName ? CLERK_PARAM_TO_FIELD[paramName] : null;

    if (fieldName) {
      result.fieldErrors[fieldName] = message;
    } else {
      result.serverError = result.serverError
        ? `${result.serverError} ${message}`
        : message;
    }
  }

  // Fallback: if we extracted any field errors but no global error, surface the
  // first field error globally too — covers UIs that don't visually pair every
  // field with its error (custom OTP fields, etc.).
  if (!result.serverError) {
    const firstFieldError = Object.values(result.fieldErrors)[0];

    if (firstFieldError) {
      result.serverError = firstFieldError;
    }
  }

  return result;
}
