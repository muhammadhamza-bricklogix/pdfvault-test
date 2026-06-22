"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import {
  CheckmarkCircle02Icon,
  DocumentCodeIcon,
  Loading03Icon,
  Scissor01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useMemo, useRef, useState } from "react";

import { FileUpload } from "@/components/ui/file-upload";
import {
  buildEveryNRanges,
  buildZip,
  type PageRange,
  parseRanges,
  splitPdf,
  type SplitMode,
  triggerDownload,
} from "@/lib/client/pdf-tools/split-pdf";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

const ACCEPT = [".pdf", "application/pdf"];
const MAX_SIZE = 100 * 1024 * 1024; // 100 MB — same ceiling as upload

type PageCountState =
  | { status: "idle" }
  | { status: "counting" }
  | { status: "ready"; pageCount: number; bytes: Uint8Array }
  | { status: "error"; message: string };

/**
 * Read just enough of the PDF to know its page count. Uses pdf-lib so we
 * stay on a single PDF stack across the page (no pdf.js + Safari polyfills
 * required here — the editor is the only place that needs pdf.js).
 */
async function countPages(file: File): Promise<{
  pageCount: number;
  bytes: Uint8Array;
}> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });

  return { pageCount: doc.getPageCount(), bytes };
}

export function SplitPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageCountState>({ status: "idle" });
  const [mode, setMode] = useState<SplitMode>("ranges");
  const [rangesText, setRangesText] = useState("");
  const [chunkSize, setChunkSize] = useState("5");
  const [isSplitting, setIsSplitting] = useState(false);

  // Discriminator for in-flight PDF reads — incremented on every file
  // change. Async results that come back with a stale value are dropped
  // (covers the user picking a second file before the first finished
  // parsing). Avoids the useEffect+setState lint pattern entirely by
  // running the read straight from the event handler.
  const readGeneration = useRef(0);

  const handleFileSelect = useCallback((picked: File) => {
    const generation = ++readGeneration.current;

    setFile(picked);
    setRangesText("");
    setChunkSize("5");
    setPages({ status: "counting" });
    countPages(picked)
      .then(({ pageCount, bytes }) => {
        if (readGeneration.current !== generation) return;
        setPages({ status: "ready", pageCount, bytes });
      })
      .catch((err) => {
        if (readGeneration.current !== generation) return;
        logger.error("[split-pdf] failed to read PDF", err);
        const message =
          err instanceof Error ? err.message : "Could not read this PDF.";

        setPages({ status: "error", message });
      });
  }, []);

  const handleFileClear = useCallback(() => {
    readGeneration.current += 1;
    setFile(null);
    setPages({ status: "idle" });
    setRangesText("");
    setChunkSize("5");
  }, []);

  const pageCount = pages.status === "ready" ? pages.pageCount : 0;

  // Compute the parsed ranges for the current mode. Errors surface inline
  // under the corresponding input — the split button uses the same result.
  const parsed = useMemo<
    { ok: true; ranges: PageRange[] } | { ok: false; error: string } | null
  >(() => {
    if (pages.status !== "ready") return null;

    if (mode === "ranges") {
      if (rangesText.trim() === "") return null;

      return parseRanges(rangesText, pageCount);
    }

    const n = Number(chunkSize);

    if (!chunkSize.trim()) return null;

    return buildEveryNRanges(pageCount, n);
  }, [pages.status, pageCount, mode, rangesText, chunkSize]);

  const handleSplit = useCallback(async () => {
    if (pages.status !== "ready" || !file) return;
    if (!parsed || !parsed.ok) return;

    setIsSplitting(true);
    try {
      const parts = await splitPdf(pages.bytes, file.name, parsed.ranges);

      // One range → single PDF download. Multiple ranges → bundle as zip.
      // Sequential blob downloads on multi-range would trip Safari's
      // multi-download prompt and produce a worse experience than a zip.
      if (parts.length === 1) {
        const only = parts[0]!;

        triggerDownload(
          new Blob([new Uint8Array(only.bytes)], { type: "application/pdf" }),
          only.filename,
        );
      } else {
        const dot = file.name.lastIndexOf(".");
        const base = dot > 0 ? file.name.slice(0, dot) : file.name;
        const zipName = `${base || "document"}-split.zip`;
        const zip = await buildZip(parts, file.name);

        triggerDownload(zip, zipName);
      }

      toast.success({
        title: "Split complete",
        description:
          parts.length === 1
            ? `Downloaded ${parts[0]!.filename}.`
            : `Downloaded ${parts.length} files as a zip.`,
      });
    } catch (err) {
      logger.error("[split-pdf] split failed", err);
      toast.error({
        title: "Couldn't split this PDF",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSplitting(false);
    }
  }, [file, pages, parsed]);

  const validationError = parsed && parsed.ok === false ? parsed.error : null;
  const previewRanges = parsed && parsed.ok ? parsed.ranges : null;
  const canSplit =
    !isSplitting &&
    pages.status === "ready" &&
    !!file &&
    parsed?.ok === true &&
    parsed.ranges.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Split a PDF</h1>
        <p className="text-sm text-default-500">
          Pull selected page ranges into separate PDFs, or chunk a long document
          into evenly sized parts. Everything happens in your browser — no
          uploads.
        </p>
      </header>

      <FileUpload
        accept={ACCEPT}
        acceptLabel="PDF only"
        appearance="default"
        browseLabel="Choose PDF"
        description="Drop a PDF here or browse to choose one."
        file={file}
        heading="Upload a PDF to split"
        maxSize={MAX_SIZE}
        onFileClear={handleFileClear}
        onFileSelect={handleFileSelect}
      />

      {pages.status === "counting" && (
        <div className="flex items-center justify-center gap-2 text-sm text-default-500">
          <HugeiconsIcon
            className="animate-spin"
            icon={Loading03Icon}
            size={16}
          />
          Reading the PDF…
        </div>
      )}

      {pages.status === "error" && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
          {pages.message}
        </div>
      )}

      {pages.status === "ready" && (
        <section className="flex flex-col gap-5 rounded-2xl border border-default-200 bg-content1 p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-default-600">
              <HugeiconsIcon icon={DocumentCodeIcon} size={16} />
              <span>
                <strong>{pageCount}</strong>{" "}
                {pageCount === 1 ? "page" : "pages"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-default-700">
              How would you like to split it?
            </span>
            <div
              aria-label="Split mode"
              className="inline-flex w-fit rounded-xl border border-default-200 bg-default-50 p-1"
              role="tablist"
            >
              <button
                aria-selected={mode === "ranges"}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "ranges"
                    ? "bg-content1 text-default-900 shadow"
                    : "text-default-500 hover:text-default-700"
                }`}
                role="tab"
                type="button"
                onClick={() => setMode("ranges")}
              >
                Custom ranges
              </button>
              <button
                aria-selected={mode === "everyN"}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "everyN"
                    ? "bg-content1 text-default-900 shadow"
                    : "text-default-500 hover:text-default-700"
                }`}
                role="tab"
                type="button"
                onClick={() => setMode("everyN")}
              >
                Every N pages
              </button>
            </div>
            <span className="text-xs text-default-500">
              {mode === "ranges"
                ? "Pick exact pages: 1-3, 5, 8-10"
                : "Group every N pages into a file"}
            </span>
          </div>

          {mode === "ranges" ? (
            <TextField
              isInvalid={!!validationError}
              value={rangesText}
              onChange={setRangesText}
            >
              <Label>Page ranges</Label>
              <Input
                aria-label="Page ranges"
                placeholder={`e.g. 1-3, 5, 8-${pageCount}`}
              />
            </TextField>
          ) : (
            <TextField
              isInvalid={!!validationError}
              value={chunkSize}
              onChange={setChunkSize}
            >
              <Label>Pages per file</Label>
              <Input
                aria-label="Pages per file"
                inputMode="numeric"
                placeholder="e.g. 5"
              />
            </TextField>
          )}

          {validationError && (
            <p className="text-sm text-danger-600">{validationError}</p>
          )}

          {previewRanges && previewRanges.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
                Output ({previewRanges.length}{" "}
                {previewRanges.length === 1 ? "file" : "files"})
              </p>
              <ul className="flex flex-col gap-1 rounded-xl bg-default-50 p-3 text-sm">
                {previewRanges.slice(0, 8).map((r, i) => (
                  <li
                    key={`${r.start}-${r.end}-${i}`}
                    className="flex items-center gap-2 text-default-700"
                  >
                    <HugeiconsIcon
                      className="text-success-500"
                      icon={CheckmarkCircle02Icon}
                      size={14}
                    />
                    <span>
                      Pages {r.start}
                      {r.end !== r.start ? `–${r.end}` : ""}
                    </span>
                  </li>
                ))}
                {previewRanges.length > 8 && (
                  <li className="pl-6 text-xs text-default-500">
                    …and {previewRanges.length - 8} more
                  </li>
                )}
              </ul>
            </div>
          )}

          <Button
            isDisabled={!canSplit}
            size="lg"
            variant="primary"
            onPress={handleSplit}
          >
            {isSplitting ? (
              <span className="flex items-center gap-2">
                <HugeiconsIcon
                  className="animate-spin"
                  icon={Loading03Icon}
                  size={18}
                />
                Splitting…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <HugeiconsIcon icon={Scissor01Icon} size={18} />
                Split &amp; download
              </span>
            )}
          </Button>
        </section>
      )}
    </div>
  );
}
