"use client";

import type { Key } from "@heroui/react";

import {
  Add01Icon,
  Clock01Icon,
  FolderOpenIcon,
  Menu01Icon,
  NoteIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Dropdown, Label, Separator } from "@heroui/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  UPLOAD_ACCEPT_MIME,
  uploadAsPdf,
} from "@/lib/client/file-conversion/upload-to-pdf";
import { DuplicateUploadModal } from "@/components/sections/dashboard/duplicate-upload-modal";
import { dispatchSignInPrompt } from "@/components/shared/sign-in-prompt-modal";
import { reloadEditorFromDocument } from "@/lib/client/hooks/pdf-editor/use-editor-document-loader";
import { saveBeforeAction } from "@/lib/client/pdf-editor/save-before-action";
import { useFlattenFileMutation } from "@/lib/client/query/mutations";
import { usePdfEditorStore } from "@/lib/client/stores";
import { useUploadWithDuplicateCheck } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { ROUTES } from "@/lib/shared/constants/routes";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { toast } from "@/lib/shared/utils/toast";

import { AnnotationsModal } from "./AnnotationsModal";
import { ShareModal } from "./ShareModal";
import { SplitPdfModal, type SplitPdfModalSource } from "./SplitPdfModal";
import { VersionHistoryModal } from "./VersionHistoryModal";

// Actions still triggered by PvEditorTopChrome that need modal state /
// hidden-input machinery owned by this component. The top toolbar dispatches
// these events; we handle them via the same switch a menu click would use so
// there's one source of truth for the guards (sign-in, requireFile, etc.).
const BRIDGE_EVENTS = {
  "editor:open-split": "split",
  "editor:open-share": "share",
  "editor:open-annotations": "annotations",
  "editor:open-flatten": "flatten",
} as const;

export function HamburgerMenu() {
  const { userId } = useAuth();
  const clearFile = usePdfEditorStore((s) => s.clearFile);
  const file = usePdfEditorStore((s) => s.file);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setIsFindReplaceOpen = usePdfEditorStore((s) => s.setIsFindReplaceOpen);
  const setIsCreatePdfModalOpen = usePdfEditorStore(
    (s) => s.setIsCreatePdfModalOpen,
  );
  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [isAnnotationsOpen, setIsAnnotationsOpen] = useState(false);
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const [splitSource, setSplitSource] = useState<SplitPdfModalSource | null>(
    null,
  );
  const router = useRouter();
  const { duplicate, start } = useUploadWithDuplicateCheck();
  const flatten = useFlattenFileMutation();

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

  const runFlatten = async () => {
    const f = requireFile("flattening");

    if (!f) return;
    try {
      const result = await flatten.mutateAsync({ file: f });

      triggerBlobDownload(result.blob, result.fileName);
    } catch {
      // toast already shown by the mutation
    }
  };

  const openSplitModal = async () => {
    const target = requireFile("splitting");

    if (!target) return;

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

  const requireSignIn = (
    description = "Sign in to access this feature. We'll bring you back to the editor.",
    redirectUrl?: string,
  ) => {
    dispatchSignInPrompt({
      title: "Sign in required",
      description,
      confirmLabel: "Sign in & continue",
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
      case "find-replace":
        if (!requireFile("searching")) return;
        setIsFindReplaceOpen(true);
        break;
      case "split":
        void openSplitModal();
        break;
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
        void (async () => {
          const ok = await saveBeforeAction(
            "Saving your edits before opening version history.",
            true,
          );

          if (ok) setIsVersionsOpen(true);
        })();
        break;
      }
      case "annotations":
        if (!requireFile("adding annotations")) return;
        setIsAnnotationsOpen(true);
        break;
      case "share": {
        if (!requireFile("sharing")) return;
        if (!isSignedIn) {
          requireSignIn(
            "Sign in to share this PDF with a public link. Cancel to keep editing.",
          );

          return;
        }
        // Bake current edits into the cloud-saved PDF FIRST. Without
        // this the share modal would upload `store.file`, which is the
        // original upload — recipients would see the un-edited PDF.
        // `saveBeforeAction` short-circuits when there are no unsaved
        // changes, so this is free if the user already saved.
        void (async () => {
          const ok = await saveBeforeAction(
            "Saving your edits before generating a share link.",
          );

          if (ok) setIsShareOpen(true);
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

  return (
    <>
      <Dropdown>
        <Button
          isIconOnly
          aria-label="Editor menu"
          size="sm"
          variant="tertiary"
        >
          <HugeiconsIcon icon={Menu01Icon} size={16} />
        </Button>
        <Dropdown.Popover className="min-w-[200px]">
          <Dropdown.Menu aria-label="Editor menu" onAction={handleAction}>
            <Dropdown.Item id="new" textValue="Create New">
              <HugeiconsIcon icon={Add01Icon} size={14} />
              <Label>Create New</Label>
            </Dropdown.Item>
            <Dropdown.Item id="open" textValue="Open File">
              <HugeiconsIcon icon={FolderOpenIcon} size={14} />
              <Label>Open File</Label>
            </Dropdown.Item>
            <Dropdown.Item id="my-pdfs" textValue="My PDFs">
              <HugeiconsIcon icon={NoteIcon} size={14} />
              <Label>My PDFs</Label>
            </Dropdown.Item>
            <Dropdown.Item id="find-replace" textValue="Find and Replace">
              <HugeiconsIcon icon={Search01Icon} size={14} />
              <Label>Find and Replace</Label>
            </Dropdown.Item>
            <Dropdown.Item id="versions" textValue="Version History">
              <HugeiconsIcon icon={Clock01Icon} size={14} />
              <Label>Version History</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <Separator className="!h-4" orientation="vertical" />
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
      <ShareModal
        file={file}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
      <VersionHistoryModal
        documentId={currentDocumentId}
        isOpen={isVersionsOpen}
        onClose={() => setIsVersionsOpen(false)}
        onRestored={(restored, restoredFileUrl) => {
          // Fetch the restored bytes directly and swap them into the
          // store. Relying on `clearFile()` to bounce the loader effect
          // wasn't firing deterministically for every user (QA report
          // 2026-07-23: "restore succeeds but I have to refresh").
          // We use the immutable version-snapshot URL for the initial load
          // because the root document URL can still point at the pre-restore
          // bytes for a short window after the API returns.
          void reloadEditorFromDocument(
            restored,
            userId,
            restoredFileUrl,
          ).catch((err) => {
            toast.error({
              title: "Couldn't reload restored version",
              description:
                err instanceof Error
                  ? err.message
                  : "Please refresh to see the restored version.",
            });
          });
        }}
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
