"use client";

import type { Key } from "@heroui/react";

import {
  Add01Icon,
  Clock01Icon,
  FileExportIcon,
  FileMinusIcon,
  FolderOpenIcon,
  Layers01Icon,
  Link01Icon,
  Menu01Icon,
  NoteIcon,
  Search01Icon,
  SplitIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Dropdown, Label, Separator } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  UPLOAD_ACCEPT_MIME,
  uploadAsPdf,
} from "@/lib/client/file-conversion/upload-to-pdf";
import { DuplicateUploadModal } from "@/components/sections/dashboard/duplicate-upload-modal";
import { dispatchAuthModal } from "@/components/shared/auth-modal";
import { saveBeforeAction } from "@/lib/client/pdf-editor/save-before-action";
import { usePdfEditorStore } from "@/lib/client/stores";
import { useUploadWithDuplicateCheck } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";
import { fileToMergeEntry } from "@/lib/client/pdf-tools/merge-pdfs";

import { AnnotationsModal } from "./AnnotationsModal";
import { SplitPdfModal, type SplitPdfModalSource } from "./SplitPdfModal";

// Actions still triggered by PvEditorTopChrome that need modal state /
// hidden-input machinery owned by this component. The top toolbar dispatches
// these events; we handle them via the same switch a menu click would use so
// there's one source of truth for the guards (sign-in, requireFile, etc.).
const BRIDGE_EVENTS = {
  "editor:open-merge": "merge",
  "editor:open-split": "split",
  "editor:open-share": "share",
  "editor:open-annotations": "annotations",
  "editor:open-flatten": "flatten",
} as const;

