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

type ParsedClerkError = {
  fieldErrors: Record<string, string>;
  serverError: string | null;
};

export function parseClerkError(
  error: ClerkApiError | ClerkApiError[] | null | undefined,
): ParsedClerkError {
  const result: ParsedClerkError = { fieldErrors: {}, serverError: null };

  if (!error) {
    return result;
  }

  const errors = Array.isArray(error) ? error : [error];

  for (const err of errors) {
    const message = err.longMessage ?? err.message;
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

  return result;
}
