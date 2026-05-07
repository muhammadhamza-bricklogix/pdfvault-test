"use client";

import { Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Spinner } from "@heroui/react";
import Image from "next/image";
import { useRef } from "react";

import {
  type CloudProvider,
  type CloudSelectedFile,
  useCloudUpload,
} from "@/lib/client/hooks/upload/use-cloud-upload";
import { toast } from "@/lib/shared/utils/toast";

function OneDriveIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 24 24">
      <path
        d="M9.8 9.2c-1.7 0-3.2.9-4 2.3A3.9 3.9 0 0 0 2 15.4C2 17.4 3.6 19 5.6 19h10.8c2 0 3.6-1.6 3.6-3.6s-1.6-3.6-3.6-3.6h-.2a5.1 5.1 0 0 0-4.7-3.3c-.6 0-1.2.1-1.7.3Z"
        fill="#0078D4"
      />
      <path
        d="M8.8 10.2a4.4 4.4 0 0 0-2.9 1.3 3.9 3.9 0 0 0-2.4 3.6c0 1.4.8 2.7 2 3.4-.9-.7-1.5-1.8-1.5-3 0-1.9 1.5-3.5 3.5-3.5h.2a4.6 4.6 0 0 1 4.2-2.9c1.8 0 3.4 1 4.2 2.5a3.7 3.7 0 0 0-3.8-3.1c-1.3 0-2.6.6-3.5 1.7Z"
        fill="#1490DF"
      />
    </svg>
  );
}

function DeviceIcon({ className }: { className?: string }) {
  return <HugeiconsIcon className={className} icon={Upload01Icon} size={28} />;
}

const OPTIONS = [
  {
    brandClassName: "",
    Glyph: null,
    id: "gdrive",
    label: "Upload from Google Drive",
  },
  {
    brandClassName: "text-[#0061FF]",
    Glyph: DeviceIcon,
    id: "device",
    label: "Upload from Device",
  },
  {
    brandClassName: "text-[#0078D4]",
    Glyph: OneDriveIcon,
    id: "onedrive",
    label: "Upload from OneDrive",
  },
] as const;

type HomeCloudUploadRowProps = {
  onCloudSelection?: (selection: CloudSelectedFile | null) => void;
  onCloudUpload?: (selection: CloudSelectedFile) => Promise<void>;
  cloudUploadPending?: boolean;
  onFileSelect: (file: File) => void;
};

function formatProviderLabel(provider: CloudProvider) {
  return provider === "gdrive" ? "Google Drive" : "OneDrive";
}

export function HomeCloudUploadRow({
  cloudUploadPending = false,
  onCloudSelection,
  onCloudUpload,
  onFileSelect,
}: HomeCloudUploadRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    activeProvider,
    clearTransient,
    error,
    isBusy,
    items,
    selected,
    selectCloudFile,
    start,
    status,
  } = useCloudUpload();

  const handleDevicePick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      onCloudSelection?.(null);
      onFileSelect(file);
    }
    e.currentTarget.value = "";
  };

  const onCloudPress = async (id: (typeof OPTIONS)[number]["id"]) => {
    if (id === "device") {
      handleDevicePick();

      return;
    }

    await start(id);
  };

  const cloudItems = activeProvider
    ? items.filter((item) => item.provider === activeProvider)
    : [];

  return (
    <div className="w-full">
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:justify-center sm:gap-5">
        <input
          ref={inputRef}
          accept="application/pdf"
          className="hidden"
          type="file"
          onChange={handleInputChange}
        />
        {OPTIONS.map(({ brandClassName, Glyph, id, label }) => (
          <Button
            key={id}
            className="h-auto flex-1 flex-col justify-center gap-3 rounded-[1.1rem] border border-default-300 bg-white/90 py-5 shadow-sm backdrop-blur-sm transition-colors hover:border-[color-mix(in_oklab,var(--color-accent)_50%,var(--foreground))] hover:bg-[var(--color-background)] dark:border-default-600 dark:bg-default-50/15 sm:flex-row sm:justify-start sm:gap-3.5 sm:px-6 sm:py-5"
            isDisabled={(isBusy && id !== activeProvider) || cloudUploadPending}
            variant="secondary"
            onPress={() => void onCloudPress(id)}
          >
            {id === "gdrive" ? (
              <Image
                alt="Google Drive"
                className="h-[1.55rem] w-[1.55rem] shrink-0 object-contain sm:h-[1.75rem] sm:w-[1.75rem]"
                height={28}
                src="/Google_Drive_icon.svg.png"
                width={28}
              />
            ) : Glyph ? (
              <Glyph
                className={`size-[1.55rem] shrink-0 sm:size-[1.75rem] ${brandClassName}`}
              />
            ) : null}
            <span className="text-center text-base font-semibold leading-snug text-[#EC433F] sm:text-[1.18rem]">
              {label}
            </span>
            {isBusy && activeProvider === id ? (
              <Spinner className="ml-1" color="current" size="sm" />
            ) : null}
          </Button>
        ))}
      </div>

      {status === "error" && error ? (
        <div className="mt-4 rounded-xl border border-danger-300/70 bg-danger-50/70 p-3 text-sm text-danger-700 dark:border-danger-500/50 dark:bg-danger-950/20 dark:text-danger-300">
          <p className="font-medium">{error}</p>
          <Button
            className="mt-2"
            size="sm"
            variant="ghost"
            onPress={clearTransient}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {activeProvider && cloudItems.length > 0 ? (
        <div className="mt-4 rounded-xl border border-default-300/80 bg-white/80 p-3 text-left dark:border-default-600 dark:bg-default-50/10">
          <p className="mb-2 text-sm font-semibold text-default-700 dark:text-default-300">
            Select a file from {formatProviderLabel(activeProvider)}
          </p>
          <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
            {cloudItems.map((item) => (
              <li key={item.id}>
                <Button
                  className="h-auto w-full justify-between rounded-lg border border-default-200 px-3 py-2 text-left dark:border-default-700"
                  variant="ghost"
                  onPress={async () => {
                    selectCloudFile(item);
                    onCloudSelection?.(item);
                    if (onCloudUpload) {
                      try {
                        await onCloudUpload(item);
                        toast.success({
                          title: `${item.name} uploaded`,
                          description: "Cloud file imported successfully.",
                        });
                      } catch (err) {
                        toast.error({
                          title: "Cloud upload failed",
                          description:
                            err instanceof Error ? err.message : undefined,
                        });
                      }
                    } else {
                      toast.success({
                        title: `${item.name} selected`,
                        description: `Selected from ${formatProviderLabel(item.provider)}.`,
                      });
                    }
                  }}
                >
                  <span className="truncate text-sm text-foreground">
                    {item.name}
                  </span>
                  <span className="text-xs text-default-500">
                    {item.mimeType ?? "Unknown type"}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {selected ? (
        <p className="mt-3 text-sm text-default-600 dark:text-default-400">
          Selected from {formatProviderLabel(selected.provider)}:{" "}
          <span className="font-medium text-foreground">{selected.name}</span>.
        </p>
      ) : null}
      {cloudUploadPending ? (
        <p className="mt-3 text-sm text-default-600 dark:text-default-400">
          Uploading selected cloud file to your account...
        </p>
      ) : null}
    </div>
  );
}
