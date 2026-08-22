"use client";

import { Button, Input, Modal, Tabs } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { useUploadSignatureMutation } from "@/lib/client/query/mutations/forms.mutation";
import { useFormEditorStore } from "@/lib/client/stores";
import { toast } from "@/lib/shared/utils/toast";

type SignatureModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

type Tab = "draw" | "type" | "upload";

const TYPE_FONTS = [
  { id: "dancing", label: "Dancing Script", css: "var(--font-dancing-script)" },
  { id: "great-vibes", label: "Great Vibes", css: "var(--font-great-vibes)" },
  { id: "allura", label: "Allura", css: "var(--font-allura)" },
  { id: "sacramento", label: "Sacramento", css: "var(--font-sacramento)" },
  { id: "pacifico", label: "Pacifico", css: "var(--font-pacifico)" },
] as const;

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 200;
const MAX_UPLOAD_BYTES = 1 * 1024 * 1024;
// Backend stamps the signature into a field rect that's taller than the
// printed signature line — sending the raw canvas causes the ink to bleed
// into the row above ("See the instructions for Part II, later."). We pad
// the source image with transparent space on top + bottom + a hairline
// marker so no matter how the stamper fits/crops it, the visible ink lands
// in the bottom portion of the field. 0.55 = ink occupies bottom 55%.
const SIGNATURE_INK_BOTTOM_PCT = 0.55;

