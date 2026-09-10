"use client";

import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Script from "next/script";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { DuplicateUploadModal } from "@/components/sections/dashboard/duplicate-upload-modal";
import { dispatchAuthModal } from "@/components/shared/auth-modal";
import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import {
  isPdf,
  looksLikePdfBytes,
  uploadAsPdf,
} from "@/lib/client/file-conversion/upload-to-pdf";
import { useCloudUpload } from "@/lib/client/hooks/upload/use-cloud-upload";
import { findDuplicateByFilename } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { usePdfEditorStore } from "@/lib/client/stores";
import { usePendingConversionsStore } from "@/lib/client/stores/pending-conversions-store";
import { runPendingConversion } from "@/lib/client/upload/run-pending-conversion";
import {
  clearPendingEditorFile,
  loadPendingEditorFile,
  savePendingEditorFile,
} from "@/lib/client/upload/pending-editor-file";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { ROUTES } from "@/lib/shared/constants/routes";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

import { TrustpilotWidget } from "./trustpilot-widget";

// Sync import (was dynamic before — reverted 2026-08-31 after QA
// reported the modal never rendered on /convert/* drops when the
// user hit the check faster than the chunk finished loading).
// The size hit is fractional; correctness > perf here.

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

/**
 * Long, soft dashed outline for the drop zone, drawn as an SVG rect so the dash
 * rhythm matches the design (≈10px dash / 8px gap, 1px #CCC) instead of the
 * browser-default tiny dots. `non-scaling-stroke` keeps the dashes uniform at
 * any size; rx/ry are tuned so the corner reads ≈13px at the desktop width.
 */
