"use client";

import { PDFDocument } from "pdf-lib";

export type MergeEntry = {
  /** Display name shown in the list. */
  filename: string;
  bytes: Uint8Array;
  pageCount: number;
};

/**
 * Concatenate multiple PDFs in order and return the merged bytes.
 * Pages from each entry are copied with pdf-lib (zero re-encoding).
 */
export async function mergePdfs(entries: MergeEntry[]): Promise<Uint8Array> {
  const output = await PDFDocument.create();

  for (const entry of entries) {
    const src = await PDFDocument.load(entry.bytes, { ignoreEncryption: true });
    const indices = Array.from({ length: src.getPageCount() }, (_, i) => i);
    const copied = await output.copyPages(src, indices);

    for (const page of copied) output.addPage(page);
  }

  return output.save();
}

/** Read a File object to a MergeEntry. */
export async function fileToMergeEntry(file: File): Promise<MergeEntry> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  return { bytes, filename: file.name, pageCount: doc.getPageCount() };
}
