"use client";

import type { Canvas } from "fabric";
import type { ManagePagesDraftSnapshot } from "@/lib/client/hooks/pdf-editor/manage-pages-types";

import { useAuth } from "@clerk/nextjs";
import { GeistSans } from "geist/font/sans";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import "@/app/(landing)/landing-theme.css";
import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { LandingHeader } from "@/components/sections/new-landing/landing-header";
import { uploadAsPdf } from "@/lib/client/file-conversion/upload-to-pdf";
import { loadPdfJs } from "@/lib/client/pdf-editor/load-pdfjs";
import { useAnnotationsEditor } from "@/lib/client/hooks/pdf-editor/use-annotations-editor";
import { useEditorDocumentLoader } from "@/lib/client/hooks/pdf-editor/use-editor-document-loader";
import { useExportEditor } from "@/lib/client/hooks/pdf-editor/use-export-editor";
import { useExtractImagesEditor } from "@/lib/client/hooks/pdf-editor/use-extract-images-editor";
import { useFormFieldsEditor } from "@/lib/client/hooks/pdf-editor/use-form-fields-editor";
import { usePageNumbersEditor } from "@/lib/client/hooks/pdf-editor/use-page-numbers-editor";
import { usePdfLoader } from "@/lib/client/hooks/pdf-editor/use-pdf-loader";
import { usePdfSearch } from "@/lib/client/hooks/pdf-editor/use-pdf-search";
import { useEditorAutoPersist } from "@/lib/client/hooks/pdf-editor/use-editor-auto-persist";
import { useEditorNavigationSave } from "@/lib/client/hooks/pdf-editor/use-editor-navigation-save";
import { useSaveEditor } from "@/lib/client/hooks/pdf-editor/use-save-editor";
import { useSignedOutAutoPersist } from "@/lib/client/hooks/pdf-editor/use-signed-out-auto-persist";
import { useIsMobile } from "@/lib/client/hooks/use-is-mobile";
import { useProductTour } from "@/lib/client/tour/use-product-tour";
import { buildPdfFromDraft } from "@/lib/client/pdf-editor/build-pages-pdf";
import { remapFabricAfterPageOps } from "@/lib/client/pdf-editor/remap-fabric-after-page-ops";
import {
  detectPageNumberFormat,
  formatPageNumberLabel,
  renumberPageNumbersInFabricJson,
} from "@/lib/client/pdf-editor/renumber-page-numbers";
import { sanitizeSourceBytesForPdfLib } from "@/lib/client/pdf-editor/sanitize-source-bytes";
import { flushLiveFabricPage } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { toast } from "@/lib/shared/utils/toast";

import { BottomDock } from "./BottomDock";
import { EditorInfoBar } from "./EditorTopBar";
import { EditorLoadingShell } from "./EditorLoadingShell";
import { PdfSearchBar } from "./PdfSearchBar";
import { PdfViewerCanvas } from "./PdfViewerCanvas";
import { TopAppBar, ToolToolbar } from "./PvEditorTopChrome";
import { RightSidebar } from "./RightSidebar";
import { ThumbnailSidebar } from "./ThumbnailSidebar";

