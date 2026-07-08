"use client";

import type { ReactNode } from "react";

import { Upload04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { useUploadWithDuplicateCheck } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { ROUTES } from "@/lib/shared/constants/routes";

import { DuplicateUploadModal } from "./duplicate-upload-modal";

interface PvPageHeaderProps {
  title: string;
  subtitle: string;
  action?: ReactNode;
}

/**
 * Dashboard page header — title + subtitle on the left, action slot on the
 * right (usually <UploadPdfButton />).
 */
export function PvPageHeader({ title, subtitle, action }: PvPageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h1 className="pv-heading text-[26px] font-semibold leading-tight text-[var(--pv-text-strong)] sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-1 text-[15px] text-[var(--pv-text-body)]">
          {subtitle}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/**
 * Self-contained upload button that opens the OS file picker, runs the
 * shared duplicate-check flow, and routes the user into the editor on
 * success — exactly the wiring the previous `UploadCta` used, restyled
 * to the new PDFVault brand-red pill.
 */
export function UploadPdfButton() {
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
      <button
        className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-[var(--pv-brand-red)] px-5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--pv-brand-red-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-red)] focus-visible:ring-offset-2"
        type="button"
        onClick={onPick}
      >
        <HugeiconsIcon icon={Upload04Icon} size={18} />
        Upload PDF
      </button>
      <DuplicateUploadModal
        filename={duplicate?.filename ?? null}
        onIgnore={duplicate?.onIgnore ?? (() => undefined)}
        onOverwrite={duplicate?.onOverwrite ?? (() => undefined)}
      />
    </>
  );
}
