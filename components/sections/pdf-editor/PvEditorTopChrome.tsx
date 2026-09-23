"use client";

import type { ActiveTool } from "@/lib/client/stores/pdf-editor-store";
import type { ComponentProps } from "react";

import {
  ArrowLeft01Icon,
  Tick01Icon,
  BackgroundIcon,
  PrinterIcon,
  Comment01Icon,
  Search01Icon,
  Copy01Icon,
  Cursor01Icon,
  EraserIcon,
  FileExportIcon,
  FileMinusIcon,
  FloppyDiskIcon,
  HighlighterIcon,
  Image01Icon,
  Layers01Icon,
  Layout03Icon,
  Link01Icon,
  LockedIcon,
  PaintBrush01Icon,
  PaintBucketIcon,
  PencilEdit01Icon,
  RedoIcon,
  SearchAddIcon,
  SearchMinusIcon,
  ShapesIcon,
  SignatureIcon,
  SplitIcon,
  Stamp01Icon,
  TextFontIcon,
  TextNumberSignIcon,
  UndoIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { dispatchAuthModal } from "@/components/shared/auth-modal";
import { LanguageSwitcher } from "@/components/shared/navigation/language-switcher";
import { TourHelpButton } from "@/components/shared/product-tour/tour-help-button";
import { requestPaywall } from "@/lib/client/hooks/billing/paywall-bus";
import { useIsEntitled } from "@/lib/client/hooks/billing/use-is-entitled";
import { useRenameDocumentMutation } from "@/lib/client/query/mutations/documents.mutation";
import { usePdfSearchStore } from "@/lib/client/stores/pdf-search-store";
import { saveBeforeAction } from "@/lib/client/pdf-editor/save-before-action";
import { usePdfEditorStore } from "@/lib/client/stores";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { stripLocalePrefix } from "@/lib/shared/constants/locale-map";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

import { EditableFilenameField } from "./EditableFilenameField";
import { ExportFormatModal } from "./ExportFormatModal";
import { HamburgerMenu } from "./HamburgerMenu";

// ---------------------------------------------------------------------------
// Icon type alias (matches the hugeicons SVG type).
// ---------------------------------------------------------------------------

type IconGlyph = ComponentProps<typeof HugeiconsIcon>["icon"];

// ---------------------------------------------------------------------------
// Toolbar catalog — 21 tools split into 3 pill groups per Figma.
// ---------------------------------------------------------------------------

type ToolEntry =
  | { kind: "mode"; id: ActiveTool; label: string; icon: IconGlyph }
  | { kind: "action"; id: string; label: string; icon: IconGlyph };

// Maps tool id → translation key in `messages/composer/*.json` under
// `tools.*`. Kept in sync with the ToolEntry definitions below.
const TOOL_LABEL_KEYS: Record<string, string> = {
  select: "select",
  editText: "editText",
  signature: "signature",
  text: "text",
  draw: "draw",
  highlight: "highlight",
  shape: "shape",
  eraser: "eraser",
  whiteout: "whiteout",
  redact: "redact",
  image: "image",
  watermark: "watermark",
  backgroundImage: "backgroundImage",
  compress: "compress",
  secure: "secure",
  merge: "merge",
  split: "split",
  flatten: "flatten",
  extract: "extract",
  "page-numbers": "pageNumbers",
  annotate: "annotate",
  "manage-pages": "managePages",
};

const GROUP_A: ToolEntry[] = [
  { kind: "mode", id: "select", label: "Select", icon: Cursor01Icon },
  { kind: "mode", id: "editText", label: "Edit", icon: PencilEdit01Icon },
  { kind: "mode", id: "signature", label: "Sign", icon: SignatureIcon },
  { kind: "mode", id: "text", label: "Text", icon: TextFontIcon },
  { kind: "mode", id: "draw", label: "Draw", icon: PaintBrush01Icon },
  { kind: "mode", id: "highlight", label: "Highlight", icon: HighlighterIcon },
];

const GROUP_B: ToolEntry[] = [
  { kind: "mode", id: "shape", label: "Shapes", icon: ShapesIcon },
  { kind: "mode", id: "eraser", label: "Eraser", icon: EraserIcon },
  { kind: "mode", id: "whiteout", label: "Whiteout", icon: PaintBucketIcon },
  { kind: "mode", id: "redact", label: "Redact", icon: ViewOffIcon },
  { kind: "mode", id: "image", label: "Image", icon: Image01Icon },
  { kind: "mode", id: "watermark", label: "Watermark", icon: Stamp01Icon },
  {
    kind: "mode",
    id: "backgroundImage",
    label: "Background",
    icon: BackgroundIcon,
  },
];

const GROUP_C: ToolEntry[] = [
  { kind: "action", id: "compress", label: "Compress", icon: FileMinusIcon },
  { kind: "action", id: "secure", label: "Secure", icon: LockedIcon },
  { kind: "action", id: "merge", label: "Merge", icon: Copy01Icon },
  { kind: "action", id: "split", label: "Split", icon: SplitIcon },
  { kind: "action", id: "flatten", label: "Flatten", icon: Layers01Icon },
  { kind: "action", id: "extract", label: "Extract", icon: FileExportIcon },
  {
    kind: "action",
    id: "page-numbers",
    label: "Page No",
    icon: TextNumberSignIcon,
  },
  { kind: "action", id: "annotate", label: "Annotate", icon: Comment01Icon },
];

// Manage Pages — kept in its own pill group so the rotate/reorder/delete flow
// reads as a distinct document-structure action, not another single-page tool.
// Runs a saveBeforeAction guard locally (same guard the mobile BottomDock and
// legacy EditorToolBar use) so in-progress edits are flushed before the modal
// opens.
const GROUP_MANAGE: ToolEntry[] = [
  {
    kind: "action",
    id: "manage-pages",
    label: "Manage Pages",
    icon: Layout03Icon,
  },
];

// ---------------------------------------------------------------------------
// Actions Group — dispatches events / opens modals from the top toolbar.
//
// Modal-open handlers that live inside `HamburgerMenu` (Share, Split, Flatten,
// Annotate) are triggered via CustomEvents the menu now listens for. That
// avoids duplicating those states in two places while still letting the top
// chrome trigger them directly (per the Figma).
// ---------------------------------------------------------------------------

function fireEditorEvent(name: string) {
  window.dispatchEvent(new CustomEvent(name));
}

// ---------------------------------------------------------------------------
// Tool pill button (icon on top, small label under).
// ---------------------------------------------------------------------------

function ToolButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: IconGlyph;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip delay={300}>
      <button
        aria-label={label}
        aria-pressed={active}
        className={`group flex h-auto min-w-[56px] cursor-pointer flex-col items-center gap-0.5 rounded-[10px] px-2 py-1.5 text-[10px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${
          active
            ? "bg-[var(--color-accent)]/12 text-[var(--color-accent)] ring-1 ring-inset ring-[var(--color-accent)]/40"
            : "text-default-600 hover:bg-default-100"
        }`}
        disabled={disabled}
        type="button"
        onClick={onClick}
      >
        <HugeiconsIcon
          className={
            active
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-foreground)]"
          }
          icon={icon}
          size={20}
          strokeWidth={1.6}
        />
        <span>{label}</span>
      </button>
      <Tooltip.Content>
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