// Heavy modals — lazy-loaded so they don't inflate the editor's initial bundle.
const CompressModal = dynamic(
  () => import("./CompressModal").then((m) => m.CompressModal),
  { ssr: false, loading: () => null },
);
const CreatePdfModal = dynamic(
  () => import("./CreatePdfModal").then((m) => m.CreatePdfModal),
  { ssr: false, loading: () => null },
);
const FindReplaceModal = dynamic(
  () => import("./FindReplaceModal").then((m) => m.FindReplaceModal),
  { ssr: false, loading: () => null },
);
const FormFieldsModal = dynamic(
  () => import("./FormFieldsModal").then((m) => m.FormFieldsModal),
  { ssr: false, loading: () => null },
);
const ManagePagesModal = dynamic(
  () => import("./ManagePagesModal").then((m) => m.ManagePagesModal),
  { ssr: false, loading: () => null },
);
const PageNumbersModal = dynamic(
  () => import("./PageNumbersModal").then((m) => m.PageNumbersModal),
  { ssr: false, loading: () => null },
);
const ReloadConfirmModal = dynamic(
  () => import("./ReloadConfirmModal").then((m) => m.ReloadConfirmModal),
  { ssr: false, loading: () => null },
);
const PasswordModal = dynamic(
  () => import("./PasswordModal").then((m) => m.PasswordModal),
  { ssr: false, loading: () => null },
);
// Mounted at shell level (not inside HamburgerMenu) so the modal survives
// the EditorLayout unmount that fires during the post-save pdf.js reload
// — see comment in ShareModal.tsx for the full trace.
const ShareModal = dynamic(
  () => import("./ShareModal").then((m) => m.ShareModal),
  { ssr: false, loading: () => null },
);
// Same shell-level pattern as ShareModal — Version History runs a
// `saveBeforeAction` before opening which triggers a pdf.js reload
// that unmounts `HamburgerMenu`, wiping any local modal state.
const VersionHistoryModalHost = dynamic(
  () =>
    import("./VersionHistoryModalHost").then((m) => m.VersionHistoryModalHost),
  { ssr: false, loading: () => null },
);
// Same shell-level pattern — Merge runs a `saveBeforeAction` (added
// 2026-08-24 so shapes/drawings/images are baked into the source
// before merging with additional PDFs) which triggers a pdf.js reload
// that unmounts `HamburgerMenu`. Open state + source live in the
// store (`isMergeModalOpen` / `mergeModalSource`) so the modal
// appears once the reset lands.
const MergeModalHost = dynamic(
  () => import("./MergeModalHost").then((m) => m.MergeModalHost),
  { ssr: false, loading: () => null },
);
const PerformancePanel = dynamic(
  () => import("./PerformancePanel").then((m) => m.PerformancePanel),
  { ssr: false, loading: () => null },
);

const ACCEPT_EXTENSIONS = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
const ACCEPT_ATTR = ACCEPT_EXTENSIONS.map((ext) => `.${ext}`).join(",");

/**
 * Composer upload screen — mirrors the `/convert/[slug]` hero
 * ("Drag & drop file to edit" + "Upload to Edit" + "Size upto 100 MB")
 * so every upload surface in the app looks the same (QA 2026-08-27).
 * Unlike `UploadWorkspace` this stays put on `/pdf-composer` after the
 * drop — the hydrator's Step 3 auto-save handles library persistence
 * for signed-in users; navigation would double-fetch through
 * `useEditorDocumentLoader`.
 */
