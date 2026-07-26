"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LRUCache } from "lru-cache";
import { useEffect, useState } from "react";

import { loadPdfJs } from "@/lib/client/pdf-editor/load-pdfjs";
import { PDFJS_WORKER_SRC } from "@/lib/client/pdf-editor/pdfjs-worker";

// Bounded LRU cache: max 75 entries, ~a few MB of data URLs. Prevents
// unbounded growth in long-lived dashboard sessions with many documents.
const cache = new LRUCache<string, string>({
  max: 75,
});

function cacheKey(doc: Document): string {
  return `${doc.id}|${doc.updatedAt}`;
}

type Props = {
  document: Document;
};

export function DocumentThumbnail({ document: doc }: Props) {
  const key = cacheKey(doc);
  const cached = cache.get(key) ?? null;
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const src = cached ?? loadedSrc;

  useEffect(() => {
    if (cache.has(key)) return;

    let cancelled = false;

    (async () => {
      try {
        const pdfjs = await loadPdfJs();

        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
        }

        const task = pdfjs.getDocument({ url: doc.url });
        const pdf = await task.promise;
        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = 96;
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = window.document.createElement("canvas");

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) throw new Error("Canvas context unavailable");

        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/png");

        cache.set(key, dataUrl);
        if (!cancelled) setLoadedSrc(dataUrl);
        await pdf.destroy();
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, doc.url]);

  if (src) {
    return (
      <div className="flex h-12 w-9 items-center justify-center overflow-hidden rounded border border-default-200 bg-[var(--pv-surface)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="h-full w-full object-cover" src={src} />
      </div>
    );
  }

  return (
    <div className="flex h-12 w-9 items-center justify-center rounded border border-default-200 bg-default-100">
      <HugeiconsIcon
        className={failed ? "text-default-500" : "text-default-500 opacity-60"}
        icon={File01Icon}
        size={16}
      />
    </div>
  );
}
