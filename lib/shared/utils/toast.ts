import { toast as heroToast } from "@heroui/react";

type ToastInput = {
  title: string;
  description?: string;
};

// react-aria's UNSTABLE_ToastQueue enforces a 5_000ms minimum to give screen
// readers enough time to announce the toast. Anything below that is silently
// upgraded; we use 5_000 explicitly so the behavior is obvious to future
// readers.
const DEFAULT_TIMEOUT_MS = 5000;
const ERROR_TIMEOUT_MS = 7000;

export const toast = {
  success: ({ title, description }: ToastInput) =>
    heroToast.success(title, { description, timeout: DEFAULT_TIMEOUT_MS }),
  error: ({ title, description }: ToastInput) =>
    heroToast.danger(title, { description, timeout: ERROR_TIMEOUT_MS }),
  info: ({ title, description }: ToastInput) =>
    heroToast.info(title, { description, timeout: DEFAULT_TIMEOUT_MS }),
  /**
   * Persistent loading toast. Returns the key — pass it to `toast.close(key)`
   * once the work finishes so it can be replaced by a success/error toast.
   */
  loading: ({ title, description }: ToastInput) =>
    heroToast.info(title, { description, isLoading: true, timeout: 0 }),
  close: (key: string) => heroToast.close(key),
};
