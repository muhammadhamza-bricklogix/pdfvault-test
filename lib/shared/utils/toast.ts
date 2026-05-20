import { toast as heroToast } from "@heroui/react";

type ToastInput = {
  title: string;
  description?: string;
};

export const toast = {
  success: ({ title, description }: ToastInput) =>
    heroToast.success(title, { description }),
  error: ({ title, description }: ToastInput) =>
    heroToast.danger(title, { description }),
  info: ({ title, description }: ToastInput) =>
    heroToast.info(title, { description }),
  /**
   * Persistent loading toast. Returns the key — pass it to `toast.close(key)`
   * once the work finishes so it can be replaced by a success/error toast.
   */
  loading: ({ title, description }: ToastInput) =>
    heroToast.info(title, { description, isLoading: true, timeout: 0 }),
  close: (key: string) => heroToast.close(key),
};