export function SignatureModal({ isOpen, onOpenChange }: SignatureModalProps) {
  const [tab, setTab] = useState<Tab>("draw");
  const upload = useUploadSignatureMutation();
  const setSignatureKey = useFormEditorStore((s) => s.setSignatureKey);
  const setSignaturePreview = useFormEditorStore((s) => s.setSignaturePreview);
  const sessionId = useFormEditorStore((s) => s.sessionId);

  // --- Draw -------------------------------------------------------------
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (!isOpen || tab !== "draw") return;

    const canvas = drawCanvasRef.current;

    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [isOpen, tab]);

  const getDrawPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    return { x, y };
  };

  const handleDrawDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const { x, y } = getDrawPoint(e);
    const ctx = drawCanvasRef.current?.getContext("2d");

    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const handleDrawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const { x, y } = getDrawPoint(e);
    const ctx = drawCanvasRef.current?.getContext("2d");

    ctx?.lineTo(x, y);
    ctx?.stroke();
  };

  const handleDrawUp = () => {
    isDrawingRef.current = false;
  };

  const handleClearDraw = () => {
    const canvas = drawCanvasRef.current;

    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // --- Type -------------------------------------------------------------
  const [typeText, setTypeText] = useState("");
  const [typeFont, setTypeFont] =
    useState<(typeof TYPE_FONTS)[number]["id"]>("dancing");
  const typeCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isOpen || tab !== "type") return;

    const canvas = typeCanvasRef.current;

    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!typeText) return;

    const fontCss = TYPE_FONTS.find((f) => f.id === typeFont)?.css ?? "cursive";

    ctx.fillStyle = "#111";
    ctx.font = `64px ${fontCss}, cursive`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typeText, canvas.width / 2, canvas.height / 2);
  }, [typeText, typeFont, isOpen, tab]);

  // --- Upload -----------------------------------------------------------
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadBlob, setUploadBlob] = useState<Blob | null>(null);

  const handleUploadInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error({ title: "Image too large", description: "Max 1 MB." });

      return;
    }
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      toast.error({ title: "Unsupported", description: "Use PNG or JPG." });

      return;
    }
    setUploadBlob(file);
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadPreviewUrl(URL.createObjectURL(file));
  };

  // --- Apply ------------------------------------------------------------
  const canvasToBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("read failed"));
      reader.readAsDataURL(blob);
    });

  const loadImage = (blob: Blob) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("image decode failed"));
      };
      img.src = url;
    });

  // Reshape signature so ink occupies the bottom SIGNATURE_INK_BOTTOM_PCT of
  // a transparent canvas. Hairline markers in the top corners keep the
  // padding non-cropable in case the backend tight-crops before fitting.
  const padSignatureBottom = async (blob: Blob): Promise<Blob> => {
    const img = await loadImage(blob);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    if (!w || !h) return blob;

    const paddedH = Math.round(h / SIGNATURE_INK_BOTTOM_PCT);
    const canvas = document.createElement("canvas");

    canvas.width = w;
    canvas.height = paddedH;
    const ctx = canvas.getContext("2d");

    if (!ctx) return blob;
    ctx.clearRect(0, 0, w, paddedH);
    ctx.drawImage(img, 0, paddedH - h);
    // 1 px alpha=1 pixels at the top-left / top-right corners so a tight-
    // bounding-box crop (if the stamper does one) still spans the full
    // padded height. Effectively invisible in the rendered output.
    const marker = ctx.createImageData(1, 1);

    marker.data[0] = 0;
    marker.data[1] = 0;
    marker.data[2] = 0;
    marker.data[3] = 1;
    ctx.putImageData(marker, 0, 0);
    ctx.putImageData(marker, w - 1, 0);

    const padded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );

    return padded ?? blob;
  };

  // Trim white / transparent whitespace to the tight ink bounding box so
  // the overlay preview isn't a tiny signature floating in a canvas of
  // empty pixels. Used ONLY for the editor preview; the upload keeps the
  // padded version so the backend stamp lands lower.
  const trimSignatureWhitespace = async (blob: Blob): Promise<Blob> => {
    const img = await loadImage(blob);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    if (!w || !h) return blob;

    const src = document.createElement("canvas");

    src.width = w;
    src.height = h;
    const srcCtx = src.getContext("2d");

    if (!srcCtx) return blob;
    srcCtx.drawImage(img, 0, 0);
    const { data } = srcCtx.getImageData(0, 0, w, h);
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const alpha = data[i + 3];
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Ink = non-transparent AND darker than near-white. Threshold at
        // 240 catches ink even with mild anti-aliasing.
        const isInk = alpha > 8 && (r < 240 || g < 240 || b < 240);

        if (!isInk) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < 0 || maxY < 0) return blob;

    const pad = 4;
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(w, maxX + pad) - cropX;
    const cropH = Math.min(h, maxY + pad) - cropY;

    if (cropW <= 0 || cropH <= 0) return blob;

    const out = document.createElement("canvas");

    out.width = cropW;
    out.height = cropH;
    const outCtx = out.getContext("2d");

    if (!outCtx) return blob;
    outCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const trimmed = await new Promise<Blob | null>((resolve) =>
      out.toBlob((b) => resolve(b), "image/png"),
    );

    return trimmed ?? blob;
  };

  const handleApply = async () => {
    if (!sessionId) {
      toast.error({ title: "No session yet — try again in a second." });

      return;
    }

    let blob: Blob | null = null;

    if (tab === "draw") {
      blob = await canvasToBlob(drawCanvasRef.current!);
    } else if (tab === "type") {
      if (!typeText.trim()) {
        toast.error({ title: "Type your name first." });

        return;
      }
      blob = await canvasToBlob(typeCanvasRef.current!);
    } else if (tab === "upload") {
      blob = uploadBlob;
    }

    if (!blob) {
      toast.error({ title: "Couldn't capture a signature image." });

      return;
    }

    // Local preview uses a WHITESPACE-TRIMMED version so the overlay shows
    // the ink at full box size. The upload gets a PADDED version so the
    // backend-stamped signature lands lower in its field rect.
    let previewBlob: Blob = blob;

    try {
      previewBlob = await trimSignatureWhitespace(blob);
    } catch {
      // Trim failed — preview from the raw blob.
    }
    const previewDataUrl = await blobToDataUrl(previewBlob);
    let uploadBlob: Blob = blob;

    try {
      uploadBlob = await padSignatureBottom(blob);
    } catch {
      // Padding failed — upload the raw blob rather than blocking.
    }

    try {
      const { signatureKey } = await upload.mutateAsync({
        sessionId,
        blob: uploadBlob,
      });

      setSignatureKey(signatureKey);
      setSignaturePreview(previewDataUrl);
      toast.success({ title: "Signature saved" });
      onOpenChange(false);
    } catch (err) {
      toast.error({
        title: "Couldn't save signature",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[720px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Add your signature</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="p-5">
            <Tabs
              aria-label="Signature method"
              selectedKey={tab}
              onSelectionChange={(k) => setTab(String(k) as Tab)}
            >
              <Tabs.List>
                <Tabs.Tab id="draw">Draw</Tabs.Tab>
                <Tabs.Tab id="type">Type</Tabs.Tab>
                <Tabs.Tab id="upload">Upload</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel className="mt-4" id="draw">
                <div className="flex flex-col gap-3">
                  <canvas
                    ref={drawCanvasRef}
                    aria-label="Signature drawing area"
                    className="block w-full max-w-full rounded-xl border border-default-200 bg-white touch-none"
                    height={CANVAS_HEIGHT}
                    style={{
                      aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
                    }}
                    width={CANVAS_WIDTH}
                    onPointerDown={handleDrawDown}
                    onPointerLeave={handleDrawUp}
                    onPointerMove={handleDrawMove}
                    onPointerUp={handleDrawUp}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="tertiary"
                      onPress={handleClearDraw}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </Tabs.Panel>

              <Tabs.Panel className="mt-4" id="type">
                <div className="flex flex-col gap-3">
                  <Input
                    aria-label="Type your name"
                    placeholder="Type your full name"
                    value={typeText}
                    onChange={(e) => setTypeText(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    {TYPE_FONTS.map((f) => (
                      <button
                        key={f.id}
                        aria-pressed={typeFont === f.id}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                          typeFont === f.id
                            ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_8%,transparent)] text-[var(--color-accent)]"
                            : "border-default-200 hover:bg-default-50 dark:border-default-700"
                        }`}
                        style={{ fontFamily: f.css }}
                        type="button"
                        onClick={() => setTypeFont(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <canvas
                    ref={typeCanvasRef}
                    aria-label="Typed signature preview"
                    className="block w-full max-w-full rounded-xl border border-default-200 bg-white"
                    height={CANVAS_HEIGHT}
                    width={CANVAS_WIDTH}
                  />
                </div>
              </Tabs.Panel>

              <Tabs.Panel className="mt-4" id="upload">
                <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-default-300 bg-default-50/60 px-6 py-10 text-center hover:bg-default-100/60 dark:border-default-700 dark:bg-default-50/5">
                  <span className="text-sm font-medium text-default-700 dark:text-default-300">
                    Click to upload a PNG or JPG (max 1 MB)
                  </span>
                  <input
                    accept="image/png,image/jpeg"
                    className="hidden"
                    type="file"
                    onChange={handleUploadInput}
                  />
                </label>
                {uploadPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- preview is a data/object URL
                  <img
                    alt="Signature preview"
                    className="mt-4 max-h-48 rounded-xl border border-default-200 bg-white object-contain dark:border-default-700"
                    src={uploadPreviewUrl}
                  />
                ) : null}
              </Tabs.Panel>
            </Tabs>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              isDisabled={upload.isPending}
              variant="primary"
              onPress={handleApply}
            >
              {upload.isPending ? "Saving…" : "Apply signature"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
