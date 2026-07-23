"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { Modal } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useDocumentsQuery } from "@/lib/client/query/queries/documents.query";
import { ROUTES } from "@/lib/shared/constants/routes";

interface DocPickerModalProps {
  /** Editor-tool slug (`compress`, `password`, `manage`, etc.). Passed
   *  through as `?tool=<slug>` when navigating to the composer so the
   *  hydrator auto-launches that tool once the picked doc loads. */
  toolSlug: string | null;
  /** Human-readable tool name used in the modal heading. */
  toolLabel: string | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Pick-a-PDF modal used by the dashboard tool tiles that require a
 * source document (Sign, Watermark, Protect, Rotate, Compress, etc.).
 * Renders the user's library as a compact selectable list. Clicking a
 * row routes to `/pdf-composer?id=<docId>&tool=<slug>` so the composer
 * hydrates from the picked doc and the hydrator's Step 4 auto-launches
 * the correct tool modal.
 *
 * PDF Composer + Convert routes don't use this — those either land on
 * the empty drop-zone or on a route-specific upload workspace.
 */
export function DocPickerModal({
  isOpen,
  onClose,
  toolSlug,
  toolLabel,
}: DocPickerModalProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useDocumentsQuery({ pageSize: 100 });

  const docs: Document[] = useMemo(() => {
    const pages = data?.pages ?? [];

    return pages.flatMap((p) => p.items);
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return docs;

    return docs.filter((d) => d.filename.toLowerCase().includes(q));
  }, [docs, search]);

  const handlePick = (docId: string) => {
    const query = new URLSearchParams({ id: docId });

    if (toolSlug) query.set("tool", toolSlug);
    router.push(`${ROUTES.TOOLS.PDF_EDITOR}?${query.toString()}`);
    onClose();
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container className="items-start justify-center p-4 sm:items-center">
        <Modal.Dialog className="max-h-[calc(100dvh-32px)] w-full overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)] sm:max-w-[560px] dark:bg-content1">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="pv-heading text-[18px] font-semibold text-[var(--pv-text-strong,#1a1c21)]">
              {toolLabel ? `Pick a PDF to ${toolLabel}` : "Pick a PDF"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
            <input
              autoFocus
              aria-label="Search PDFs"
              className="h-10 w-full rounded-lg border border-default-200 bg-transparent px-3 text-[14px] outline-none focus:border-[var(--pv-brand-red,#f12c23)]"
              placeholder="Search by filename…"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-default-200">
              {isLoading ? (
                <div className="flex items-center justify-center p-8 text-[13px] text-default-500">
                  Loading your library…
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center gap-1 p-8 text-[13px] text-danger">
                  <p>Couldn&apos;t load your PDFs.</p>
                  <p className="text-default-500">
                    Please try again in a moment.
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center text-[13px] text-default-500">
                  <p>
                    {docs.length === 0
                      ? "No PDFs in your library yet."
                      : `No PDFs matching "${search}".`}
                  </p>
                  {docs.length === 0 ? (
                    <p>Upload one from the dashboard to get started.</p>
                  ) : null}
                </div>
              ) : (
                <ul className="divide-y divide-default-200">
                  {filtered.map((doc) => (
                    <li key={doc.id}>
                      <button
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-default-50 focus-visible:bg-default-100 focus-visible:outline-none"
                        type="button"
                        onClick={() => handlePick(doc.id)}
                      >
                        <span
                          aria-hidden
                          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-danger-50 text-[10px] font-bold text-danger"
                        >
                          PDF
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate text-[14px] font-medium text-[var(--pv-text-strong,#1a1c21)]"
                            title={doc.filename}
                          >
                            {doc.filename}
                          </span>
                          <span className="block text-[12px] text-default-500">
                            {formatSize(doc.sizeBytes)}
                            {doc.pageCount ? ` · ${doc.pageCount} pages` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
