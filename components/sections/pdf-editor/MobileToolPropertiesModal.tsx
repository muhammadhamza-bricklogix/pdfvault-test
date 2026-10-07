"use client";

import { Modal } from "@heroui/react";
import { useEffect } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

import { BackgroundImagePropertiesContent } from "./BackgroundImagePropertiesContent";
import { WatermarkPropertiesContent } from "./WatermarkPropertiesContent";

/**
 * On mobile the RightSidebar isn't mounted, so watermark / background-image
 * config has no UI. This modal surfaces those panels: it auto-opens when the
 * active tool is one that needs configuration, and closes by reverting the
 * tool to "select".
 */
export function MobileToolPropertiesModal() {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);

  // Row 85/92 QA 2026-10-04: subscribe to the other editor-level
  // modal flags so this modal can auto-close when any of them opens.
  // Without this, opening Password / Compress / Manage Pages / etc.
  // while the Background-image or Watermark modal is up stacked two
  // modals on screen with overlapping controls (user report: "Background
  // modal and Edit modal can remain open at the same time, causing
  // overlapping controls and UI confusion").
  const isCompressModalOpen = usePdfEditorStore((s) => s.isCompressModalOpen);
  const isPasswordModalOpen = usePdfEditorStore((s) => s.isPasswordModalOpen);
  const isCreatePdfModalOpen = usePdfEditorStore((s) => s.isCreatePdfModalOpen);
  const isManagePagesOpen = usePdfEditorStore((s) => s.isManagePagesOpen);
  const isMergeModalOpen = usePdfEditorStore((s) => s.isMergeModalOpen);
  const isPageNumbersModalOpen = usePdfEditorStore(
    (s) => s.isPageNumbersModalOpen,
  );
  const isFindReplaceOpen = usePdfEditorStore((s) => s.isFindReplaceOpen);
  const isFormFieldsModalOpen = usePdfEditorStore(
    (s) => s.isFormFieldsModalOpen,
  );
  const isShareModalOpen = usePdfEditorStore((s) => s.isShareModalOpen);
  const isVersionHistoryModalOpen = usePdfEditorStore(
    (s) => s.isVersionHistoryModalOpen,
  );
  const isSignatureModalOpen = usePdfEditorStore((s) => s.isSignatureModalOpen);

  const anotherModalOpen =
    isCompressModalOpen ||
    isPasswordModalOpen ||
    isCreatePdfModalOpen ||
    isManagePagesOpen ||
    isMergeModalOpen ||
    isPageNumbersModalOpen ||
    isFindReplaceOpen ||
    isFormFieldsModalOpen ||
    isShareModalOpen ||
    isVersionHistoryModalOpen ||
    isSignatureModalOpen;

  const isWatermark = activeTool === "watermark";
  const isBackgroundImage = activeTool === "backgroundImage";
  const isOpen = (isWatermark || isBackgroundImage) && !anotherModalOpen;

  const close = () => setActiveTool("select");

  // When another editor modal opens on top of us, give up focus and
  // reset the tool so re-opening Watermark / Background from the dock
  // after dismissing the other modal starts fresh.
  useEffect(() => {
    if (anotherModalOpen && (isWatermark || isBackgroundImage)) {
      setActiveTool("select");
    }
  }, [anotherModalOpen, isWatermark, isBackgroundImage, setActiveTool]);

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="flex !max-h-[80dvh] !w-[92vw] !max-w-[420px] flex-col overflow-hidden">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>
              {isWatermark ? "Watermark" : "Background image"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            {isWatermark && (
              <WatermarkPropertiesContent scrollContainer={false} />
            )}
            {isBackgroundImage && (
              <BackgroundImagePropertiesContent scrollContainer={false} />
            )}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
