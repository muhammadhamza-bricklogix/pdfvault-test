type ClerkFieldErrorLike = {
  longMessage?: string;
  message: string;
} | null;

type ClerkGlobalErrorLike = {
  longMessage?: string;
  message: string;
} | null;

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
