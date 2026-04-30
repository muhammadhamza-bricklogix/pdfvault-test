"use client";

import type { QueuedToast } from "react-aria-components";
import type {
  UploadToastContent,
  UploadToastState,
} from "@/lib/client/upload-toasts/queue";

import {
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, ProgressBar, Toast } from "@heroui/react";

import { useUploadToastStore } from "@/lib/client/upload-toasts/queue";

import { UploadIllustration } from "./upload-illustration";

type Props = {
  toast: QueuedToast<UploadToastContent>;
};

export function UploadToastRenderer({ toast: toastItem }: Props) {
  const trackingId = toastItem.content.trackingId;
  const state = useUploadToastStore((s) => s.byId[trackingId]);

  if (!state) {
    return (
      <Toast className="rounded-xl" toast={toastItem}>
        <Toast.Content />
      </Toast>
    );
  }

  const variant: "default" | "success" | "danger" =
    state.status === "success"
      ? "success"
      : state.status === "error"
        ? "danger"
        : "default";

  return (
    <Toast
      className="box-border !min-w-0 w-full max-w-[min(38rem,calc(100vw-1.5rem))] rounded-xl border border-default-200 bg-default-100 p-4 shadow-lg"
      toast={toastItem}
      variant={variant}
    >
      <Toast.Content className="grid w-full min-w-0 grid-cols-[5.75rem,minmax(0,1fr)] items-center gap-4 pr-6">
        <UploadIllustration status={state.status} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="truncate text-sm font-medium" title={state.filename}>
              {state.filename}
            </p>
            <StatusBadge state={state} />
          </div>
          <ProgressTrack progress={state.progress} status={state.status} />
          <p className="truncate text-sm text-default-500">
            {state.message}
          </p>
          <ToastActions state={state} />
        </div>
      </Toast.Content>
      <Toast.CloseButton className="absolute right-2 top-2" />
    </Toast>
  );
}

function StatusBadge({ state }: { state: UploadToastState }) {
  switch (state.status) {
    case "success":
      return (
        <span className="flex shrink-0 items-center gap-1 text-sm text-success-500">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
          Done
        </span>
      );
    case "error":
      return (
        <span className="flex shrink-0 items-center gap-1 text-sm text-danger-500">
          <HugeiconsIcon icon={CancelCircleIcon} size={14} />
          Failed
        </span>
      );
    case "queued":
      return (
        <span className="shrink-0 text-sm text-default-500">
          Waiting
        </span>
      );
    default:
      return (
        <span className="flex shrink-0 items-center gap-1 text-sm text-default-500">
          <HugeiconsIcon
            className="animate-spin"
            icon={Loading03Icon}
            size={14}
          />
          {Math.min(99, Math.round(state.progress))}%
        </span>
      );
  }
}

function ProgressTrack({
  progress,
  status,
}: {
  progress: number;
  status: UploadToastState["status"];
}) {
  const indeterminate = status === "queued";

  return (
    <ProgressBar
      aria-label="Upload progress"
      className="w-full"
      color={status === "error" ? "danger" : "accent"}
      isIndeterminate={indeterminate}
      maxValue={100}
      minValue={0}
      value={progress}
    >
      <ProgressBar.Track className="h-2 w-full overflow-hidden rounded-full bg-default-200">
        <ProgressBar.Fill className="h-full transition-[width] duration-300 ease-out" />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

function ToastActions({ state }: { state: UploadToastState }) {
  if (state.status === "uploading" || state.status === "queued") {
    if (!state.onCancel) return null;

    return (
      <div className="flex justify-end">
        <Button size="sm" variant="tertiary" onPress={state.onCancel}>
          Cancel
        </Button>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="flex justify-end gap-2">
        {state.onRetry ? (
          <Button size="sm" variant="secondary" onPress={state.onRetry}>
            <HugeiconsIcon icon={Refresh01Icon} size={14} />
            Retry
          </Button>
        ) : null}
      </div>
    );
  }
  if (state.status === "success" && state.documentId && state.onOpen) {
    const documentId = state.documentId;
    const onOpen = state.onOpen;

    return (
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="secondary"
          onPress={() => onOpen(documentId)}
        >
          Open
        </Button>
      </div>
    );
  }

  return null;
}
