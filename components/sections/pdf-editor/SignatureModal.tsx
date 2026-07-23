"use client";

import type { Canvas } from "fabric";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal, Tabs } from "@heroui/react";

import { FileUpload } from "@/components/ui/file-upload/file-upload";
import { usePdfEditorStore } from "@/lib/client/stores";

type SignatureModalProps = {
  fabricCanvas: Canvas | null;
  isOpen: boolean;
  onClose: () => void;
};

type PanelProps = {
  onSignatureReady: (dataUrl: string | null) => void;
};

// ---------------------------------------------------------------------------
// Draw Tab
// ---------------------------------------------------------------------------
function SignatureDrawPanel({ onSignatureReady }: PanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let cancelled = false;

    const init = async () => {
      const { Canvas: FabricCanvas, PencilBrush } = await import("fabric");

      if (cancelled || !canvasRef.current) return;

      const fc = new FabricCanvas(canvasRef.current, {
        backgroundColor: "transparent",
        height: 150,
        isDrawingMode: true,
        width: 400,
      });

      const brush = new PencilBrush(fc);

      brush.color = "#000000";
      brush.width = 2;
      brush.strokeLineCap = "round";
      brush.strokeLineJoin = "round";
      fc.freeDrawingBrush = brush;

      fc.on("path:created", () => {
        onSignatureReady(fc.toDataURL({ format: "png", multiplier: 3 }));
      });

      fabricRef.current = fc;
    };

    init();

    return () => {
      cancelled = true;
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, [onSignatureReady]);

  const handleClear = () => {
    const fc = fabricRef.current;

    if (!fc) return;

    fc.clear();
    fc.backgroundColor = "transparent";
    fc.renderAll();
    onSignatureReady(null);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="overflow-hidden rounded-lg border border-default-200 bg-white">
        <canvas ref={canvasRef} />
      </div>
      <Button size="sm" variant="ghost" onPress={handleClear}>
        Clear
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type Tab
// ---------------------------------------------------------------------------
function SignatureTypePanel({ onSignatureReady }: PanelProps) {
  const [text, setText] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!text.trim()) {
      onSignatureReady(null);

      return;
    }

    let cancelled = false;

    const render = async () => {
      await document.fonts.ready;

      if (cancelled || !previewRef.current) return;

      const resolvedFont =
        getComputedStyle(previewRef.current).fontFamily || "cursive";

      const fontSize = 48;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      ctx.font = `${fontSize}px ${resolvedFont}`;
      const metrics = ctx.measureText(text);
      const padding = 16;

      canvas.width = Math.ceil(metrics.width) + padding * 2;
      canvas.height = fontSize + padding * 2;

      // Redraw after sizing
      ctx.font = `${fontSize}px ${resolvedFont}`;
      ctx.fillStyle = "#000000";
      ctx.textBaseline = "top";
      ctx.fillText(text, padding, padding);

      onSignatureReady(canvas.toDataURL("image/png"));
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [text, onSignatureReady]);

  return (
    <div className="flex flex-col gap-3">
      <input
        className="w-full rounded-lg border border-default-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        placeholder="Type your signature"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div
        ref={previewRef}
        className="flex min-h-20 items-center justify-center rounded-lg border border-default-200 bg-white p-4"
        style={{ fontFamily: "var(--font-dancing-script)", fontSize: "48px" }}
      >
        <span className="text-black">{text || "\u00A0"}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload Tab
// ---------------------------------------------------------------------------
function SignatureUploadPanel({ onSignatureReady }: PanelProps) {
  const [file, setFile] = useState<File | null>(null);

  const handleFileSelect = useCallback(
    (selected: File) => {
      setFile(selected);

      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === "string") {
          onSignatureReady(reader.result);
        }
      };
      reader.readAsDataURL(selected);
    },
    [onSignatureReady],
  );

  const handleFileClear = useCallback(() => {
    setFile(null);
    onSignatureReady(null);
  }, [onSignatureReady]);

  return (
    <FileUpload
      accept={["image/png", "image/jpeg", "image/svg+xml"]}
      acceptLabel="PNG, JPG, SVG"
      file={file}
      heading="Upload signature image"
      maxSize={5 * 1024 * 1024}
      onFileClear={handleFileClear}
      onFileSelect={handleFileSelect}
    />
  );
}

// ---------------------------------------------------------------------------
// Modal Content (remounts on each open to reset state)
// ---------------------------------------------------------------------------
function SignatureModalContent({
  fabricCanvas,
  onClose,
}: Omit<SignatureModalProps, "isOpen">) {
  const [activeTab, setActiveTab] = useState<string>("draw");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pushHistory = usePdfEditorStore((s) => s.pushHistory);

  const handleTabChange = useCallback((key: React.Key) => {
    setActiveTab(String(key));
    setSignatureDataUrl(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!signatureDataUrl || !fabricCanvas) return;

    const { FabricImage } = await import("fabric");
    const img = await FabricImage.fromURL(signatureDataUrl);

    const maxWidth = 200;
    const scale = img.width && img.width > maxWidth ? maxWidth / img.width : 1;

    // Fabric JSON is stored in BASE coordinates (zoom = 1). The
    // canvas' `.width` / `.height` are the rendered (post-zoom) size —
    // dividing by 2 alone puts the signature at `base_width * zoom / 2`,
    // which lands past the right/bottom edge whenever the user is
    // zoomed in > 1x. Divide out the current zoom to hit the true page
    // centre regardless of zoom level.
    const zoom = fabricCanvas.getZoom() || 1;
    const centerX = (fabricCanvas.width ?? 600) / (2 * zoom);
    const centerY = (fabricCanvas.height ?? 800) / (2 * zoom);

    img.set({
      left: centerX,
      lockUniScaling: true,
      originX: "center",
      originY: "center",
      scaleX: scale,
      scaleY: scale,
      top: centerY,
    });

    fabricCanvas.add(img);
    fabricCanvas.setActiveObject(img);
    fabricCanvas.renderAll();

    pushHistory(currentPage, JSON.stringify(fabricCanvas.toJSON()));
    onClose();
  }, [signatureDataUrl, fabricCanvas, currentPage, pushHistory, onClose]);

  return (
    <>
      <Modal.Header>
        <Modal.Heading>Add Signature</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Tabs selectedKey={activeTab} onSelectionChange={handleTabChange}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Signature method">
              <Tabs.Tab id="draw">
                Draw
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="type">
                <Tabs.Separator />
                Type
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="upload">
                <Tabs.Separator />
                Upload
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel className="pt-4" id="draw">
            <SignatureDrawPanel onSignatureReady={setSignatureDataUrl} />
          </Tabs.Panel>
          <Tabs.Panel className="pt-4" id="type">
            <SignatureTypePanel onSignatureReady={setSignatureDataUrl} />
          </Tabs.Panel>
          <Tabs.Panel className="pt-4" id="upload">
            <SignatureUploadPanel onSignatureReady={setSignatureDataUrl} />
          </Tabs.Panel>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button slot="close" variant="ghost">
          Cancel
        </Button>
        <Button isDisabled={!signatureDataUrl} onPress={handleConfirm}>
          Add Signature
        </Button>
      </Modal.Footer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Signature Modal
// ---------------------------------------------------------------------------
export function SignatureModal({
  fabricCanvas,
  isOpen,
  onClose,
}: SignatureModalProps) {
  // Use a key to remount content on each open, resetting all internal state
  const [mountKey, setMountKey] = useState(0);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setMountKey((k) => k + 1);
      } else {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
        <Modal.Container className="items-start justify-center p-4 sm:items-center">
          <Modal.Dialog className="max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain sm:max-w-[480px]">
            <Modal.CloseTrigger />
            <SignatureModalContent
              key={mountKey}
              fabricCanvas={fabricCanvas}
              onClose={onClose}
            />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