function UploadScreen() {
  const setFile = usePdfEditorStore((s) => s.setFile);
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tool = searchParams.get("tool");
  const isUnlockTool = tool === "unlock" || tool === "password";
  const heading = isUnlockTool
    ? "Drag & drop file to unlock"
    : "Drag & drop file to edit";
  const ctaLabel = isUnlockTool ? "Upload to Unlock" : "Upload to Edit";

  const handleSelect = async (picked: File) => {
    const extension = picked.name.split(".").pop()?.toLowerCase() ?? "";

    if (!ACCEPT_EXTENSIONS.includes(extension)) {
      setError(
        `We can't open .${extension || "this"} files here. Supported: ${ACCEPT_EXTENSIONS.map((e) => `.${e}`).join(", ")}.`,
      );

      return;
    }
    setError(null);
    const isAlreadyPdf = picked.type === "application/pdf";
    const loadingKey = isAlreadyPdf
      ? null
      : toast.loading({
          description: `Preparing ${picked.name} for the editor.`,
          title: "Converting to PDF",
        });

    try {
      const pdfFile = await uploadAsPdf(picked);

      setFile(pdfFile);
    } catch (err) {
      toast.error({
        description: err instanceof Error ? err.message : undefined,
        title: "Couldn't open file",
      });
    } finally {
      if (loadingKey) toast.close(loadingKey);
    }
  };

  const openPicker = () => inputRef.current?.click();

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const picked = event.dataTransfer.files?.[0];

    if (picked) void handleSelect(picked);
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];

    if (picked) void handleSelect(picked);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onZoneKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div
      className={`${GeistSans.variable} pdfvault-landing flex flex-1 flex-col overflow-y-auto bg-white`}
    >
      <LandingHeader />
      <main>
        <section className="bg-white pt-14 pb-8 sm:pt-20 sm:pb-10">
          <div className="pv-container flex flex-col items-center text-center">
            <Link
              className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-[#5f5f5f] transition-colors hover:text-[var(--pv-brand-red,#f12c23)]"
              href="/"
            >
              <span aria-hidden>←</span> Back to all tools
            </Link>
            <h1 className="pv-display max-w-[820px] text-[#121212]">
              PDF Composer
            </h1>
            <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-[var(--pv-text-secondary)]">
              Drop a PDF, Word, Excel, PowerPoint, or image file and start
              editing right in your browser.
            </p>
          </div>
        </section>
        <section className="pb-20">
          <div className="mx-auto w-full max-w-[880px] px-6">
            <div className="mx-auto w-full max-w-[820px]">
              <div className="rounded-[24px] border border-black/5 bg-white p-[14px] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <div
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
                      stroke={
                        dragActive ? "var(--pv-brand-primary)" : "#CCCCCC"
                      }
                      strokeDasharray="10 8"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                      width="99"
                      x="0.5"
                      y="0.5"
                    />
                  </svg>
                  <input
                    ref={inputRef}
                    accept={ACCEPT_ATTR}
                    className="sr-only"
                    type="file"
                    onChange={onInputChange}
                  />
                  <Image
                    priority
                    alt=""
                    className="h-auto w-[84px] object-contain"
                    height={72}
                    src="/landing/Group.png"
                    width={84}
                  />
                  <h2 className="mt-6 text-[22px] font-semibold leading-[28px] text-[#121212] sm:text-[24px] sm:leading-[30px]">
                    {heading}
                  </h2>
                  <div className="mt-6 flex w-full max-w-[360px] items-center gap-3 text-[13px] font-medium uppercase tracking-[0.08em] text-[#B4B4B4]">
                    <span aria-hidden className="h-px flex-1 bg-[#E5E5E5]" />
                    <span>OR</span>
                    <span aria-hidden className="h-px flex-1 bg-[#E5E5E5]" />
                  </div>
                  <button
                    className="mt-6 inline-flex h-11 min-w-[184px] cursor-pointer items-center justify-center rounded-full bg-[#F12C23] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#d91f16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F12C23]"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openPicker();
                    }}
                  >
                    {ctaLabel}
                  </button>
                  <p className="mt-5 text-[14px] text-[#8A8A8A]">
                    Size upto 100 MB
                  </p>
                  {error ? (
                    <p
                      className="mt-4 text-[14px] text-[var(--pv-error,#dc2626)]"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}

function EditorLayout() {
  const { error, isLoading } = usePdfLoader();
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  // Sticky store latch — flips to true the first time a non-null doc
  // lands and stays true across subsequent reloads (post-save file
  // swap, restore-version). Read below so `isLoading` cycles after
  // the first paint don't blank the editor to `<EditorLoadingShell />`.
  // The Fabric canvas + `usePageRenderer` still cycle correctly (see
  // `PdfViewerCanvas.effectivePage` + `usePageRenderer` line 165) so
  // the sweep-then-remount sync that keeps the merge pipeline honest
  // is preserved. QA report 2026-08-24 ("save reloads the pdf which
  // is bad UX behaviour").
  const hasEverLoaded = usePdfEditorStore((s) => s.hasEverLoadedPdf);
  const isManagePagesOpen = usePdfEditorStore((s) => s.isManagePagesOpen);
  const applyManagePagesSave = usePdfEditorStore((s) => s.applyManagePagesSave);
  const file = usePdfEditorStore((s) => s.file);
  const fabricJsonByPage = usePdfEditorStore((s) => s.fabricJsonByPage);
  const historyByPage = usePdfEditorStore((s) => s.historyByPage);
  const historyIndexByPage = usePdfEditorStore((s) => s.historyIndexByPage);
  const reorderPages = usePdfEditorStore((s) => s.reorderPages);
  const replaceFabricJsonByPage = usePdfEditorStore(
    (s) => s.replaceFabricJsonByPage,
  );
  const setIsManagePagesOpen = usePdfEditorStore((s) => s.setIsManagePagesOpen);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
  const [isPerformancePanelOpen, setIsPerformancePanelOpen] = useState(false);
  const isMobile = useIsMobile();

  useSaveEditor(fabricCanvas);
  useEditorAutoPersist(fabricCanvas);
  useEditorNavigationSave(fabricCanvas);
  useExportEditor(fabricCanvas);
  useExtractImagesEditor(fabricCanvas);
  usePageNumbersEditor(fabricCanvas);
  useFormFieldsEditor(fabricCanvas);
  useAnnotationsEditor(fabricCanvas);
  useSignedOutAutoPersist(fabricCanvas);

  const { goToNext: searchGoToNext, goToPrev: searchGoToPrev } = usePdfSearch();

  useProductTour("editor");

  const handleFabricCanvasReady = useCallback(
    (canvas: Canvas | null) => setFabricCanvas(canvas),
    [],
  );

  const handleReorderPages = useCallback(
    (fromDisplay: number, toDisplay: number) => {
      if (fabricCanvas) {
        flushLiveFabricPage(currentPage, fabricCanvas);
      }

      reorderPages(fromDisplay, toDisplay);

      // After the reorder, page-number IText overlays on each page
      // still read the OLD display number ("Page 3 of 10" stuck on
      // what is now slot 1). The store's reorder doesn't touch overlay
      // contents — it only permutes `pageOrder`. Walk the (source-keyed)
      // fabricJsonByPage and rewrite each detected page-number label
      // to match its NEW display slot. No-op when no page-number
      // overlays exist.
      const afterState = usePdfEditorStore.getState();
      const newPageOrder = afterState.pageOrder;
      const sourceToDisplay = new Map<number, number>();

      newPageOrder.forEach((sourceIdx, i) => {
        sourceToDisplay.set(sourceIdx, i + 1);
      });

      const renumbered = renumberPageNumbersInFabricJson(
        afterState.fabricJsonByPage,
        (sourceKey) => sourceToDisplay.get(sourceKey) ?? null,
      );

      if (renumbered !== afterState.fabricJsonByPage) {
        replaceFabricJsonByPage(renumbered);

        // The stored JSON now matches the new arrangement, but the
        // LIVE canvas (currently mounted on whatever source page the
        // user was viewing) still holds the old IText instance with
        // the stale label. If that source page has a page-number
        // overlay, update its `text` in place so the user sees the
        // new number without a remount.
        if (fabricCanvas) {
          const currentSource =
            afterState.pageOrder[afterState.currentPage - 1];
          const currentSlot = sourceToDisplay.get(currentSource);
          const totalPages = newPageOrder.length;

          if (currentSlot !== undefined) {
            fabricCanvas.getObjects().forEach((obj) => {
              const editorType = (obj as { editorType?: string }).editorType;

              if (editorType !== "pageNumber") return;
              const iText = obj as unknown as {
                text?: string;
                set: (key: string, value: unknown) => void;
                dirty?: boolean;
              };
              const detected = detectPageNumberFormat(String(iText.text ?? ""));

              if (!detected) return;
              const newLabel = formatPageNumberLabel(
                detected.format,
                currentSlot,
                totalPages,
              );

              if (iText.text === newLabel) return;
              iText.set("text", newLabel);
              iText.dirty = true;
            });
            fabricCanvas.requestRenderAll();
          }
        }
      }
    },
    [currentPage, fabricCanvas, replaceFabricJsonByPage, reorderPages],
  );

  const handleManagePagesSave = useCallback(
    async (snapshot: ManagePagesDraftSnapshot) => {
      if (!file) return;

      if (fabricCanvas) {
        flushLiveFabricPage(currentPage, fabricCanvas);
      }

      try {
        const rawSourceBytes = await file.arrayBuffer();
        const sourceBytes = pdfDocument
          ? await sanitizeSourceBytesForPdfLib(rawSourceBytes, pdfDocument)
          : rawSourceBytes;
        const bytes = await buildPdfFromDraft({
          importedPdfs: snapshot.importedPdfs,
          pages: snapshot.pages,
          pdfDocument,
          sourceBytes,
        });
        const newFile = new File([Uint8Array.from(bytes)], file.name, {
          type: "application/pdf",
        });
        const remapped = remapFabricAfterPageOps({
          newPages: snapshot.pages,
          oldFabricJsonByPage: fabricJsonByPage,
          oldHistoryByPage: historyByPage,
          oldHistoryIndexByPage: historyIndexByPage,
        });
        // Reordering / deleting / duplicating pages leaves the
        // page-number IText labels stale ("Page 5 of 10" stuck on what
        // is now slot 2). Renumber overlays here so the labels match
        // the new slot order. No-op when no page-number overlays exist
        // — returns the same Map by reference.
        const renumberedFabricJson = renumberPageNumbersInFabricJson(
          remapped.fabricJsonByPage,
        );
        const newPageCount = snapshot.pages.length;
        const clampedPage = Math.min(currentPage, Math.max(1, newPageCount));

        applyManagePagesSave({
          currentPage: clampedPage,
          fabricJsonByPage: renumberedFabricJson,
          file: newFile,
          historyByPage: remapped.historyByPage,
          historyIndexByPage: remapped.historyIndexByPage,
        });
      } catch {
        toast.error({
          title: "Could not apply page changes",
          description: "Saving your page edits failed. Please try again.",
        });
      }
    },
    [
      applyManagePagesSave,
      currentPage,
      fabricCanvas,
      fabricJsonByPage,
      file,
      historyByPage,
      historyIndexByPage,
    ],
  );

  // Only show the full loading shell on the FIRST load. Subsequent
  // reloads (post-save file swap, restore-version) keep the previous
  // frame visible so the user doesn't see a jarring blank flash after
  // every Save — the pdf.js re-parse is invisible; the Fabric layer
  // briefly disappears and reappears with the swept overlays.
  if (isLoading && !hasEverLoaded) {
    return <EditorLoadingShell />;
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-red-500">{error}</span>
      </div>
    );
  }

  // Once we've rendered at least one doc, keep the editor tree mounted
  // even while `pdfDocument` is momentarily null (post-save reload,
  // restore-version). The pdf.js canvas element retains its last-
  // rendered frame so the user sees the previous content until the
  // new doc lands. The Fabric layer + tool components handle a null
  // pdfDocument safely (grep for `!pdfDocument` in child components).
  if (!pdfDocument && !hasEverLoaded) return null;

  const managePagesModal = (
    <ManagePagesModal
      isOpen={isManagePagesOpen}
      onClose={() => setIsManagePagesOpen(false)}
      onSave={handleManagePagesSave}
    />
  );

  // Mounted inside EditorLayout (not the outer shell) because it needs the
  // live `fabricCanvas` ref to mutate the current page's IText overlays.
  const findReplaceModal = <FindReplaceModal fabricCanvas={fabricCanvas} />;

  if (isMobile) {
    return (
      <>
        <EditorInfoBar />
        <div className="relative flex flex-1 overflow-hidden">
          <PdfSearchBar goToNext={searchGoToNext} goToPrev={searchGoToPrev} />
          <PdfViewerCanvas onFabricCanvasReady={handleFabricCanvasReady} />
          <div className="pointer-events-none absolute right-4 top-4 z-10">
            <div className="pointer-events-auto">
              <PerformancePanel
                fabricCanvas={fabricCanvas}
                isOpen={isPerformancePanelOpen}
                setIsOpen={setIsPerformancePanelOpen}
              />
            </div>
          </div>
        </div>
        <BottomDock
          fabricCanvas={fabricCanvas}
          onReorderPages={handleReorderPages}
        />
        {managePagesModal}
        {findReplaceModal}
      </>
    );
  }

  return (
    <>
      <TopAppBar />
      <div className="relative flex flex-1 overflow-hidden">
        <ThumbnailSidebar onReorderPages={handleReorderPages} />
        <div className="relative flex flex-1 flex-col overflow-hidden bg-[var(--pv-canvas,#f5f5f7)]">
          <ToolToolbar />
          <PdfSearchBar goToNext={searchGoToNext} goToPrev={searchGoToPrev} />
          <PdfViewerCanvas onFabricCanvasReady={handleFabricCanvasReady} />
        </div>
        <RightSidebar fabricCanvas={fabricCanvas} />

        <div className="pointer-events-none absolute bottom-4 right-[17rem] z-10">
          <div className="pointer-events-auto">
            <PerformancePanel
              fabricCanvas={fabricCanvas}
              isOpen={isPerformancePanelOpen}
              setIsOpen={setIsPerformancePanelOpen}
            />
          </div>
        </div>
      </div>
      {managePagesModal}
      {findReplaceModal}
    </>
  );
}

