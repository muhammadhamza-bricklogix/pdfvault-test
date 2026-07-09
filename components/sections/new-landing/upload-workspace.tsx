"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";

import { useCloudUpload } from "@/lib/client/hooks/upload/use-cloud-upload";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

const ACCEPTED_EXTENSIONS = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
const ACCEPT_ATTR = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

type CloudProvider = {
  label: string;
  id: "google-drive" | "dropbox" | "onedrive" | "device";
};

const CLOUD_PROVIDERS: CloudProvider[] = [
  { label: "Upload from Google drive", id: "google-drive" },
  { label: "Upload from device", id: "device" },
  // Hidden for now — Dropbox and OneDrive flows are not wired up.
  // { label: "Upload from Dropbox", id: "dropbox" },
  // { label: "Upload from one drive", id: "onedrive" },
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

/**
 * Persist the picked cloud file's identity so the dashboard can pick up the
 * flow after Clerk bounces a signed-out user through sign-in. Kept out of the
 * component body so `react-hooks/purity` doesn't flag the sessionStorage
 * write as an in-render side effect.
 */
function stashPendingCloudUpload(payload: object): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      "pdfvault:pendingUpload",
      JSON.stringify(payload),
    );
  } catch {
    // sessionStorage can throw in private mode — ignore.
  }
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
      <circle
        cx="10"
        cy="10"
        r="8.25"
        stroke="currentColor"
        strokeWidth="1.4"
      />
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

/**
 * Long, soft dashed outline for the drop zone, drawn as an SVG rect so the dash
 * rhythm matches the design (≈10px dash / 8px gap, 1px #CCC) instead of the
 * browser-default tiny dots. `non-scaling-stroke` keeps the dashes uniform at
 * any size; rx/ry are tuned so the corner reads ≈13px at the desktop width.
 */
function DashedBorder({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      fill="none"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <rect
        height="99"
        rx="1.1"
        ry="2.7"
        stroke={active ? "var(--pv-brand-primary)" : "#CCCCCC"}
        strokeDasharray="10 8"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        width="99"
        x="0.5"
        y="0.5"
      />
    </svg>
  );
}

