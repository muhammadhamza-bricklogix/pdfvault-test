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
};
