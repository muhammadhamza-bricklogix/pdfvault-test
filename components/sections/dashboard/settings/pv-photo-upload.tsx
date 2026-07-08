"use client";

import { CloudUploadIcon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState } from "react";

interface PvPhotoUploadProps {
  currentUrl?: string | null;
  onFileSelected: (file: File) => void | Promise<void>;
  accept?: string;
  maxDimensionLabel?: string;
}

/**
 * Two-part control: round avatar preview (left) + purple dashed dropzone
 * (right). Matches Frame 2043684300. Click to pick, drag-and-drop, and
 * keyboard-activate all funnel into the same `onFileSelected` callback so
 * the caller can hand the File to `user.setProfileImage({ file })`.
 */
export function PvPhotoUpload({
  currentUrl,
  onFileSelected,
  accept = "image/svg+xml,image/png,image/jpeg,image/gif",
  maxDimensionLabel = "SVG, PNG, JPG or GIF (max. 800×400px)",
}: PvPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    void onFileSelected(file);
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="flex items-center gap-5">
      <span className="shrink-0">
        {currentUrl ? (
          // Dynamic Clerk profile URL — <img> is intentional.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="size-14 rounded-full object-cover"
            src={currentUrl}
          />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-full bg-[var(--pv-tile)] text-[var(--pv-text-muted)]">
            <HugeiconsIcon icon={UserCircleIcon} size={36} />
          </span>
        )}
      </span>

      <div
        aria-label="Upload profile photo"
        className={`relative flex flex-1 cursor-pointer items-center gap-4 rounded-[12px] border-2 border-dashed px-4 py-4 text-center transition-colors ${
          dragActive
            ? "border-[#7F56D9] bg-[#7F56D9]/5"
            : "border-[#7F56D9]/70 bg-[var(--pv-surface)]"
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F56D9]`}
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onDragLeave={() => setDragActive(false)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
      >
        <input
          ref={inputRef}
          accept={accept}
          className="sr-only"
          type="file"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--pv-hairline)] bg-[var(--pv-surface)] text-[var(--pv-text-body)] shadow-sm">
          <HugeiconsIcon icon={CloudUploadIcon} size={18} />
        </span>

        <div className="flex-1 text-left">
          <p className="text-[13px] leading-tight">
            <span className="font-semibold text-[#7F56D9]">
              Click to upload
            </span>{" "}
            <span className="text-[var(--pv-text-body)]">or drag and drop</span>
          </p>
          <p className="mt-1 text-[12px] text-[var(--pv-text-muted)]">
            {maxDimensionLabel}
          </p>
        </div>

        <span className="relative">
          <span className="flex size-9 items-center justify-center rounded-[6px] bg-white shadow-sm">
            <svg
              aria-hidden
              fill="none"
              height="20"
              stroke="var(--pv-text-muted)"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 20 20"
              width="20"
            >
              <path d="M4 3h7l4 4v10H4V3z" />
              <path d="M11 3v4h4" />
            </svg>
          </span>
          <span className="absolute -bottom-1 -right-1 rounded-[3px] bg-[#7F56D9] px-1 text-[8px] font-bold uppercase text-white">
            JPG
          </span>
        </span>
      </div>
    </div>
  );
}