function DashedBorder({
  active,
  color = "#CCCCCC",
}: {
  active: boolean;
  /** Idle-state stroke color. Active state always uses the brand red. */
  color?: string;
}) {
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
        stroke={active ? "var(--pv-brand-primary)" : color}
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
 * variant. Sourced from `public/landing/Group.png` (matches the
 * `Background+Border.png` reference used to spec the hero).
 */
function HeroFolderIcon() {
  return (
    <Image
      priority
      alt=""
      className="h-auto w-[84px] object-contain"
      height={72}
      src="/landing/Group.png"
      width={84}
    />
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
  // Holds a File dropped before Clerk hydrated. `openFileInEditor`
  // stashes here + returns early when `authLoaded === false`, and the
  // effect below re-fires the drop once Clerk finishes loading. Two
  // classes of bug this guards against:
  //   1. Convert routes: a fast drop on a slow network slips past both
  //      the sign-in and paywall gates and silently kicks off a backend
  //      conversion for a signed-out visitor.
  //   2. Tool landing routes (e.g. `/password-protect-pdf`): the
  //      cross-route duplicate-name check at line ~376 is gated on
  //      `authLoaded && isSignedIn`. If a signed-in user picks a file
  //      before Clerk hydrates, the check gets skipped and the
  //      Overwrite/Ignore modal never appears — user then creates a
  //      second library row with the same filename (QA 2026-09-10).
  const pendingDropRef = useRef<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  // Duplicate-name modal state for the X→PDF convert branch. PDF→X
  // already handles duplicates with a toast + open-existing path; this
  // one uses the Cancel/Overwrite modal because the backend conversion
  // is destructive if we let it silently create a second row (QA
  // 2026-08-28: `report.docx` dropped with existing `report.pdf`
  // produced two rows named `report.pdf`).
  const [convertDuplicate, setConvertDuplicate] = useState<{
    /** Original picked file to hand to `runPendingConversion`. */
    file: File;
    /** Filename of the existing library doc that matches. */
    filename: string;
    /** Existing doc id — forwarded as `documentId` on Overwrite so the
     *  backend upserts instead of inserting. */
    existingDocId: string;
    /** Placeholder identity for the dashboard row while the background
     *  upload runs — matches the tempId we'd use in the no-duplicate
     *  path. Recomputed here to keep the two flows structurally
     *  identical. */
    tempId: string;
  } | null>(null);
  const errorId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const setEditorFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);
  // Only convert-TO-pdf routes (Word/PNG/JPG/TXT → PDF; Excel + PowerPoint hidden 2026-08-28)
  // Per the 2026-07-20 flow spec, every `/convert/*` route (both X→PDF
  // and PDF→X) sits under "Flow 1 — Convert file": Land → Sign-in →
  // Conversion → Payment → Download. So the sign-in gate fires at
  // upload time regardless of direction; guests never see the composer
  // preview for convert routes. The composer preview flow (Flow 2) is
  // reserved for `/pdf-composer` uploads.
  const requiresAuth = useMemo(
    () => Boolean(pathname?.startsWith("/convert/")),
    [pathname],
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
    (documentId: string | null, opts?: { skipExport?: boolean }) => {
      const query = new URLSearchParams();

      if (documentId) query.set("id", documentId);
      if (tool) query.set("tool", tool);
      if (exportFormat && !opts?.skipExport) query.set("export", exportFormat);
      const q = query.toString();

      return q ? `${ROUTES.TOOLS.PDF_EDITOR}?${q}` : ROUTES.TOOLS.PDF_EDITOR;
    },
    [tool, exportFormat],
  );

  const openFileInEditor = useCallback(
    async (picked: File) => {
      // Auth still hydrating — defer on EVERY route (not just
      // `/convert/*`). The effect below re-fires the drop once
      // `authLoaded` flips true. Rationale on non-convert routes: the
      // duplicate-name check at the top of this function is gated on
      // `authLoaded && isSignedIn` — a signed-in user who picks a file
      // before Clerk hydrates would silently bypass that check and end
      // up with a second library row + no Overwrite/Ignore modal (QA
      // 2026-09-10 report on `/password-protect-pdf`). On convert
      // routes this also prevents the sign-in + paywall gates from
      // being skipped for a signed-out visitor.
      if (!authLoaded) {
        logger.breadcrumb("upload", "drop.deferred_pre_auth", {
          filename: picked.name,
          size: picked.size,
        });
        pendingDropRef.current = picked;

        return;
      }
      // Cross-route duplicate-name pre-check for signed-in users.
      // Fires BEFORE any conversion / sign-in / paywall branching
      // so we never silently attach a file whose target filename
      // (`<basename>.pdf`) already exists in the user's library.
      // Regardless of the source extension (.pdf, .docx, .xlsx,
      // .pptx, .jpg, .png…) the target is always `<basename>.pdf`
      // — that's the row that would collide in "My PDFs".
      //   • Same-name match → open the Cancel/Overwrite modal and
      //     stop; the file lives in `convertDuplicate` until the
      //     user picks a side (handlers below).
      //   • No match → fall through to the normal flow.
      // Sign-out / anon flows skip this: they don't have a library
      // to collide with.
      if (authLoaded && isSignedIn) {
        const tempId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const pdfName = isPdf(picked)
          ? picked.name
          : picked.name.replace(/\.[^.]+$/, "") + ".pdf";

        try {
          const existing = await findDuplicateByFilename(pdfName);

          // eslint-disable-next-line no-console
          console.info("[GENERAL_DUPLICATE_CHECK]", {
            lookedFor: pdfName,
            matched: existing?.filename ?? null,
            matchedId: existing?.id ?? null,
            sourceExt: getExtension(picked.name),
          });

          if (existing) {
            setConvertDuplicate({
              file: picked,
              filename: pdfName,
              existingDocId: existing.id,
              tempId,
            });

            return;
          }
        } catch (dupErr) {
          logger.warn("cross-route duplicate-name check failed", dupErr);
          // eslint-disable-next-line no-console
          console.error("[GENERAL_DUPLICATE_CHECK] lookup threw", dupErr);
          // Fall through — a flaky list call shouldn't block the drop.
        }
      }

      // Convert routes require sign-in for the backend conversion call
      // (Flow 1 per the client-signed spec). Save the original file to
      // IDB so we can pick it up automatically after sign-in — the
      // user shouldn't have to drop the same file twice. The
      // auto-resume effect below reads IDB when the user returns
      // signed-in.
      // QA 2026-09-08: guest access on convert routes is now split by
      // direction — X→PDF is FREE for guests (backend `/conversion` is
      // `@Public()`, so the browser can hit it without auth and get a
      // PDF blob back; no cloud persistence). PDF→X still requires
      // sign-in at upload because it's effectively a Download operation
      // (user starts with a PDF, gets a Word/Image file out) and the
      // paywall + auth belong before the conversion cost is spent.
      //
      // For X→PDF guest: fall through to `uploadAsPdf` below (line
      // ~563) which converts client-side via `conversionService.
      // convertPreview` (paywall pre-flight bypassed since Sept 2026,
      // see upload-to-pdf.ts comment). Then the file opens in the
      // editor as a local in-memory File (no docId, no save to cloud).
      // Guest edits freely. On Done → Download the editor's
      // `useExportEditor` fires the email-first modal per auth-chain
      // items 3-4 → auto-signup → paywall → download.
      // Product rule 2026-09-09: gate by INPUT TYPE, not route.
      // A PDF in has no conversion cost — every convert route with a
      // PDF input is really "open in editor" — so the guest is
      // allowed through and `useExportEditor` (auth-chain items 3-4)
      // fires email-first + paywall at Done→Download.
      // A non-PDF in on a convert route still costs backend tokens
      // (X→PDF or PDF→X, either direction has a server- or client-side
      // conversion step) — keep the upload-time gate for those. The
      // gate itself is unchanged; only the entry condition adds an
      // `!inputIsPdf` guard. See CLAUDE.md items 17 + spec
      // .claude/specs/2026-09-08-guest-convert-flow.md.
      const inputIsPdf = isPdf(picked);
      const isGuestPdfExport =
        requiresAuth &&
        authLoaded &&
        !isSignedIn &&
        Boolean(exportFormat) &&
        !inputIsPdf;
      const isGuestXToPdf =
        requiresAuth &&
        authLoaded &&
        !isSignedIn &&
        !exportFormat &&
        !inputIsPdf;

      // Flow 1 per product spec 2026-09-09 — guest drops a non-PDF on a
      // convert-to-PDF route (word-to-pdf, jpg-to-pdf, etc.):
      //   1. Save the ORIGINAL picked file to IDB. Backend handles the
      //      X→PDF conversion at /documents/upload time (per
      //      `runPendingConversion`), so we don't need to convert
      //      client-side — just get the user through signup quickly.
      //   2. Dispatch the email-first modal with Flow 1 copy. Auto-
      //      signup lands the user at `/pdf-composer?convert-pending=1`
      //      where `<FlowOneConvertPendingOverlay/>` shows a loader,
      //      reads the IDB file, fires `runPendingConversion`, and
      //      swaps the URL to `?id=<docId>` on success.
      //   3. `useEditorDocumentLoader` then fetches the doc metadata,
      //      sees `originalContentType != null` (converted), and calls
      //      `gateEntitledAction(doc)` → paywall opens for the freshly-
      //      signed-up non-entitled user. Native PDFs skip the paywall.
      //   4. On conversion failure the overlay bounces the user to
      //      /dashboard with a toast — no blank editor dead-end.
      if (isGuestXToPdf) {
        logger.event(EVENTS.UPLOAD_SIGNIN_REQUIRED, "info", {
          pathname,
          filename: picked.name,
          variant: "flow1-x-to-pdf",
        });

        try {
          await savePendingEditorFile(picked);
        } catch (idbErr) {
          logger.captureError(idbErr, "upload.pending_file_save");
        }

        dispatchEmailFirstModal({
          redirectUrl: `${ROUTES.TOOLS.PDF_EDITOR}?convert-pending=1`,
          title: "Your file is ready",
          subtitle: "Enter your email to save it to your account",
          submitLabel: "Continue",
        });

        return;
      }

      if (isGuestPdfExport) {
        logger.event(EVENTS.UPLOAD_SIGNIN_REQUIRED, "info", {
          pathname,
          filename: picked.name,
        });
        try {
          await savePendingEditorFile(picked);
        } catch (idbErr) {
          logger.captureError(idbErr, "upload.pending_file_save");
        }

        const returnPath = pathname ?? ROUTES.PUBLIC.HOME;

        dispatchAuthModal({
          mode: "login",
          redirectUrl: returnPath,
        });

        return;
      }

      // Convert routes for signed-in users. Two branches by direction:
      //
      //   • X→PDF (`!exportFormat`, e.g. word-to-pdf): register a pending
      //     conversion in the Zustand store, fire the convert+save runner
      //     as a background promise, then navigate to `/dashboard`
      //     immediately. The dashboard file table renders a "Preparing
      //     your document…" placeholder row driven by the store while the
      //     runner works. No toast on this page — the placeholder row on
      //     the dashboard is the only progress affordance. No paywall
      //     either; that gate fires when the user clicks Download / Open
      //     on the completed row.
      //
      //   • PDF→X (`exportFormat` set, e.g. pdf-to-word): no early
      //     paywall here. Save + open editor with `?export=<format>`;
      //     `useExportEditor` handles the paywall at auto-export time
      //     (auth-chain items 1–4 in CLAUDE.md).
      let earlyConvertedPdf: File | null = null;

      if (requiresAuth && authLoaded && isSignedIn) {
        const isConvertToPdf = !exportFormat;

        if (isConvertToPdf) {
          const tempId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const pdfName = isPdf(picked)
            ? picked.name
            : picked.name.replace(/\.[^.]+$/, "") + ".pdf";

          // Duplicate-name check for the CONVERTED filename (e.g.
          // `report.docx` → `report.pdf`). PDF→X already runs this
          // guard further below; the convert-to-PDF branch previously
          // skipped it and let the backend silently insert a second
          // row with the same filename (QA 2026-08-28). Case-
          // insensitive per the fix in `findDuplicateByFilename`.
          // Swallow lookup errors — a flaky list call shouldn't block
          // the upload.
          let existingDocId: string | null = null;

          try {
            const existing = await findDuplicateByFilename(pdfName);

            // eslint-disable-next-line no-console
            console.info("[CONVERT_DUPLICATE_CHECK]", {
              lookedFor: pdfName,
              matched: existing?.filename ?? null,
              matchedId: existing?.id ?? null,
            });

            if (existing) existingDocId = existing.id;
          } catch (dupErr) {
            logger.warn("convert duplicate-name check failed", dupErr);
            // eslint-disable-next-line no-console
            console.error("[CONVERT_DUPLICATE_CHECK] lookup threw", dupErr);
          }

          if (existingDocId) {
            // Open the Cancel/Overwrite modal. Nothing else runs until
            // the user picks — the pending file lives in state so we
            // can hand it to `runPendingConversion` on Overwrite. On
            // Cancel we clear state and let them either pick a new
            // file or leave the page.
            setConvertDuplicate({
              file: picked,
              filename: pdfName,
              existingDocId,
              tempId,
            });

            return;
          }

          usePendingConversionsStore.getState().add({
            tempId,
            file: picked,
            filename: pdfName,
            sizeBytes: picked.size,
          });

          logger.event(EVENTS.UPLOAD_OPEN_EDITOR, "info", {
            documentId: null,
            tool: null,
            exportFormat: null,
          });

          void runPendingConversion(tempId, picked);
          router.push(ROUTES.APP.DASHBOARD);

          return;
        }

        // PDF→X: input is already PDF, editor's export gate handles paywall.
        earlyConvertedPdf = picked;
      }

      setOpening(true);
      // Skip the conversion toast when we already converted above.
      const loadingKey =
        earlyConvertedPdf !== null
          ? null
          : picked.type === "application/pdf"
            ? null
            : toast.loading({
                description: `Preparing ${picked.name} for the editor.`,
                title: "Converting to PDF",
              });

      try {
        const pdfFile = earlyConvertedPdf ?? (await uploadAsPdf(picked));

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
            logger.event(EVENTS.UPLOAD_DUPLICATE_DETECTED, "info", {
              filename: pdfFile.name,
              documentId: existingDocId,
            });
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
              const document = await logger.span(
                "upload.save_before_open",
                "upload.save",
                () =>
                  documentsService.uploadDocument({
                    file: pdfFile,
                  }),
                { size: pdfFile.size },
              );

              savedDoc = { id: document.id, name: document.filename };
              logger.event(EVENTS.UPLOAD_SAVE_BEFORE_OPEN_OK, "info", {
                documentId: document.id,
                size: pdfFile.size,
              });
              toast.success({
                title: "Saved to My PDFs",
                description: document.filename,
              });
            } catch (saveErr) {
              logger.captureError(saveErr, "upload.save_before_open", {
                filename: pdfFile.name,
                size: pdfFile.size,
              });
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

        // Signed-in flow: navigate with `?id=<docId>` so the editor
        // hydrates from the persisted document row (see proxy.ts —
        // `?id=` also requires auth). Signed-out visitors never reach
        // this point on `/convert/*` routes now (the sign-in gate at
        // the top of the function short-circuits both directions); on
        // `/` they hit the editor with the in-memory file.
        logger.event(EVENTS.UPLOAD_OPEN_EDITOR, "info", {
          documentId: savedDoc?.id ?? null,
          tool,
          exportFormat,
        });
        // Guest with a PDF on a PDF→X convert route (e.g. dropping a
        // PDF on /convert/pdf-to-word) — drop the `?export=<format>`
        // param so `useExportEditor` doesn't auto-fire the email-first
        // prompt on editor load. Guest edits freely; the paywall fires
        // when they click Done → pick a non-PDF format. Signed-in users
        // and guests on any other route keep the export param so their
        // conversion intent is preserved end-to-end.
        const isGuestPdfOnConvertRoute =
          requiresAuth && authLoaded && !isSignedIn && isPdf(pdfFile);

        router.push(
          buildComposerHref(savedDoc?.id ?? null, {
            skipExport: isGuestPdfOnConvertRoute,
          }),
        );
      } catch (err) {
        logger.captureError(err, "upload.open_editor", {
          filename: picked.name,
        });
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
      isSignedIn,
      pathname,
      requiresAuth,
      router,
      setCurrentDocument,
      setEditorFile,
    ],
  );

  // Re-fire a drop that arrived before Clerk hydrated. Paired with the
  // `pendingDropRef` guard at the top of `openFileInEditor` — together
  // they close the race where a fast drop on a slow network skipped
  // both the sign-in and paywall gates.
  useEffect(() => {
    if (!authLoaded) return;
    if (!pendingDropRef.current) return;
    const file = pendingDropRef.current;

    pendingDropRef.current = null;
    void openFileInEditor(file);
  }, [authLoaded, openFileInEditor]);

  // Auto-resume the convert flow after sign-in. If the user dropped a
  // file while signed-out, we stashed it in IDB and sent them through
  // the sign-in modal. On return (signed-in, back on the same convert
  // route), pick up the file automatically and continue the upload —
  // no need for them to re-drop. Cleared from IDB on success so the
  // next visit starts fresh. Also gated on `requiresAuth` so a random
  // IDB file from a different flow doesn't misfire here.
  const resumeRef = useRef(false);

  useEffect(() => {
    if (resumeRef.current) return;
    if (!authLoaded || !isSignedIn) return;
    if (!requiresAuth) return;

    resumeRef.current = true;

    void (async () => {
      try {
        const pendingResult = await loadPendingEditorFile();

        if (!pendingResult) return;

        const { file: pendingFile } = pendingResult;
        const ext = pendingFile.name.split(".").pop()?.toLowerCase() ?? "";

        // Only auto-resume files that match this route's accept list.
        // Prevents a leftover PDF-to-word source picking up on a
        // Word-to-PDF page (or vice-versa).
        if (!acceptedExtensions.includes(ext)) return;
        if (pendingFile.size > MAX_SIZE_BYTES) return;

        await clearPendingEditorFile();
        setError(null);
        setFile(pendingFile);
        void openFileInEditor(pendingFile);
      } catch (err) {
        logger.captureError(err, "upload.convert_auto_resume");
      }
    })();
  }, [
    acceptedExtensions,
    authLoaded,
    isSignedIn,
    openFileInEditor,
    requiresAuth,
  ]);

  const validateAndSet = async (candidate: File) => {
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
    // Magic-byte check for anything the pipeline will hand straight to
    // the PDF editor. Extension + MIME can lie (a renamed .txt passes
    // both), and the editor's error state is a dead-end. Reject at the
    // dropzone with an inline message instead of shipping the user to
    // a blank error page.
    if (ext === "pdf") {
      const looksLegit = await looksLikePdfBytes(candidate);

      if (!looksLegit) {
        setError(
          `"${candidate.name}" isn't a valid PDF. The file appears to be corrupted or is not really a PDF.`,
        );
        setFile(null);

        return;
      }
    }
    setError(null);
    setFile(candidate);
    void openFileInEditor(candidate);
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];

    if (selected) void validateAndSet(selected);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    const dropped = event.dataTransfer.files?.[0];

    if (dropped) void validateAndSet(dropped);
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

  // Hoisted here so the hero-variant return below (single JSX
  // expression) can reference them without dragging them into scope
  // per-branch. Both variants share `convertDuplicate` state, so
  // both need identical handlers.
  const handleConvertDuplicateOverwriteHero = () => {
    if (!convertDuplicate) return;
    const { file, filename, existingDocId, tempId } = convertDuplicate;

    usePendingConversionsStore.getState().add({
      tempId,
      file,
      filename,
      sizeBytes: file.size,
    });

    logger.event(EVENTS.UPLOAD_DUPLICATE_DETECTED, "info", {
      filename,
      documentId: existingDocId,
      resolution: "overwrite",
    });

    void runPendingConversion(tempId, file, existingDocId);
    setConvertDuplicate(null);
    router.push(ROUTES.APP.DASHBOARD);
  };

  const handleConvertDuplicateCancelHero = () => {
    logger.event(EVENTS.UPLOAD_DUPLICATE_DETECTED, "info", {
      filename: convertDuplicate?.filename ?? null,
      documentId: convertDuplicate?.existingDocId ?? null,
      resolution: "cancel",
    });
    setConvertDuplicate(null);
    setFile(null);
  };

  if (variant === "hero") {
    return (
      <>
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
              <DashedBorder
                active={dragActive}
                color="var(--pv-brand-primary)"
              />
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

                  <div className="mt-6 flex w-full max-w-[360px] items-center gap-3 text-[13px] font-medium uppercase tracking-[0.08em] text-[var(--pv-brand-primary)]">
                    <span
                      aria-hidden
                      className="h-px flex-1 bg-[var(--pv-brand-primary)]/40"
                    />
                    <span>OR</span>
                    <span
                      aria-hidden
                      className="h-px flex-1 bg-[var(--pv-brand-primary)]/40"
                    />
                  </div>

                  <button
                    className="mt-6 inline-flex h-11 min-w-[184px] cursor-pointer items-center justify-center rounded-full bg-[#F12C23] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#d91f16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F12C23]"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openPicker();
                    }}
                  >
                    Click to Upload Your File
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

          {/* Trustpilot Micro TrustScore + terms line — landing route only.
            The hero variant of UploadWorkspace ships on `/` (via
            LandingHero) and could theoretically be reused elsewhere; the
            pathname gate keeps social proof + terms copy exclusive to
            the marketing home. Bootstrap script is only injected when
            the widget renders so we don't fetch Trustpilot's CDN on
            routes that never show a widget. */}
          {pathname === "/" ? (
            <>
              <div className="mt-6 flex justify-center">
                {/* CSS scale enlarges the Micro TrustScore visually — the
                  widget's own layout is fixed at 20px tall, so bumping
                  data-style-height just adds whitespace. Reserved height on
                  the wrapper accounts for the scaled size so the terms line
                  below doesn't overlap. */}
                <div
                  className="origin-center scale-[1.35] sm:scale-[1.6]"
                  style={{ height: 32, width: "min(360px, 100%)" }}
                >
                  <TrustpilotWidget
                    disableLink
                    businessUnitId="6a5635cc9545fd0a55b8cee6"
                    locale="en-US"
                    reviewUrl=""
                    skeletonHeight={20}
                    styleHeight="20px"
                    styleWidth="100%"
                    templateId="5419b637fa0340045cd0c936"
                    token="a947a9b4-cecb-4c81-bcec-8a3920cb39c4"
                  />
                </div>
              </div>
              <p className="mt-4 px-4 text-center text-[13px] text-[var(--pv-text-secondary)]">
                By uploading a file, you agree to our{" "}
                <Link
                  className="underline underline-offset-2 hover:text-[var(--pv-text-primary)]"
                  href={ROUTES.LEGAL.TERMS}
                >
                  Terms and Conditions
                </Link>{" "}
                and acknowledge our{" "}
                <Link
                  className="underline underline-offset-2 hover:text-[var(--pv-text-primary)]"
                  href={ROUTES.LEGAL.PRIVACY}
                >
                  Privacy Policy
                </Link>
                .
              </p>
              <Script
                async
                id="trustpilot-bootstrap"
                src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
                strategy="lazyOnload"
              />
            </>
          ) : null}
        </div>
        {/* Cancel/Overwrite modal — hero variant ships on the landing
          page, so signed-in users dropping a file whose target
          name matches an existing library doc need this modal here
          too (not just in the /convert/* full-variant flow). */}
        <DuplicateUploadModal
          filename={convertDuplicate?.filename ?? null}
          onIgnore={handleConvertDuplicateCancelHero}
          onOverwrite={handleConvertDuplicateOverwriteHero}
        />
      </>
    );
  }

  const handleConvertDuplicateOverwrite = () => {
    if (!convertDuplicate) return;
    const { file, filename, existingDocId, tempId } = convertDuplicate;

    // Same dispatch as the no-duplicate path, plus the existingDocId
    // so the backend upserts. Placeholder row uses the existing id so
    // the dashboard doesn't briefly show a new pending tile alongside
    // the one about to be overwritten.
    usePendingConversionsStore.getState().add({
      tempId,
      file,
      filename,
      sizeBytes: file.size,
    });

    logger.event(EVENTS.UPLOAD_DUPLICATE_DETECTED, "info", {
      filename,
      documentId: existingDocId,
      resolution: "overwrite",
    });

    void runPendingConversion(tempId, file, existingDocId);
    setConvertDuplicate(null);
    router.push(ROUTES.APP.DASHBOARD);
  };

  const handleConvertDuplicateCancel = () => {
    // Cancel/Ignore — clear the pending picked file so the drop zone
    // is ready for a fresh selection. Stay on the current /convert/
    // route; don't touch the existing library doc.
    logger.event(EVENTS.UPLOAD_DUPLICATE_DETECTED, "info", {
      filename: convertDuplicate?.filename ?? null,
      documentId: convertDuplicate?.existingDocId ?? null,
      resolution: "cancel",
    });
    setConvertDuplicate(null);
    setFile(null);
  };

  return (
    <>
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
              <DashedBorder
                active={dragActive}
                color="var(--pv-brand-primary)"
              />
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
                    className="mt-7 inline-flex h-11 w-[188px] cursor-pointer items-center justify-center rounded-full bg-[#F12C23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d91f16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F12C23]"
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
      </div>
      <DuplicateUploadModal
        filename={convertDuplicate?.filename ?? null}
        onIgnore={handleConvertDuplicateCancel}
        onOverwrite={handleConvertDuplicateOverwrite}
      />
    </>
  );
}
