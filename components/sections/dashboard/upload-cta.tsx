"use client";

import { Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { useUploadWithDuplicateCheck } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { ROUTES } from "@/lib/shared/constants/routes";

import { DuplicateUploadModal } from "./duplicate-upload-modal";

export function UploadCta() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { duplicate, start } = useUploadWithDuplicateCheck();

  const onPick = () => inputRef.current?.click();

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    e.target.value = "";
    if (!file) return;

    void start({
      file,
      onOpen: (id) => router.push(`${ROUTES.TOOLS.PDF_EDITOR}?id=${id}`),
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        accept="application/pdf"
        className="hidden"
        type="file"
        onChange={onChange}
      />
      <Button className="flex-1 sm:flex-none" onPress={onPick}>
        <HugeiconsIcon icon={Upload01Icon} size={16} />
        <span className="truncate">Upload PDF</span>
      </Button>
      <DuplicateUploadModal
        filename={duplicate?.filename ?? null}
        onIgnore={duplicate?.onIgnore ?? (() => undefined)}
        onOverwrite={duplicate?.onOverwrite ?? (() => undefined)}
      />
    </>
  );
}
