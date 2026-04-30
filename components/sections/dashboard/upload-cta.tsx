"use client";

import { Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { useTrackedUpload } from "@/lib/client/hooks/upload/use-tracked-upload";
import { ROUTES } from "@/lib/shared/constants/routes";

export function UploadCta() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { start } = useTrackedUpload();

  const onPick = () => inputRef.current?.click();

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    e.target.value = "";
    if (!file) return;

    start({
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
      <Button onPress={onPick}>
        <HugeiconsIcon icon={Upload01Icon} size={16} />
        Upload PDF
      </Button>
    </>
  );
}
