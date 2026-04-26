"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";

import { documentsService } from "@/lib/shared/api/services/documents.service";

const cache = new Map<string, string>();

function cacheKey(doc: Document): string {
  return `${doc.id}|${doc.updatedAt}`;
}

type Props = {
  document: Document;
};

export function DocumentThumbnail({ document: doc }: Props) {
  const [src, setSrc] = useState<string | null>(() => cache.get(cacheKey(doc)) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const key = cacheKey(doc);
    const cached = cache.get(key);

    if (cached) {
      setSrc(cached);

      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { url } = await documentsService.getDocumentDownload(doc.id);
        const pdfjs = await import("pdfjs-dist");

        const task = pdfjs.getDocument({ url });
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
        if (!cancelled) setSrc(dataUrl);
        await pdf.destroy();
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doc]);

  if (src) {
    return (
      <div className="flex h-12 w-9 items-center justify-center overflow-hidden rounded border border-[var(--app-border)] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="h-full w-full object-cover" src={src} />
      </div>
    );
  }

  return (
    <div className="flex h-12 w-9 items-center justify-center rounded border border-[var(--app-border)] bg-[var(--app-surface)]">
      <HugeiconsIcon
        className={
          failed ? "text-[var(--app-muted)]" : "text-[var(--app-muted)] opacity-60"
        }
        icon={File01Icon}
        size={16}
      />
    </div>
  );
}
