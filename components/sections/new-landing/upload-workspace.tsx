"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";

const ACCEPTED_EXTENSIONS = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
const ACCEPT_ATTR = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

type CloudProvider = {
  label: string;
  id: "google-drive" | "dropbox" | "onedrive";
};

const CLOUD_PROVIDERS: CloudProvider[] = [
  { label: "Upload from Google drive", id: "google-drive" },
  { label: "Upload from Dropbox", id: "dropbox" },
  { label: "Upload from one drive", id: "onedrive" },
];

const TRUST_ITEMS = [
  "Secure document storage",
  "Edit in your browser",
  "Personal file library",
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function CheckCircleIcon() {
  return (
    <svg
      aria-hidden
      className="shrink-0 text-[var(--pv-text-primary)]"
      fill="none"
      height="20"
      viewBox="0 0 20 20"
      width="20"
    >
      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.5 10.2l2.3 2.3 4.7-4.9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function ProviderIcon({ id }: { id: CloudProvider["id"] }) {
  if (id === "google-drive") {
    return (
      <svg aria-hidden height="16" viewBox="0 0 87.3 78" width="16">
        <path
          d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z"
          fill="#0066da"
        />
        <path
          d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5C.4 49.9 0 51.45 0 53h27.5z"
          fill="#00ac47"
        />
        <path
          d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.3c.8-1.4 1.2-2.95 1.2-4.5H59.798l5.852 11.5z"
          fill="#ea4335"
        />
        <path
          d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z"
          fill="#00832d"
        />
        <path
          d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
          fill="#2684fc"
        />
        <path
          d="M73.4 26.5L60.75 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z"
          fill="#ffba00"
        />
      </svg>
    );
  }
  if (id === "dropbox") {
    return (
      <svg aria-hidden height="16" viewBox="0 0 43 40" width="16">
        <path
          d="M12.6 0L0 8.1l8.7 7 12.8-7.9zM0 22.2l12.6 8.2 8.9-7.4-12.8-7.9zm21.5 0.8l8.9 7.4L43 22.2l-8.7-7zM43 8.1L30.4 0l-8.9 7.2 12.8 7.9zM21.5 24.4l-8.9 7.4-3.8-2.5v2.8l12.7 7.6 12.7-7.6v-2.8l-3.8 2.5z"
          fill="#0061fe"
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden height="16" viewBox="0 0 32 20" width="16">
      <path
        d="M19.4 7.3a6.6 6.6 0 00-12 1.6A5.1 5.1 0 005 19h18.5a4.6 4.6 0 00.8-9.1 5.6 5.6 0 00-4.9-2.6z"
        fill="#0364b8"
      />
      <path
        d="M12.9 8.9a5.1 5.1 0 00-7.9 10h18.5a4.6 4.6 0 00.8-9.1 6.6 6.6 0 00-11.4-.9z"
        fill="#0078d4"
      />
    </svg>
  );
}

export function UploadWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const validateAndSet = (candidate: File) => {
    const ext = getExtension(candidate.name);
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(
        `"${candidate.name}" isn't a supported type. Use PDF, DOC, DOCX, JPG, or PNG.`,
      );
      setFile(null);
      return;
    }
    if (candidate.size > MAX_SIZE_BYTES) {
      setError(
        `"${candidate.name}" is too large. The maximum size is ${formatSize(MAX_SIZE_BYTES)}.`,
      );
      setFile(null);
      return;
    }
    setError(null);
    setFile(candidate);
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) validateAndSet(selected);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) validateAndSet(dropped);
  };

  const openPicker = () => inputRef.current?.click();

  const onZoneKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      {/* Outer pale-gray frame */}
      <div
        className="rounded-[22px] bg-[var(--pv-gray-1)] p-4 sm:p-5"
        style={{ border: "1px solid var(--pv-gray-3)" }}
      >
        {/* White dashed drop zone */}
        <div
          aria-describedby={error ? errorId : undefined}
          aria-label="Upload a file. Drop a file here, or activate to browse."
          className={`flex flex-col items-center rounded-[16px] bg-white px-6 py-16 text-center transition-colors sm:py-24 ${
            dragActive ? "bg-[var(--pv-gray-1)]" : ""
          }`}
          role="button"
          style={{
            border: `1.5px dashed ${dragActive ? "var(--pv-brand-primary)" : "var(--pv-gray-5)"}`,
          }}
          tabIndex={0}
          onClick={openPicker}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDrop={onDrop}
          onKeyDown={onZoneKeyDown}
        >
          <input
            ref={inputRef}
            accept={ACCEPT_ATTR}
            className="sr-only"
            type="file"
            onChange={onInputChange}
          />

          <Image
            alt=""
            className="h-auto w-[132px] object-contain"
            height={132}
            src="/landing/upload-image.png"
            width={165}
          />

          {file ? (
            <div className="mt-8 flex flex-col items-center">
              <p className="text-[18px] font-semibold text-[var(--pv-text-primary)]">
                {file.name}
              </p>
              <p className="mt-1 text-[14px] text-[var(--pv-text-secondary)]">
                {formatSize(file.size)}
              </p>
              <button
                className="pv-btn-secondary mt-4 px-4 py-1.5 text-[14px]"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Remove file
              </button>
            </div>
          ) : (
            <>
              <h2 className="mt-8 text-[20px] font-semibold leading-snug text-[var(--pv-text-primary)] sm:text-[22px]">
                Ready to sign, edit or get creative?
                <br />
                Drop your file here to get started
              </h2>
              <p className="mt-4 max-w-[420px] text-[14px] text-[var(--pv-text-secondary)]">
                Upload a PDF or import from your cloud storage. Supports PDF,
                DOC, DOCX, JPG, PNG
              </p>
              <button
                className="pv-btn-primary mt-8 px-7 py-2.5 text-[15px]"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openPicker();
                }}
              >
                Choose File
              </button>
            </>
          )}

          {/* Accessible status / error live region */}
          <p
            aria-live="polite"
            className={`mt-4 text-[14px] ${error ? "text-[var(--pv-error)]" : "sr-only"}`}
            id={errorId}
            role={error ? "alert" : undefined}
          >
            {error}
          </p>
        </div>

        {/* Cloud provider buttons */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CLOUD_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--pv-gray-2)] px-4 py-3.5 text-[14px] font-medium text-[var(--pv-text-primary)] transition-colors hover:bg-[var(--pv-gray-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-900)]"
              type="button"
              // TODO: wire to cloud-import integrations when available.
              onClick={() => undefined}
            >
              {provider.label}
              <ProviderIcon id={provider.id} />
            </button>
          ))}
        </div>
      </div>

      {/* Trust strip */}
      <ul className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-10">
        {TRUST_ITEMS.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 text-[15px] text-[var(--pv-text-primary)]"
          >
            <CheckCircleIcon />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
