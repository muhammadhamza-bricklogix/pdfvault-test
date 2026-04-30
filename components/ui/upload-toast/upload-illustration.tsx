"use client";

import type { UploadToastState } from "@/lib/client/upload-toasts/queue";

import {
  FilesUploadingIllustration,
  SuccessfulUploadIllustration,
  UploadErrorIllustration,
} from "@/components/ui/illustrations";

type Props = {
  status: UploadToastState["status"];
};

export function UploadIllustration({ status }: Props) {
  const isPending = status === "uploading" || status === "queued";
  const accent =
    status === "success"
      ? "text-success"
      : status === "error"
        ? "text-danger"
        : "text-accent";

  const Component =
    status === "success"
      ? SuccessfulUploadIllustration
      : status === "error"
        ? UploadErrorIllustration
        : FilesUploadingIllustration;

  return (
    <div
      aria-hidden
      className={`relative flex h-20 w-20 shrink-0 items-center justify-center ${accent}`}
    >
      <Component
        className={`h-full w-full${isPending ? " animate-illust-float" : ""}`}
      />
    </div>
  );
}