export function PdfEditorShell() {
  const { isSignedIn } = useAuth();
  const shellSearchParams = useSearchParams();

  // Synchronous fresh-entry clear — runs BEFORE the store selectors
  // below read `file` on first render. Kills the stale-file →
  // <EditorLayout /> → usePdfLoader → <EditorLoadingShell /> race that
  // leaves users stuck on the composer loader after in-SPA navigation
  // (composer → landing → tool-tile → composer). The hydrator also
  // clears in its effect, but effects run AFTER first render, so
  // <EditorLayout /> would still mount for a frame and kick off a pdf.js
  // parse against a stale File. useState's initializer is the standard
  // "run once before first render" hook; the return value is ignored.
  useState(() => {
    if (
      shellSearchParams.get("fresh") === "1" &&
      !shellSearchParams.get("id")
    ) {
      usePdfEditorStore.getState().clearFile();
    }

    return true;
  });

  // Reset any leftover `postSaveReloadPending` from a prior shell
  // instance that unmounted mid-save-reload — most commonly the
  // Hamburger → "My PDFs" flow, where `useEditorNavigationSave` fires
  // `applyPostSaveReset(savedFile)` (sets the flag true) and
  // immediately `router.push('/dashboard')`. The shell unmounts before
  // `editor:post-save-render-done` can dispatch, so
  // `clearPostSaveReloadPending()` never runs. On the next PDF open
  // the flag is still true, which makes `usePdfLoader` skip clearing
  // the destroyed `pdfDocument` proxy from the store — subsequent
  // `pdfDocument.getPage()` calls (in `PdfViewerCanvas`) then throw
  // synchronously with `Cannot read properties of null (reading
  // 'sendWithPromise')` because the proxy's `messageHandler` was
  // nulled by the previous unmount's `loadingTask.destroy()`. The flag
  // is only meaningful within a single mounted shell lifetime, so
  // clearing it at mount time is safe — a genuine in-session save-
  // reload sets it AFTER this initializer runs. QA repro
  // 2026-08-25: edit → hamburger → My PDFs → re-open same PDF →
  // "Something went wrong. The tool failed to load."
  useState(() => {
    const state = usePdfEditorStore.getState();

    if (state.postSaveReloadPending) {
      // Also clear the stale pdfDocument. If the flag was stuck true,
      // the store still holds the destroyed proxy from the previous
      // session — `usePdfLoader` won't clear it (flag guard), and
      // `PdfViewerCanvas` reads directly from the store on mount, so
      // we need to null it here BEFORE any child hook runs a read.
      state.setPdfDocument(null, 0);
      state.clearPostSaveReloadPending();
    }

    return true;
  });

  const file = usePdfEditorStore((s) => s.file);
  const createPdfModalKey = usePdfEditorStore((s) => s.createPdfModalKey);
  const isCreatePdfModalOpen = usePdfEditorStore((s) => s.isCreatePdfModalOpen);
  const setIsCreatePdfModalOpen = usePdfEditorStore(
    (s) => s.setIsCreatePdfModalOpen,
  );
  const setIsSignedIn = usePdfEditorStore((s) => s.setIsSignedIn);
  const pendingDocumentId = shellSearchParams.get("id");
  // QA 2026-08-27: signed-in user opens a locked file on `/unlock-pdf` (or
  // any `?tool=unlock` entry) — the PasswordModal opens over the editor,
  // but the loaded PDF content is still readable behind the backdrop,
  // "which makes the password protection a bit useless." Blur the editor
  // shell while unlock is pending so the content stays obscured until
  // the correct password is entered. HeroUI's Modal portals to
  // `document.body`, so blurring this wrapper doesn't affect the modal.
  const isPasswordModalOpen = usePdfEditorStore((s) => s.isPasswordModalOpen);
  const passwordModalVariant = usePdfEditorStore((s) => s.passwordModalVariant);
  const blurUnderlyingContent =
    isPasswordModalOpen && passwordModalVariant === "unlock-only";

  useEditorDocumentLoader();

  useEffect(() => {
    setIsSignedIn(isSignedIn ?? false);
  }, [isSignedIn, setIsSignedIn]);

  // PRD §7.1 — prefetch the pdf.js legacy build + worker as soon as the
  // editor mounts, so the first file lands into a warm module cache. On a
  // cold session this saves ~200–800ms depending on browser cache state
  // (the module + `pdf.worker.min.mjs` fetches are the bulk of first-
  // upload variability). Fire-and-forget; loadPdfJs handles polyfills
  // and the dynamic import is memoized by the runtime, so a subsequent
  // real `usePdfLoader` call gets the cached module for free.
  useEffect(() => {
    void loadPdfJs().catch(() => {
      // Prefetch failures are harmless — the real load call surfaces
      // the error to the user with the friendly PasswordException /
      // InvalidPDFException / generic branches in usePdfLoader.
    });
  }, []);

  const isRestoringSession = usePdfEditorStore((s) => s.isRestoringSession);

  // Loader is authoritative on two signals now:
  //  - `pendingDocumentId` — URL carries `?id=`, doc loader is fetching
  //  - `isRestoringSession` — hydrator's IDB probe + optional
  //    save-first upload are in flight. Flag flips off in the
  //    hydrator's `finally` regardless of which branch it took.
  //
  // Before 2026-07-23 there was a third gate keyed off the URL alone
  // (`?tool=` or `?export=` with no `?id=`) meant to prevent a
  // drop-zone flash on post-signin returns. It caused the "stuck on
  // loading PDF" bug when a user landed on `/pdf-composer?fresh=1&tool=X`
  // with an empty IDB: nothing to hydrate, nothing to upload, but the
  // loader stayed up forever. Bounding the loader to
  // `isRestoringSession` gives us the same flash-suppression without
  // the stuck state, because the hydrator sets that flag at the very
  // top of its effect.
  let content: React.ReactNode;

  if (file) {
    content = <EditorLayout />;
  } else if (pendingDocumentId || isRestoringSession) {
    content = <EditorLoadingShell />;
  } else {
    content = <UploadScreen />;
  }

  return (
    <div className="flex h-full flex-col">
      <div
        aria-hidden={blurUnderlyingContent || undefined}
        className={`flex h-full flex-col transition-[filter] duration-200 ${
          blurUnderlyingContent ? "pointer-events-none select-none blur-lg" : ""
        }`}
      >
        {content}
      </div>
      <CreatePdfModal
        key={createPdfModalKey}
        isOpen={isCreatePdfModalOpen}
        onClose={() => setIsCreatePdfModalOpen(false)}
      />
      <CompressModal />
      <PasswordModal />
      <ShareModal />
      <VersionHistoryModalHost />
      <MergeModalHost />
      <PageNumbersModal />
      <FormFieldsModal />
      <ReloadConfirmModal />
    </div>
  );
}