function ProviderBadge({ id }: { id: CloudProvider["id"] }) {
  if (id === "google-drive") {
    return (
      <svg aria-hidden height="20" viewBox="0 0 87.3 78" width="20">
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
      <span className="flex size-[22px] items-center justify-center rounded-full bg-[#0061fe]">
        <svg aria-hidden height="12" viewBox="0 0 43 40" width="12">
          <path
            d="M12.6 0L0 8.1l8.7 7 12.8-7.9zM0 22.2l12.6 8.2 8.9-7.4-12.8-7.9zm21.5 0.8l8.9 7.4L43 22.2l-8.7-7zM43 8.1L30.4 0l-8.9 7.2 12.8 7.9zM21.5 24.4l-8.9 7.4-3.8-2.5v2.8l12.7 7.6 12.7-7.6v-2.8l-3.8 2.5z"
            fill="#ffffff"
          />
        </svg>
      </span>
    );
  }
  if (id === "device") {
    return (
      <svg
        aria-hidden
        fill="none"
        height="18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
        viewBox="0 0 24 24"
        width="18"
      >
        <path d="M12 15V3" />
        <path d="M7 8l5-5 5 5" />
        <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
      </svg>
    );
  }

  return (
    <svg aria-hidden height="16" viewBox="0 0 32 20" width="24">
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

/**
 * Optional "next step" surfaced under the drop zone once a valid file exists.
 * Convert routes use this to add a "Convert now" CTA that hands off to the
 * auth-gated dashboard where the actual conversion runs. Home leaves it unset
 * so the workspace stays open-ended.
 */
interface UploadAction {
  label: string;
  href: string;
  contextKey?: string;
}

interface UploadWorkspaceProps {
  action?: UploadAction;
}

export function UploadWorkspace({ action }: UploadWorkspaceProps = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const errorId = useId();
  const router = useRouter();

  const onSubmitAction = () => {
    if (!action || !file) return;
    setSubmitting(true);
    // Stash the pending upload's identity so the destination screen can greet
    // the user with "Continue converting X.pdf" instead of a cold start. The
    // File blob itself doesn't cross route boundaries — the user re-picks it
    // in the dashboard, which is fine because sign-in happens in between.
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          "pdfvault:pendingUpload",
          JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            context: action.contextKey ?? null,
            ts: Date.now(),
          }),
        );
      } catch {
        // sessionStorage can throw in private mode — ignore, the flow still works.
      }
    }
    router.push(action.href);
  };

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

  const cloudUpload = useCloudUpload();
  const cloudUploadStart = cloudUpload.start;

  // Kicks off the OAuth popup + Google Picker via `useCloudUpload`.
  // On success the picker returns a `CloudBrowserItem` (fileId +
  // accessToken); we stash it in sessionStorage under the same key the
  // dashboard's `PendingConversionBanner` reads and push the user to
  // /dashboard. Clerk middleware bounces signed-out users to sign-in
  // first, then the dashboard picks up the marker post-signin and
  // completes the actual upload against the backend.
  const onCloudProviderClick = useCallback(
    async (id: CloudProvider["id"]) => {
      if (id === "device") {
        openPicker();

        return;
      }

      if (id !== "google-drive") return;

      try {
        const picked = await cloudUploadStart("gdrive");

        logger.debug("[gdrive] picker returned", {
          count: picked.length,
          firstName: picked[0]?.name,
        });

        if (picked.length === 0) return; // user cancelled the picker

        const first = picked[0];

        stashPendingCloudUpload({
          fileName: first.name,
          fileSize: first.size ?? 0,
          context: "gdrive",
          provider: "gdrive",
          fileId: first.id,
          mimeType: first.mimeType,
          accessToken: first.accessToken,
          ts: Date.now(),
        });
        logger.debug("[gdrive] stashed → /dashboard");
        toast.success({
          title: `${first.name} selected`,
          description: "Sign in to finish importing from Google Drive.",
        });
        router.push("/dashboard");
      } catch (err) {
        toast.error({
          title: "Google Drive upload failed",
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [cloudUploadStart, router],
  );

  const onZoneKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1223px]">
      {/* Soft-gray outer frame */}
      <div className="flex min-h-[600px] flex-col rounded-[24px] bg-[#f5f5f5] p-[18px]">
        {/* White inner surface holds the drop zone + provider capsules */}
        <div className="flex flex-1 flex-col rounded-[20px] bg-white p-3">
          {/* Dashed drop zone */}
          <div
            aria-describedby={error ? errorId : undefined}
            aria-label="Upload a file. Drop a file here, or activate to browse."
            className="relative flex flex-1 cursor-pointer flex-col items-center justify-center rounded-[13px] px-6 py-8 text-center outline-none"
            role="button"
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
            <DashedBorder active={dragActive} />
            <input
              ref={inputRef}
              accept={ACCEPT_ATTR}
              className="sr-only"
              type="file"
              onChange={onInputChange}
            />

            {file ? (
              <div className="flex flex-col items-center">
                <Image
                  alt=""
                  className="h-auto w-[180px] object-contain"
                  height={154}
                  src="/landing/upload-image.png"
                  width={180}
                />
                <p className="mt-6 text-[18px] font-semibold text-[var(--pv-text-primary)]">
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
              <div className="flex flex-col items-center">
                <Image
                  priority
                  alt=""
                  className="h-auto w-[180px] object-contain"
                  height={154}
                  src="/landing/upload-image.png"
                  width={180}
                />
                <h2 className="mt-[52px] text-[24px] font-semibold leading-[30px] text-[#111315]">
                  Drop your file here to get started
                </h2>
                <p className="mt-2.5 text-[18px] leading-6 text-[#818285]">
                  Upload a PDF or import from your cloud storage.
                </p>
                <p className="mt-3 text-[15px] font-medium leading-5 text-[#818285]">
                  Supports PDF, DOC, DOCX, JPG, PNG
                </p>
                <button
                  className="mt-7 inline-flex h-11 w-[188px] cursor-pointer items-center justify-center rounded-full bg-[#de472e] text-[16px] font-semibold text-white transition-colors hover:bg-[#c73f28] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#de472e]"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openPicker();
                  }}
                >
                  Choose File
                </button>
              </div>
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

          {/* Post-upload CTA — only rendered when the caller passes `action`
              (currently the /convert/[slug] routes). Disabled until a valid
              file is selected so the "next step" affordance stays honest. */}
          {action ? (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-[12px] border border-[var(--pv-card-border)] bg-white px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[var(--pv-text-primary)]">
                  {file ? file.name : "Upload a file to continue"}
                </p>
                <p className="text-[13px] text-[var(--pv-text-secondary)]">
                  {file
                    ? "Sign in to run the conversion — takes just a moment."
                    : "Drop or choose a file above, then hit Convert."}
                </p>
              </div>
              <button
                aria-disabled={!file || submitting}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[var(--pv-brand-primary)] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--pv-brand-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-900)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!file || submitting}
                type="button"
                onClick={onSubmitAction}
              >
                {submitting ? "Opening…" : action.label}
              </button>
            </div>
          ) : null}

          {/* Cloud provider capsules — layout adapts to the number of visible
              options so the buttons split evenly. */}
          <div
            className={`mt-[10px] grid grid-cols-1 gap-[10px] ${
              CLOUD_PROVIDERS.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"
            }`}
          >
            {CLOUD_PROVIDERS.map((provider) => {
              const isBusy =
                provider.id === "google-drive" &&
                cloudUpload.isBusy &&
                cloudUpload.activeProvider === "gdrive";

              return (
                <button
                  key={provider.id}
                  className="flex h-[45px] cursor-pointer items-center justify-center gap-3 rounded-[12px] bg-[#f5f5f5] text-[14px] font-medium text-[var(--pv-text-primary)] transition-colors hover:bg-[#ececec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-brand-900)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy}
                  type="button"
                  onClick={() => void onCloudProviderClick(provider.id)}
                >
                  {isBusy ? "Opening…" : provider.label}
                  <ProviderBadge id={provider.id} />
                </button>
              );
            })}
          </div>
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
