"use client";

import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useId, useMemo, useRef, useState } from "react";

import { uploadAsPdf } from "@/lib/client/file-conversion/upload-to-pdf";
import { useCloudUpload } from "@/lib/client/hooks/upload/use-cloud-upload";
import { findDuplicateByFilename } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { usePdfEditorStore } from "@/lib/client/stores";
import { savePendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

const DEFAULT_ACCEPTED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png",
];
const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB (matches landing hero caption)

type CloudProvider = {
  label: string;
  id: "google-drive" | "dropbox" | "onedrive" | "device";
};

const CLOUD_PROVIDERS: CloudProvider[] = [
  { label: "Upload from device", id: "device" },
  // Hidden — Google Drive / Dropbox / OneDrive flows removed per PM (2026-07).
  // { label: "Upload from Google drive", id: "google-drive" },
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

/**
 * Orange folder-with-upload-arrow illustration for the landing hero
 * variant. Matches `public/landing/Background+Border.png`.
 */
function HeroFolderIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="72"
      viewBox="0 0 84 72"
      width="84"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 12a4 4 0 0 1 4-4h20l6 8h42a4 4 0 0 1 4 4v6H4V12Z"
        fill="#DE472E"
      />
      <rect
        fill="#FFF3EE"
        height="18"
        rx="2"
        stroke="#DE472E"
        strokeWidth="2"
        width="32"
        x="26"
        y="4"
      />
      <path d="M26 4h32v4H26z" fill="#DE472E" />
      <path
        d="M2 24a4 4 0 0 1 4-4h72a4 4 0 0 1 4 4v40a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V24Z"
        fill="#DE472E"
      />
      <path
        d="M42 34v22m0-22-8 8m8-8 8 8"
        stroke="#111315"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
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
interface UploadWorkspaceProps {
  /** Extensions the picker accepts (without leading dot). Defaults to
   *  pdf/doc/docx/jpg/jpeg/png. Per-tool convert routes pass a narrower
   *  set (e.g. `["doc","docx"]` for Word → PDF). */
  acceptExtensions?: string[];
  /** Editor tool slug to auto-launch after the file loads
   *  (e.g. `"password"`, `"compress"`, `"manage"`). */
  tool?: string;
  /** Export format to auto-fire once the file loads in the editor
   *  (e.g. `"docx"` for /convert/pdf-to-word). */
  exportFormat?: string;
  /**
   * Visual layout:
   *  - `"full"` (default): the wide two-tier card with the gray outer
   *    frame, cloud-provider chips, and trust strip. Used on
   *    `/convert/[slug]`.
   *  - `"hero"`: the compact single-card design shown in
   *    `public/landing/Background+Border.png` — dashed border, orange
   *    folder icon, OR divider, red pill button, "Size upto 100 MB"
   *    caption. No cloud chips, no trust strip. Used on `/`.
   */
  variant?: "full" | "hero";
}

export function UploadWorkspace({
  acceptExtensions,
  exportFormat,
  tool,
  variant = "full",
}: UploadWorkspaceProps = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const errorId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const setEditorFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);
  // Only convert-TO-pdf routes (Word/PNG/JPG/Excel/PowerPoint/TXT → PDF)
  // require sign-in at upload time — those upload a non-PDF and expect a
  // PDF back from the backend conversion pipeline, which needs auth.
  //
  // Convert-FROM-pdf routes (PDF → DOCX/XLSX/PPTX/JPG/PNG/HTML/TXT) use
  // the same signed-out flow as `/pdf-composer`: the visitor drops a PDF,
  // the editor opens, and the sign-in prompt + paywall trip at Download
  // time via `useExportEditor`. The signal for that family is the
  // presence of `exportFormat` on the route props.
  const requiresAuth = useMemo(
    () => Boolean(pathname?.startsWith("/convert/")) && !exportFormat,
    [exportFormat, pathname],
  );

  const acceptedExtensions = useMemo(
    () => acceptExtensions ?? DEFAULT_ACCEPTED_EXTENSIONS,
    [acceptExtensions],
  );
  const acceptAttr = useMemo(
    () => acceptedExtensions.map((ext) => `.${ext}`).join(","),
    [acceptedExtensions],
  );

  // Build the /pdf-composer URL for a given saved-document id. When we
  // have an id, the editor loads the persisted bytes from the backend
  // via `?id=<docId>`, and future Save actions overwrite that same row
  // instead of creating a duplicate. When we don't (signed-out anon
  // flow), the editor falls back to the in-memory file set on the
  // Zustand store.
  const buildComposerHref = useCallback(
    (documentId: string | null) => {
      const query = new URLSearchParams();

      if (documentId) query.set("id", documentId);
      if (tool) query.set("tool", tool);
      if (exportFormat) query.set("export", exportFormat);
      const q = query.toString();

      return q ? `${ROUTES.TOOLS.PDF_EDITOR}?${q}` : ROUTES.TOOLS.PDF_EDITOR;
    },
    [tool, exportFormat],
  );

  const openFileInEditor = useCallback(
    async (picked: File) => {
      // Convert routes require sign-in for the backend conversion call.
      // Redirect BEFORE we spend time on the client-side PDF conversion.
      if (requiresAuth && authLoaded && !isSignedIn) {
        const returnPath = pathname ?? ROUTES.PUBLIC.HOME;
        const redirect = encodeURIComponent(returnPath);

        toast.info({
          title: "Sign in to convert",
          description:
            "Sign in and you'll come right back to this page to finish.",
        });
        router.push(`${ROUTES.AUTH.SIGN_IN}?redirect_url=${redirect}`);

        return;
      }

      setOpening(true);
      const loadingKey =
        picked.type === "application/pdf"
          ? null
          : toast.loading({
              description: `Preparing ${picked.name} for the editor.`,
              title: "Converting to PDF",
            });

      try {
        const pdfFile = await uploadAsPdf(picked);

        // Save-first-then-open (signed-in users only). The QA-expected
        // flow: file lands in `/documents/upload` BEFORE the editor
        // opens so the document row exists in "My PDFs" from the moment
        // the user starts editing. Signed-out users skip this step —
        // /pdf-composer runs entirely in-memory for anon visitors.
        let savedDoc: { id: string; name: string } | null = null;

        if (authLoaded && isSignedIn) {
          // Duplicate-name check: refuse to create a second document row
          // with the same filename. Opens the file for local editing so
          // the user isn't blocked; the visible toast tells them why we
          // didn't save.
          let existingDocId: string | null = null;

          try {
            const existing = await findDuplicateByFilename(pdfFile.name);

            if (existing) existingDocId = existing.id;
          } catch (dupErr) {
            logger.warn("duplicate-name check failed", dupErr);
          }

          if (existingDocId) {
            toast.info({
              title: "File already in My PDFs",
              description: `Opening the existing copy of "${pdfFile.name}".`,
            });
            // Skip re-upload; navigate straight to the existing doc.
            savedDoc = { id: existingDocId, name: pdfFile.name };
          } else {
            if (loadingKey) toast.close(loadingKey);
            const savingKey = toast.loading({
              title: "Saving to My PDFs",
              description: pdfFile.name,
            });

            try {
              const document = await documentsService.uploadDocument({
                file: pdfFile,
              });

              savedDoc = { id: document.id, name: document.filename };
              toast.success({
                title: "Saved to My PDFs",
                description: document.filename,
              });
            } catch (saveErr) {
              logger.warn("save-before-open failed", saveErr);
              toast.error({
                title: "Couldn't save to My PDFs",
                description:
                  "Your file will open locally — use Save from the editor to persist.",
              });
            } finally {
              toast.close(savingKey);
            }
          }
        }

        setCurrentDocument(savedDoc);
        setEditorFile(pdfFile);

        // Signed-out convert-FROM-pdf flow (e.g. /convert/pdf-to-word):
        // the router.push carries `?export=<fmt>` which triggers the
        // hydrator's Step 1 `clearFile()` on the next mount. Mirror the
        // file into IDB first so the hydrator's Step 2 can rehydrate it
        // for the auto-export → sign-in-modal → paywall chain.
        if (exportFormat && authLoaded && !isSignedIn) {
          try {
            await savePendingEditorFile(pdfFile);
          } catch (idbErr) {
            logger.warn("pending editor file save failed", idbErr);
          }
        }

        // Signed-in flow: navigate with `?id=<docId>` so the editor
        // hydrates from the persisted document row (see proxy.ts —
        // `?id=` also requires auth). Signed-out flow: no id, the
        // editor renders the in-memory file from the store (plus the
        // IDB mirror above for convert-FROM-pdf routes).
        router.push(buildComposerHref(savedDoc?.id ?? null));
      } catch (err) {
        logger.error("Landing upload → open failed", err);
        toast.error({
          title: "Couldn't open file",
          description: err instanceof Error ? err.message : undefined,
        });
        setOpening(false);
      } finally {
        if (loadingKey) toast.close(loadingKey);
      }
    },
    [
      authLoaded,
      buildComposerHref,
      exportFormat,
      isSignedIn,
      pathname,
      requiresAuth,
      router,
      setCurrentDocument,
      setEditorFile,
    ],
  );

  const validateAndSet = (candidate: File) => {
    const ext = getExtension(candidate.name);

    if (!acceptedExtensions.includes(ext)) {
      const label = acceptedExtensions.map((e) => e.toUpperCase()).join(", ");

      setError(
        `"${candidate.name}" isn't a supported type here. Use ${label}.`,
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
    void openFileInEditor(candidate);
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

  if (variant === "hero") {
    return (
      <div className="mx-auto w-full max-w-[820px]">
        <div className="rounded-[24px] border border-black/5 bg-white p-[14px] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div
            aria-describedby={error ? errorId : undefined}
            aria-label="Upload a file. Drop a file here, or activate to browse."
            className="relative flex cursor-pointer flex-col items-center justify-center rounded-[16px] px-6 py-14 text-center outline-none sm:py-16"
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
              accept={acceptAttr}
              className="sr-only"
              type="file"
              onChange={onInputChange}
            />

            {file ? (
              <div className="flex flex-col items-center">
                <HeroFolderIcon />
                <p className="mt-6 text-[18px] font-semibold text-[#121212]">
                  {file.name}
                </p>
                <p className="mt-1 text-[14px] text-[#818285]">
                  {formatSize(file.size)}
                </p>
                {opening ? (
                  <p className="mt-4 text-[14px] font-medium text-[var(--pv-brand-primary)]">
                    Opening editor…
                  </p>
                ) : (
                  <button
                    className="pv-btn-secondary mt-4 cursor-pointer px-4 py-1.5 text-[14px]"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setFile(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                  >
                    Remove file
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <HeroFolderIcon />
                <h2 className="mt-6 text-[22px] font-semibold leading-[28px] text-[#121212] sm:text-[24px] sm:leading-[30px]">
                  Drag &amp; drop file to edit
                </h2>

                <div className="mt-6 flex w-full max-w-[360px] items-center gap-3 text-[13px] font-medium uppercase tracking-[0.08em] text-[#B4B4B4]">
                  <span aria-hidden className="h-px flex-1 bg-[#E5E5E5]" />
                  <span>OR</span>
                  <span aria-hidden className="h-px flex-1 bg-[#E5E5E5]" />
                </div>

                <button
                  className="mt-6 inline-flex h-11 min-w-[184px] cursor-pointer items-center justify-center rounded-full bg-[#de472e] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#c73f28] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#de472e]"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openPicker();
                  }}
                >
                  Upload to Edit
                </button>

                <p className="mt-5 text-[14px] text-[#8A8A8A]">
                  Size upto 100 MB
                </p>
              </div>
            )}

            <p
              aria-live="polite"
              className={`mt-4 text-[14px] ${error ? "text-[var(--pv-error)]" : "sr-only"}`}
              id={errorId}
              role={error ? "alert" : undefined}
            >
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

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
              accept={acceptAttr}
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
                {opening ? (
                  <p className="mt-4 text-[14px] font-medium text-[var(--pv-brand-primary)]">
                    Opening editor…
                  </p>
                ) : (
                  <button
                    className="pv-btn-secondary mt-4 cursor-pointer px-4 py-1.5 text-[14px]"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setFile(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                  >
                    Remove file
                  </button>
                )}
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
                  Supports{" "}
                  {acceptedExtensions.map((e) => e.toUpperCase()).join(", ")}
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

          {/* Cloud provider capsules — layout adapts to the number of visible
              options so the buttons split evenly. */}
          <div
            className={`mt-[10px] grid grid-cols-1 gap-[10px] ${
              CLOUD_PROVIDERS.length === 1
                ? "sm:grid-cols-1"
                : CLOUD_PROVIDERS.length === 2
                  ? "sm:grid-cols-2"
                  : "sm:grid-cols-3"
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