export function HamburgerMenu() {
  const t = useTranslations("menu");
  const clearFile = usePdfEditorStore((s) => s.clearFile);
  const file = usePdfEditorStore((s) => s.file);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setIsFindReplaceOpen = usePdfEditorStore((s) => s.setIsFindReplaceOpen);
  const setIsCreatePdfModalOpen = usePdfEditorStore(
    (s) => s.setIsCreatePdfModalOpen,
  );
  const setIsCompressModalOpen = usePdfEditorStore(
    (s) => s.setIsCompressModalOpen,
  );
  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ShareModal lives at shell-level (see comment there); open state is in
  // the store so it survives the EditorLayout unmount that happens during
  // the post-save pdf.js reload.
  const setIsShareModalOpen = usePdfEditorStore((s) => s.setIsShareModalOpen);
  // VersionHistory lives at shell-level (see VersionHistoryModalHost); open
  // state is in the store so it survives the EditorLayout unmount triggered
  // by the pre-open save's pdf.js reload — same class of bug as Share.
  const setIsVersionHistoryModalOpen = usePdfEditorStore(
    (s) => s.setIsVersionHistoryModalOpen,
  );
  const [isAnnotationsOpen, setIsAnnotationsOpen] = useState(false);
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const [splitSource, setSplitSource] = useState<SplitPdfModalSource | null>(
    null,
  );
  const setIsMergeOpen = usePdfEditorStore((s) => s.setIsMergeModalOpen);
  const setMergeSource = usePdfEditorStore((s) => s.setMergeModalSource);
  const router = useRouter();
  const { duplicate, start } = useUploadWithDuplicateCheck();
  const canShare = !!file && isSignedIn;
  const requireFile = (action: string): File | null => {
    if (!file) {
      toast.info({
        title: "No PDF open",
        description: `Open or create a PDF before ${action}.`,
      });

      return null;
    }

    return file;
  };

  const runFlatten = () => {
    if (!requireFile("flattening")) return;
    // Auth + paywall + bake all handled in useFlattenEditor (PdfEditorShell)
    // which has the live fabricCanvas ref needed to bake Fabric overlays.
    window.dispatchEvent(new CustomEvent("editor:flatten"));
  };

  const openSplitModal = async () => {
    // Read the LIVE file from the store — same stale-closure guard as
    // `openMergeModal`. After a `saveBeforeAction` awaits the bake +
    // `applyPostSaveReset`, the outer `handleAction` closure still
    // holds the pre-edit `file`; reading via `getState()` here picks
    // up the freshly-baked bytes so the split output includes the
    // user's latest edits (draw / highlight / signature / etc.).
    const target = usePdfEditorStore.getState().file;

    if (!target) {
      toast.info({
        title: "No PDF open",
        description: "Open or create a PDF before splitting.",
      });

      return;
    }

    // Paywall is gated INSIDE SplitPdfModal at the Split (download)
    // button — unpaid users should still see the modal, pick ranges,
    // and hit the wall only when they try to download. Opening the
    // modal is free; the download is what costs.

    // Read the source bytes + page count once on click so the modal can
    // stay a pure controlled view (avoids the cascading-render lint rule
    // and the in-render async work it would otherwise require). pdf-lib's
    // `load` parses the cross-reference table only, so this is fast (~tens
    // of ms for typical PDFs).
    const loadingKey = toast.loading({
      title: "Preparing split",
      description: "Reading the PDF…",
    });

    try {
      const buf = await target.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });

      setSplitSource({
        filename: target.name,
        bytes,
        pageCount: doc.getPageCount(),
      });
      setIsSplitOpen(true);
    } catch (err) {
      toast.error({
        title: "Couldn't read this PDF",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      toast.close(loadingKey);
    }
  };

  const openMergeModal = async () => {
    // Read the LIVE file from the store, not the closed-over `file`.
    // The signed-in merge path awaits `saveBeforeAction(force,
    // skipWait)` first, which calls `applyPostSaveReset` and swaps
    // `store.file` to the freshly-baked (edits-included) bytes. The
    // outer `handleAction` closure still has the pre-edit `file`
    // reference, so `requireFile()` here would hand `fileToMergeEntry`
    // the ORIGINAL source and the merged download would ship without
    // the user's draw / highlight / signature edits (QA 2026-09-07:
    // "PDF edits are not reflected in merged and downloaded PDF").
    // Reading from `getState()` at call time picks up the post-save
    // file regardless of the closure age.
    const target = usePdfEditorStore.getState().file;

    if (!target) {
      toast.info({
        title: "No PDF open",
        description: "Open or create a PDF before merging.",
      });

      return;
    }

    // Paywall is gated INSIDE MergePdfModal at the Merge (download)
    // button — unpaid users should still see the modal, add files,
    // and hit the wall only when they try to download.
    //
    // QA 2026-09-08: "Preparing merge" loading toast removed. The
    // `fileToMergeEntry(target)` call is a synchronous-feeling
    // ArrayBuffer read + pdf-lib load; on a typical browser it
    // resolves in <100ms. The toast would flash on-screen and vanish
    // before the user could read it (user report: "a popup appears
    // and then suddenly disappears"). If a future path adds a slow
    // step here (e.g. large-file network fetch), re-add the toast
    // with a minimum display time.
    try {
      const entry = await fileToMergeEntry(target);

      setMergeSource(entry);
      setIsMergeOpen(true);
    } catch (err) {
      toast.error({
        title: "Couldn't read this PDF",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const requireSignIn = (
    _description = "Sign in to access this feature. We'll bring you back to the editor.",
    redirectUrl?: string,
  ) => {
    // Snapshot the working editor state before the sign-in redirect so
    // fabric overlays and extractedPages survive the full-page Clerk
    // nav (item #15 finalize). Fire-and-forget — IDB writes are fast
    // and the modal itself gives the user a beat to cancel; awaiting
    // would visibly stall the click.
    void snapshotPendingEditorFile().catch(() => undefined);

    // AuthModal (2026-08-28 unify). The old `description` copy is
    // dropped — the modal's headline is a fixed "Log in" / "Get
    // Started" so we can't customize per caller. The redirectUrl still
    // rides through so the hydrator's post-signin restore path lands
    // the user back on the same editor / tool.
    dispatchAuthModal({
      mode: "login",
      redirectUrl,
    });
  };

  const handleAction = (key: Key) => {
    switch (key) {
      case "new":
        setIsCreatePdfModalOpen(true);
        break;
      case "open":
        fileInputRef.current?.click();
        break;
      case "my-pdfs":
        if (!isSignedIn) {
          requireSignIn(
            "Sign in to open your saved PDFs. You can cancel to keep editing here.",
            ROUTES.APP.DASHBOARD,
          );

          return;
        }
        window.dispatchEvent(
          new CustomEvent("editor:navigate-after-save", {
            detail: { url: ROUTES.APP.DASHBOARD },
          }),
        );
        break;
      case "flatten":
        void runFlatten();
        break;
      case "compress":
        if (!requireFile("compressing")) return;
        setIsCompressModalOpen(true);
        break;
      case "extract-images":
        if (!requireFile("extracting images")) return;
        window.dispatchEvent(new CustomEvent("editor:extract-images"));
        break;
      case "find-replace":
        if (!requireFile("searching")) return;
        setIsFindReplaceOpen(true);
        break;
      case "merge": {
        if (!requireFile("merging")) return;
        // QA 2026-09-07: pre-merge `saveBeforeAction` removed. The
        // save-and-reset cycle triggered `applyPostSaveReset` →
        // pdf.js reload → the editor visibly lost the user's live
        // Fabric overlays. MergePdfModal now does an IN-MEMORY bake
        // at the Merge & Download click (via
        // `editor:build-current-bytes`) so the downloaded PDF
        // includes edits, but the editor session stays intact.
        void openMergeModal();
        break;
      }
      case "split": {
        if (!requireFile("splitting")) return;
        // Same as merge above — SplitPdfModal handles the in-memory
        // bake at download time so the editor doesn't reload.
        void openSplitModal();
        break;
      }
      case "versions": {
        if (!requireFile("viewing version history")) return;
        if (!isSignedIn) {
          requireSignIn(
            "Sign in to view version history for this PDF. Cancel to stay on the editor.",
          );

          return;
        }
        if (!currentDocumentId) {
          toast.info({
            title: "Save first",
            description:
              "Save the document to the cloud at least once to start a version history.",
          });

          return;
        }
        // Persist the current canvas state before opening history so the
        // latest snapshot and the "Current" preview include recent draw /
        // signature edits. We force the save even when the dirty flag is
        // not set, because some tool paths don't reliably flip it.
        //
        // `skipWait: true` because Version History opens against the saved
        // document's history endpoint (server-side); it doesn't read the
        // live `pdfDocument`. Without this the modal never opens when the
        // pdf.js reload of the freshly-saved bytes is slow — same class
        // of bug as the Share flow fixed 2026-08-21.
        void (async () => {
          const ok = await saveBeforeAction(
            "Saving your edits before opening version history.",
            true,
            true,
          );

          if (ok) setIsVersionHistoryModalOpen(true);
        })();
        break;
      }
      case "annotations":
        if (!requireFile("adding annotations")) return;
        // Reset the active tool BEFORE opening the modal so any
        // floating tool panel that's tied to `activeTool` closes.
        // The highlight/watermark/backgroundImage panels in
        // RightSidebar are all conditional on `activeTool === "…"`,
        // and staying on (e.g.) "highlight" leaves the floating
        // panel + tool selection visible behind the Annotations
        // modal (QA 2026-09-07).
        usePdfEditorStore.getState().setActiveTool("select");
        setIsAnnotationsOpen(true);
        break;
      case "share": {
        if (!canShare) return;
        // Bake current edits into the cloud-saved PDF FIRST. Without
        // this the share modal would upload `store.file`, which is the
        // original upload — recipients would see the un-edited PDF.
        //
        // `force: true` mirrors the Save-button flow (`useSaveEditor`,
        // 2026-06-19 skill log). Several edit paths (page-numbers,
        // annotations, restore-from-version) don't flip
        // `hasUnsavedChanges`, so the default `saveBeforeAction`
        // short-circuit would skip the upload and the share would ship
        // the pre-edit bytes. Forcing the save guarantees the recipient
        // sees the latest state at share-generation time.
        //
        // `skipWait: true` because the share modal only reads
        // `store.file` (the fresh bytes are already committed by
        // `applyPostSaveReset` inside the save handler) and never
        // touches `pdfDocument`. Without this the modal waits for
        // pdf.js to reload the newly-saved bytes and never opens when
        // the reload is slow — the "Share only saves, modal never
        // appears" bug reported 2026-08-21.
        void (async () => {
          const ok = await saveBeforeAction(
            "Saving your edits before generating a share link.",
            true,
            true,
          );

          if (ok) setIsShareModalOpen(true);
        })();
        break;
      }
    }
  };

  // Bridge for the top-chrome toolbar: it dispatches these events instead of
  // duplicating file-input / modal-state / guard logic. Each listener runs
  // the SAME switch a menu click would (permission checks, toasts, etc.), so
  // the two entry points can't drift.
  useEffect(() => {
    const handlers: Array<[string, () => void]> = Object.entries(
      BRIDGE_EVENTS,
    ).map(([event, action]) => [event, () => void handleAction(action)]);

    for (const [event, handler] of handlers) {
      window.addEventListener(event, handler);
    }

    return () => {
      for (const [event, handler] of handlers) {
        window.removeEventListener(event, handler);
      }
    };
    // handleAction is redefined per render — that's fine, the listeners are
    // reattached in sync with the closure that owns the current file /
    // signed-in state.
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];

    e.target.value = "";
    if (!selected) return;

    const isAlreadyPdf = selected.type === "application/pdf";
    const loadingKey = isAlreadyPdf
      ? null
      : toast.loading({
          description: `Preparing ${selected.name} for the editor.`,
          title: "Converting to PDF",
        });

    let file: File;

    try {
      file = await uploadAsPdf(selected);
    } catch (err) {
      toast.error({
        description: err instanceof Error ? err.message : undefined,
        title: "Couldn't open file",
      });

      return;
    } finally {
      if (loadingKey) toast.close(loadingKey);
    }

    if (isSignedIn) {
      // Cloud upload + open the new doc in this editor when ready.
      void start({
        file,
        onOpen: (id) => router.push(`${ROUTES.TOOLS.PDF_EDITOR}?id=${id}`),
      });

      return;
    }

    // Signed-out: local-only — preserve previous behavior.
    clearFile();
    setTimeout(() => setFile(file), 0);
  };

  // Guests: hide the visible dropdown per QA 2026-09-05 (menu entries
  // all require signin), but KEEP the rest of this component mounted —
  // the bridge `useEffect` above installs the `editor:open-merge` /
  // `editor:open-split` / `editor:open-flatten` / `editor:open-annotations`
  // listeners that the top toolbar dispatches to. Unmounting HamburgerMenu
  // for guests silently drops those listeners, so Merge / Split / Flatten /
  // Annotate buttons appear idle (QA 2026-09-06). The modal portals below
  // (SplitPdfModal, AnnotationsModal, DuplicateUploadModal) also stay
  // mounted so the paywall-gated handlers can open them.
  return (
    <>
      {isSignedIn && (
        <>
          <Dropdown>
            <Button
              isIconOnly
              aria-label={t("editorMenu")}
              data-tour="editor-menu"
              size="sm"
              variant="tertiary"
            >
              <HugeiconsIcon icon={Menu01Icon} size={16} />
            </Button>
            <Dropdown.Popover className="min-w-[200px]">
              <Dropdown.Menu
                aria-label={t("editorMenu")}
                disabledKeys={canShare ? [] : ["share"]}
                onAction={handleAction}
              >
                <Dropdown.Item id="new" textValue={t("createNew")}>
                  <HugeiconsIcon icon={Add01Icon} size={14} />
                  <Label>{t("createNew")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="open" textValue={t("openFile")}>
                  <HugeiconsIcon icon={FolderOpenIcon} size={14} />
                  <Label>{t("openFile")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="my-pdfs" textValue={t("myPdfs")}>
                  <HugeiconsIcon icon={NoteIcon} size={14} />
                  <Label>{t("myPdfs")}</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  id="find-replace"
                  textValue={t("findReplace")}
                >
                  <HugeiconsIcon icon={Search01Icon} size={14} />
                  <Label>{t("findReplace")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="compress" textValue={t("compressPdf")}>
                  <HugeiconsIcon icon={FileMinusIcon} size={14} />
                  <Label>{t("compressPdf")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="split" textValue={t("splitPdf")}>
                  <HugeiconsIcon icon={SplitIcon} size={14} />
                  <Label>{t("splitPdf")}</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  id="extract-images"
                  textValue={t("extractImages")}
                >
                  <HugeiconsIcon icon={FileExportIcon} size={14} />
                  <Label>{t("extractImages")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="flatten" textValue={t("flattenPdf")}>
                  <HugeiconsIcon icon={Layers01Icon} size={14} />
                  <Label>{t("flattenPdf")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="share" textValue={t("share")}>
                  <HugeiconsIcon icon={Link01Icon} size={14} />
                  <Label>{t("share")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="versions" textValue={t("versionHistory")}>
                  <HugeiconsIcon icon={Clock01Icon} size={14} />
                  <Label>{t("versionHistory")}</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <Separator className="!h-4" orientation="vertical" />
        </>
      )}
      <input
        ref={fileInputRef}
        accept={UPLOAD_ACCEPT_MIME.join(",")}
        className="hidden"
        type="file"
        onChange={handleFileChange}
      />
      <DuplicateUploadModal
        filename={duplicate?.filename ?? null}
        onIgnore={duplicate?.onIgnore ?? (() => undefined)}
        onOverwrite={duplicate?.onOverwrite ?? (() => undefined)}
      />
      <AnnotationsModal
        isOpen={isAnnotationsOpen}
        onClose={() => setIsAnnotationsOpen(false)}
      />
      <SplitPdfModal
        isOpen={isSplitOpen}
        source={splitSource}
        onClose={() => {
          setIsSplitOpen(false);
          // Hold the source one tick so closing animations don't see a
          // sudden empty modal. Cleared on next open via re-read.
          setTimeout(() => setSplitSource(null), 200);
        }}
      />
    </>
  );
}