function PillGroup({
  children,
  dataTour,
}: {
  children: React.ReactNode;
  dataTour?: string;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-[16px] border border-[var(--pv-hairline,rgb(235,235,235))] bg-white px-1.5 py-1.5 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.15)]"
      data-tour={dataTour}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zoom pill — mirrors the manual zoom controls in `EditorInfoBar` (mobile)
// but designed to sit inline next to `<SaveStatusChip />` in the desktop
// top chrome. Reads / writes the shared `zoom` in `usePdfEditorStore` so
// the pill, the Fabric canvas, and the mobile bottom dock all stay in
// sync — no local state, no drift.
// ---------------------------------------------------------------------------

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

function ZoomPill() {
  const zoom = usePdfEditorStore((s) => s.zoom);
  const setZoom = usePdfEditorStore((s) => s.setZoom);
  const file = usePdfEditorStore((s) => s.file);
  const t = useTranslations("topChrome");

  if (!file) return null;

  const canZoomOut = zoom > ZOOM_MIN + 0.001;
  const canZoomIn = zoom < ZOOM_MAX - 0.001;
  const pct = `${Math.round(zoom * 100)}%`;

  return (
    <div
      aria-label={t("zoom")}
      className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-default-200 bg-white px-1 py-0.5"
      role="group"
    >
      <Tooltip delay={300}>
        <button
          aria-label={t("zoomOut")}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-default-700 transition-colors hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canZoomOut}
          type="button"
          onClick={() =>
            setZoom(Math.max(ZOOM_MIN, Number((zoom - ZOOM_STEP).toFixed(2))))
          }
        >
          <HugeiconsIcon icon={SearchMinusIcon} size={14} />
        </button>
        <Tooltip.Content>
          <p>{t("zoomOut")}</p>
        </Tooltip.Content>
      </Tooltip>

      <span
        aria-live="polite"
        className="min-w-[38px] text-center text-[11px] font-medium tabular-nums text-default-600"
      >
        {pct}
      </span>

      <Tooltip delay={300}>
        <button
          aria-label={t("zoomIn")}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-default-700 transition-colors hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canZoomIn}
          type="button"
          onClick={() =>
            setZoom(Math.min(ZOOM_MAX, Number((zoom + ZOOM_STEP).toFixed(2))))
          }
        >
          <HugeiconsIcon icon={SearchAddIcon} size={14} />
        </button>
        <Tooltip.Content>
          <p>{t("zoomIn")}</p>
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top App Bar — logo, doc title, undo/redo pill, Share, Download.
// ---------------------------------------------------------------------------

