"use client";

import { Modal } from "@heroui/react";

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

  const isWatermark = activeTool === "watermark";
  const isBackgroundImage = activeTool === "backgroundImage";
  const isOpen = isWatermark || isBackgroundImage;

  const close = () => setActiveTool("select");

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="!max-h-[80vh] !w-[92vw] !max-w-[420px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>
              {isWatermark ? "Watermark" : "Background image"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="overflow-y-auto">
            {isWatermark && <WatermarkPropertiesContent />}
            {isBackgroundImage && <BackgroundImagePropertiesContent />}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