function TopAppBar() {
  const pathname = usePathname();
  const t = useTranslations("topChrome");
  // Explicit Save affordance for the W-9 route only. The generic
  // composer's Save button is hidden per product decision, but on
  // `/w-9-form` there's no other in-flow save trigger — the user's
  // only path to My PDFs otherwise is Done → Download, which is
  // paid + downloads to disk. QA 2026-08-28.
  // Normalise via `stripLocalePrefix` so the W-9 guards fire on every
  // locale variant — `/w-9-form`, `/de/w-9-form`, `/fr/w-9-form`, etc.
  // The raw `usePathname()` returns the locale-prefixed URL and a
  // direct `===` comparison would flip false on non-EN locales,
  // leaving the composer HamburgerMenu + Tool row visible on W-9 in
  // languages other than English (QA 2026-09-06).
  const showW9Save = stripLocalePrefix(pathname) === ROUTES.FORMS.W9_SHORT;
  const file = usePdfEditorStore((s) => s.file);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const historyByPage = usePdfEditorStore((s) => s.historyByPage);
  const historyIndexByPage = usePdfEditorStore((s) => s.historyIndexByPage);
  const renameDoc = useRenameDocumentMutation();

  const history = historyByPage.get(currentPage) ?? [];
  const idx = historyIndexByPage.get(currentPage) ?? -1;
  const canUndo = idx > 0;
  const canRedo = idx < history.length - 1;

  const fileName = file?.name ?? "Untitled.pdf";

  const entitled = useIsEntitled();
  const canShare = !!file && isSignedIn;
  const canDownload = !!file;
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSavingBeforeExport, setIsSavingBeforeExport] = useState(false);

  // QA 2026-09-07: Done click now saves the current edits to cloud FIRST,
  // then opens the export modal. User was reporting that clicking Done →
  // Download shipped a PDF without their latest edits — one cause is that
  // the previous flow only saved as part of the Download click, and if the
  // save flow flaked (or if the export bake ran off stale bytes), the
  // download landed with missing overlays. Saving upfront guarantees the
  // cloud has the latest baked bytes before any subsequent action.
  // Signed-out users skip the save (they don't have a cloud doc yet — the
  // export flow itself routes them through email-first signin).
  const openExportModalAfterSave = () => {
    if (!file) return;
    if (!isSignedIn) {
      setIsExportModalOpen(true);

      return;
    }
    setIsSavingBeforeExport(true);
    const toastKey = toast.loading({
      title: "Saving your edits",
      description: "Hold on — we'll open the download options once saved.",
    });

    window.dispatchEvent(
      new CustomEvent("editor:save-before-action", {
        detail: {
          force: true,
          skipReset: true,
          onComplete: () => {
            toast.close(toastKey);
            setIsSavingBeforeExport(false);
            setIsExportModalOpen(true);
          },
        },
      }),
    );
  };

  // Auto-open the ExportFormatModal when the welcome-email arrival
  // flag flips. Hydrator sets `pendingOpenExportModal` when it sees
  // `?tool=export` or the CIO UTM combo on `/pdf-composer`; the
  // modal below reads it inline via `isOpen={... || pendingOpenExportModal}`
  // so the open state is DERIVED rather than mirrored into local state
  // by an effect. Effect-based mirroring tripped React 19's
  // `react-hooks/set-state-in-effect` rule (calling `setState`
  // synchronously in a `useEffect` body is a build error).
  //
  // Close handler clears both the local state (in case the user
  // manually opened it via the Done button) and the pending flag (in
  // case this open was auto-triggered by the hydrator). Safe to clear
  // both on every close — no-op if the flag was already false.
  const pendingOpenExportModal = usePdfEditorStore(
    (s) => s.pendingOpenExportModal,
  );
  const setPendingOpenExportModal = usePdfEditorStore(
    (s) => s.setPendingOpenExportModal,
  );

  // Display name strips `.pdf` because the extension is redundant in
  // an editor that only handles PDFs — commit re-appends it before
  // saving. Input state is fully owned by <EditableFilenameField/>.
  const displayName = fileName.replace(/\.pdf$/i, "");

  // Clear the store BEFORE navigating so re-entry via any path — bare
  // `/pdf-editor`, tool tile, or a landing-page drop that creates a new
  // doc — doesn't render the previous PDF while the new load is in flight.
  // Reported 2026-08-18.
  const handleBack = () => {
    const targetUrl = isSignedIn ? ROUTES.APP.DASHBOARD : ROUTES.PUBLIC.HOME;

    if (showW9Save) {
      // W-9 route: save the partial form THROUGH the finalize path
      // (`W9FinalizeIntercept.saveAndContinueHandler` — falls back to
      // a client-side stamp so partial forms still land in My PDFs).
      // Only navigate when the save resolves `ok`; failures show a
      // toast and keep the user on the form so nothing is lost. Per
      // product 2026-09-01: "hit save first, don't go back until the
      // form is saved."
      const savingToast = toast.loading({
        title: "Saving your W-9",
        description: "Hold on — you'll go back once your progress is saved.",
      });

      window.dispatchEvent(
        new CustomEvent("editor:w9-save-and-continue", {
          detail: {
            onComplete: (result: { ok: boolean; reason?: string }) => {
              toast.close(savingToast);

              if (!result.ok) {
                toast.error({
                  title: "Couldn't save your W-9",
                  description:
                    "Your progress is still on this page — try again in a moment.",
                });

                return;
              }

              window.dispatchEvent(
                new CustomEvent("editor:navigate-after-save", {
                  detail: {
                    url: targetUrl,
                    clearFileAfter: true,
                  },
                }),
              );
            },
          },
        }),
      );

      return;
    }

    // Non-W-9 routes: existing save-then-navigate dispatch.
    // `useEditorNavigationSave` handles the "no file / signed out /
    // no unsaved changes" fast paths, so this dispatch is safe from
    // every state. `clearFileAfter: true` preserves the 2026-08-18
    // fix — clearing the store before re-entry stops the previous PDF
    // flashing on the next editor load.
    window.dispatchEvent(
      new CustomEvent("editor:navigate-after-save", {
        detail: {
          url: targetUrl,
          clearFileAfter: true,
        },
      }),
    );
  };

  // QA 2026-09-07: logo click must save current edits BEFORE navigating
  // home. Same shape as the back button (`handleBack`) — dispatch the
  // navigate-after-save event (or the W-9 save-and-continue variant on
  // /w-9-form) and cancel the Link's default navigation. Signed-out
  // users have no cloud doc to persist, so let the Link navigate
  // normally (returns `undefined` → `<Link>` proceeds).
  const handleLogoClick = (
    e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
  ) => {
    // No file open → let the Link navigate normally. If a file IS open,
    // ALWAYS intercept — signed-out users still deserve an IDB snapshot
    // of their in-progress edits (handled inside
    // `use-editor-navigation-save.ts`'s signed-out branch, QA
    // 2026-09-08) so they can pick up where they left off on return.
    if (!file) return;

    e.preventDefault();

    const targetUrl = ROUTES.PUBLIC.HOME;

    if (showW9Save) {
      const savingToast = toast.loading({
        title: "Saving your W-9",
        description: "Hold on — you'll go home once your progress is saved.",
      });

      window.dispatchEvent(
        new CustomEvent("editor:w9-save-and-continue", {
          detail: {
            onComplete: (result: { ok: boolean; reason?: string }) => {
              toast.close(savingToast);

              if (!result.ok) {
                toast.error({
                  title: "Couldn't save your W-9",
                  description:
                    "Your progress is still on this page — try again in a moment.",
                });

                return;
              }

              window.dispatchEvent(
                new CustomEvent("editor:navigate-after-save", {
                  detail: { url: targetUrl, clearFileAfter: true },
                }),
              );
            },
          },
        }),
      );

      return;
    }

    // `force: true` — a quick "draw stroke → click logo" sequence can
    // race the `path:created` → `markDocumentDirty` listener, so the
    // store's `hasUnsavedChanges` may still be false at click time even
    // though the live canvas has new strokes. Forcing the save
    // bypasses the "no changes → skip upload" short-circuit and lets
    // `persistEditorDocument` (which internally re-serializes the live
    // canvas) capture the latest state before navigation.
    window.dispatchEvent(
      new CustomEvent("editor:navigate-after-save", {
        detail: { url: targetUrl, clearFileAfter: true, force: true },
      }),
    );
  };

  // Called from EditableFilenameField with the trimmed new name.
  // Blank-name guard already runs inside the component (tick button
  // disabled + Enter path cancels), so we only see non-empty values.
  const commitRename = (trimmed: string) => {
    if (!file) return;

    const withExt = /\.[^./\\]+$/.test(trimmed) ? trimmed : `${trimmed}.pdf`;

    if (withExt === file.name) return;

    const renamed = new File([file], withExt, {
      lastModified: file.lastModified,
      type: file.type,
    });

    setFile(renamed);

    if (currentDocumentId) {
      renameDoc.mutate({ filename: withExt, id: currentDocumentId });
    }
  };

  const {
    isOpen: isSearchOpen,
    open: openSearch,
    close: closeSearch,
  } = usePdfSearchStore();

  const handlePrint = async () => {
    if (!file) return;
    if (!entitled) {
      const outcome = await requestPaywall();

      if (outcome !== "success") return;
    }
    window.dispatchEvent(
      new CustomEvent("editor:export", {
        detail: { format: "pdf", print: true },
      }),
    );
  };

  return (
    // QA 2026-09-09: split into two aligned sections. The parent uses
    // `justify-between` so the left cluster (back / hamburger / logo /
    // filename) hugs the left edge and the right cluster (zoom / undo /
    // language / help / search / print / share / done) hugs the right
    // edge. Retains `flex-wrap` so on narrow viewports the right cluster
    // wraps below the left one instead of overflowing horizontally.
    // Prior layout had every item as a direct flex child with a fixed
    // `md:w-12 lg:w-20 xl:w-24` visual spacer between filename and zoom
    // pill; that's now redundant and removed.
    <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--pv-hairline,rgb(235,235,235))] bg-white px-4 py-2">
      {/* ── LEFT SECTION: navigation + document identity ────────────── */}
      <div className="flex min-w-0 items-center gap-3">
        <Tooltip delay={300}>
          <button
            aria-label={t("backToDashboard")}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-default-600 transition-colors hover:bg-default-100 hover:text-default-800"
            type="button"
            onClick={handleBack}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          </button>
          <Tooltip.Content>
            <p>{t("backToDashboard")}</p>
          </Tooltip.Content>
        </Tooltip>

        {/* Hamburger hidden on `/w-9-form` per product 2026-09-01 —
            the W-9 flow has its own Back → save-and-continue path and
            the hamburger's tools (Manage Pages, Share, etc.) don't
            apply to a fill-and-sign form.

            For guests: HamburgerMenu itself hides the dropdown trigger
            (per QA 2026-09-05) but stays MOUNTED so its bridge event
            listeners (editor:open-merge / open-split / open-flatten /
            open-annotations) still fire when the top toolbar dispatches
            them. Unmounting the whole component for guests silently
            drops those listeners and the toolbar buttons appear idle
            (QA 2026-09-06). */}
        {showW9Save ? null : <HamburgerMenu />}

        <Link
          aria-label={t("home")}
          className="flex shrink-0 items-center gap-2"
          href={ROUTES.PUBLIC.HOME}
          onClick={handleLogoClick}
        >
          <Image
            alt="PDFVault"
            className="h-[32px] w-auto object-contain"
            height={32}
            src="/landing/logo-with-text.png"
            width={128}
          />
        </Link>

        <span aria-hidden className="mx-1 h-6 w-px bg-default-200" />

        {/* QA 2026-09-08: filename now uses <EditableFilenameField/> —
            fit-to-text sizing (no more `flex-1` stretch), click-to-edit
            via pencil icon, tick button to save, blank-name guarded. */}
        <EditableFilenameField
          className="min-w-0 max-w-[50vw] flex-shrink"
          disabled={!file}
          fontSizeClass="text-[14px]"
          value={displayName}
          onCommit={commitRename}
        />
      </div>

      {/* ── RIGHT SECTION: view controls + actions ──────────────────── */}
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        {/* QA 2026-09-08: SaveStatusChip removed per product decision — the
            "Unsaved edits" / "Saved to My PDFs" label added visual noise
            and was confusing users. Save state is still tracked in the
            store (`hasUnsavedChanges`); other UI (Save button, navigation
            prompts, ExportFormatModal auto-save) still uses it. Restore
            by re-inserting `<SaveStatusChip />` here. */}
        <ZoomPill />

        {/* Save button — HIDDEN for now per product decision. Restore by
            removing the surrounding `{showW9Save && (…)}` wrapper. Handler +
            auth flow (items 4, 12, 17) preserved intact so re-enabling
            is a one-line change. Currently enabled ONLY on the W-9 route
            (`/w-9-form`) where the user needs an explicit save affordance
            that doesn't force a paid download. */}
        {showW9Save && (
          <Tooltip delay={300}>
            <button
              aria-label={t("save")}
              className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-default-200 bg-white px-3 text-[13px] font-medium text-[var(--color-foreground)] transition-colors hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
              disabled={!file}
              type="button"
              onClick={() => {
                if (!isSignedIn) {
                  // Persist file + fabric edits + extractedPages before the
                  // full-page sign-in redirect so the hydrator restores the
                  // full editor state on return.
                  void snapshotPendingEditorFile().catch(() => undefined);
                  // AuthModal (2026-08-28 unify). Cards' finalize does
                  // the item #15 `window.location.assign` — hydrator
                  // restores the snapshotted file on return.
                  dispatchAuthModal({
                    mode: "signup",
                    redirectUrl: ROUTES.TOOLS.PDF_EDITOR,
                  });

                  return;
                }
                window.dispatchEvent(new CustomEvent("editor:save"));
              }}
            >
              <HugeiconsIcon icon={FloppyDiskIcon} size={14} />
              <span className="hidden sm:inline">{t("save")}</span>
            </button>
            <Tooltip.Content>
              <p>
                {!file
                  ? t("openPdfToSave")
                  : !isSignedIn
                    ? t("loginToSave")
                    : t("saveToMyPdfs")}
              </p>
            </Tooltip.Content>
          </Tooltip>
        )}

        <div className="flex shrink-0 items-center gap-2 rounded-full border border-default-200 bg-white px-2 py-1.5">
          <Tooltip delay={300}>
            <button
              aria-label={t("undo")}
              className="flex cursor-pointer items-center justify-center rounded-full p-1 text-default-600 transition-colors hover:bg-default-100 hover:text-default-800 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canUndo}
              type="button"
              onClick={() => fireEditorEvent("editor:undo")}
            >
              <HugeiconsIcon icon={UndoIcon} size={18} />
            </button>
            <Tooltip.Content>
              <p>{t("undo")}</p>
            </Tooltip.Content>
          </Tooltip>
          <span aria-hidden className="h-4 w-px bg-default-200" />
          <Tooltip delay={300}>
            <button
              aria-label={t("redo")}
              className="flex cursor-pointer items-center justify-center rounded-full p-1 text-default-600 transition-colors hover:bg-default-100 hover:text-default-800 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canRedo}
              type="button"
              onClick={() => fireEditorEvent("editor:redo")}
            >
              <HugeiconsIcon icon={RedoIcon} size={18} />
            </button>
            <Tooltip.Content>
              <p>{t("redo")}</p>
            </Tooltip.Content>
          </Tooltip>
        </div>

        <LanguageSwitcher />

        {/* Editor product tour is auto-launched on first mount via
            `useProductTour("editor")` inside <TourHelpButton />. The W-9
            route reuses <PdfEditorShell />, so mounting this button here
            would fire the composer tour over the W-9 template on the
            user's first visit — anchors don't map to the W-9 layout and
            it distracts from the yellow field overlays. Suppress on
            `/w-9-form` only; every other editor route keeps the button
            + the auto-launch. */}
        {showW9Save ? null : <TourHelpButton tour="editor" variant="chrome" />}

        {/* Search — PDF-wide text search with highlight + navigation. */}
        <Tooltip delay={300}>
          <button
            aria-label={t("search")}
            aria-pressed={isSearchOpen}
            className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 ${
              isSearchOpen
                ? "border-[#f12c23] bg-red-50 text-[#f12c23]"
                : "border-default-200 bg-white text-[var(--color-foreground)] hover:bg-default-100"
            }`}
            disabled={!file}
            type="button"
            onClick={() => (isSearchOpen ? closeSearch() : openSearch())}
          >
            <HugeiconsIcon icon={Search01Icon} size={14} />
            <span className="hidden sm:inline">{t("search")}</span>
          </button>
          <Tooltip.Content>
            <p>{t("search")}</p>
          </Tooltip.Content>
        </Tooltip>

        {/* Print — paid users only; builds the final edited PDF then opens
            the browser print dialog via a hidden iframe. */}
        <Tooltip delay={300}>
          <button
            aria-label={t("print")}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-default-200 bg-white px-3 text-[13px] font-medium text-[var(--color-foreground)] transition-colors hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            disabled={!file}
            type="button"
            onClick={() => void handlePrint()}
          >
            <HugeiconsIcon icon={PrinterIcon} size={14} />
            <span className="hidden sm:inline">{t("print")}</span>
          </button>
          <Tooltip.Content>
            <p>{t("print")}</p>
          </Tooltip.Content>
        </Tooltip>

        {/* Share — icon-only on <sm so the top bar breathes at 375px. */}
        <button
          aria-label={t("share")}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-default-200 bg-white px-3 text-[13px] font-medium text-[var(--color-foreground)] transition-colors hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
          data-tour="editor-share"
          disabled={!canShare}
          type="button"
          onClick={() => fireEditorEvent("editor:open-share")}
        >
          <HugeiconsIcon icon={Link01Icon} size={14} />
          <span className="hidden sm:inline">{t("share")}</span>
        </button>

        <Button
          aria-label={t("download")}
          className="!h-9 !cursor-pointer !gap-2 !rounded-full !bg-[#f12c23] !px-3 !text-[13px] !font-semibold !text-white hover:!opacity-90 disabled:!opacity-50 sm:!px-4"
          data-tour="editor-download"
          isDisabled={!canDownload || isSavingBeforeExport}
          onPress={openExportModalAfterSave}
        >
          <HugeiconsIcon className="text-white" icon={Tick01Icon} size={15} />

          <span className="hidden sm:inline">
            {isSavingBeforeExport ? "…" : t("download")}
          </span>
        </Button>
      </div>

      <ExportFormatModal
        isOpen={isExportModalOpen || pendingOpenExportModal}
        onClose={() => {
          setIsExportModalOpen(false);
          setPendingOpenExportModal(false);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool Toolbar Row — 3 floating pill groups.
// ---------------------------------------------------------------------------

function ToolToolbar() {
  // W-9 form (`/w-9-form`) reuses `<PdfEditorShell />` for its canvas but
  // the form is fill-and-sign — the generic PDF-tools row (Edit / Draw /
  // Shapes / Merge / Manage Pages, etc.) doesn't apply and clutters the
  // page. `W9FormFieldsPortal` already renders the fill overlays; hiding
  // the tool row here keeps that flow focused. All other routes are
  // unaffected. Path check is done AFTER hook calls to satisfy the
  // rules-of-hooks order.
  const pathname = usePathname();
  const tLabel = useTranslations("tools");
  const labelFor = (id: string) => {
    const key = TOOL_LABEL_KEYS[id];

    return key ? tLabel(key) : id;
  };
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
  const setIsCompressModalOpen = usePdfEditorStore(
    (s) => s.setIsCompressModalOpen,
  );
  const setIsPasswordModalOpen = usePdfEditorStore(
    (s) => s.setIsPasswordModalOpen,
  );
  const setIsPageNumbersModalOpen = usePdfEditorStore(
    (s) => s.setIsPageNumbersModalOpen,
  );
  const setIsManagePagesOpen = usePdfEditorStore((s) => s.setIsManagePagesOpen);
  const file = usePdfEditorStore((s) => s.file);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const pageCount = usePdfEditorStore((s) => s.pageCount);

  const disabled = !file;
  const canManagePages = !!pdfDocument && pageCount > 0;

  // Locale-normalised — see `showW9Save` above for context.
  const isW9Route = stripLocalePrefix(pathname) === ROUTES.FORMS.W9_SHORT;

  // QA 2026-09-06: Secure / Split / Flatten / Manage Pages appeared
  // greyed-out even when a PDF was open, so users thought the tools
  // were broken. Only truly-unrecoverable states disable the button
  // now — everything else is clickable and the handler surfaces a
  // toast if the doc isn't ready yet. Sign-in state is NOT a gate
  // here; the underlying modals + save-before-action chain already
  // route signed-out users through the auth flow (see CLAUDE.md
  // item #4 / #5 / #17).
  const isActionDisabled = (_id: string): boolean => false;

  const handleAction = (id: string) => {
    if (id === "manage-pages") {
      if (!canManagePages) {
        toast.info({
          title: "Open a PDF first",
          description: "Upload a PDF to manage its pages.",
        });

        return;
      }
      // Same save-before-action guard as EditorToolBar / BottomDock so
      // in-progress edits get flushed before the modal opens.
      void (async () => {
        const ok = await saveBeforeAction(
          "Saving your edits before opening Manage Pages.",
        );

        if (ok) setIsManagePagesOpen(true);
      })();

      return;
    }

    if (disabled) {
      toast.info({
        title: "Open a PDF first",
        description: "Upload a PDF to use this action.",
      });

      return;
    }

    switch (id) {
      case "compress":
        setIsCompressModalOpen(true);
        break;
      case "secure":
        setIsPasswordModalOpen(true);
        break;
      case "page-numbers":
        setIsPageNumbersModalOpen(true);
        break;
      case "merge":
        fireEditorEvent("editor:open-merge");
        break;
      case "split":
        fireEditorEvent("editor:open-split");
        break;
      case "flatten":
        fireEditorEvent("editor:open-flatten");
        break;
      case "extract":
        fireEditorEvent("editor:extract-images");
        break;
      case "annotate":
        fireEditorEvent("editor:open-annotations");
        break;
    }
  };

  const groups = useMemo(
    () =>
      [
        { entries: GROUP_A, dataTour: "editor-tools-a" },
        { entries: GROUP_B, dataTour: "editor-tools-b" },
        { entries: GROUP_C, dataTour: "editor-tools-c" },
        { entries: GROUP_MANAGE, dataTour: undefined as string | undefined },
      ] as const,
    [],
  );

  if (isW9Route) return null;

  return (
    // Desktop-only toolbar (mobile uses `BottomDock`), so the iOS Safari
    // `mx-auto w-fit` pattern from `PdfViewerCanvas.tsx` doesn't apply.
    // Flex-wrap lets the pill row reflow into multiple rows when the
    // viewport narrows or the user zooms the browser in — without wrap
    // the row overflows horizontally with `overflow-x-auto` and the
    // rightmost tools become hidden behind the sidebar edge.
    // `overflow-x-auto` stays as a safety net for a single pill group
    // that on its own exceeds the container width.
    <div className="shrink-0 overflow-x-auto bg-[var(--pv-canvas,#f5f5f7)] px-3 py-3">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {groups.map((group, i) => (
          <PillGroup key={i} dataTour={group.dataTour}>
            {group.entries.map((tool) => {
              if (tool.kind === "mode") {
                const active = activeTool === tool.id;

                return (
                  <ToolButton
                    key={tool.id}
                    active={active}
                    disabled={disabled}
                    icon={tool.icon}
                    label={labelFor(tool.id)}
                    onClick={() => {
                      // Signal `use-fabric-canvas` to discard any live
                      // selection so selection-driven floating toolbars
                      // (FloatingTextToolbar / FloatingShapeToolbar) don't
                      // stay open on top of the new tool's own panel. Only
                      // fires on user toolbar clicks — programmatic
                      // `setActiveTool` calls (e.g. `use-image-tool.ts`
                      // returning to select after a drop) skip this so the
                      // just-added object stays selected. QA 2026-09-10:
                      // "edit annotation, then click Highlight → the two
                      // panels overlap on the right side."
                      window.dispatchEvent(
                        new CustomEvent("editor:toolbar-tool-picked"),
                      );
                      setActiveTool(tool.id);
                    }}
                  />
                );
              }

              return (
                <ToolButton
                  key={tool.id}
                  disabled={isActionDisabled(tool.id)}
                  icon={tool.icon}
                  label={tool.label}
                  onClick={() => handleAction(tool.id)}
                />
              );
            })}
          </PillGroup>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public: single chrome component (kept for mobile / consumers that want both).
// ---------------------------------------------------------------------------

export function PvEditorTopChrome() {
  return (
    <>
      <TopAppBar />
      <ToolToolbar />
    </>
  );
}

export { TopAppBar, ToolToolbar };
