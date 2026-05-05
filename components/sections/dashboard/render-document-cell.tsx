"use client";

import type { Document } from "@/lib/shared/types/documents.types";
import type { ReactNode } from "react";

import { DocumentActionsMenu } from "./document-actions-menu";
import { DocumentThumbnail } from "./document-thumbnail";

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${size.toFixed(size < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type RenderOptions = {
  onDelete: (doc: Document) => void;
  onRename: (doc: Document) => void;
};

export function renderDocumentCell(
  doc: Document,
  columnKey: string,
  { onDelete, onRename }: RenderOptions,
): ReactNode {
  switch (columnKey) {
    case "thumb":
      return (
        <div className="flex w-full items-center justify-center">
          <DocumentThumbnail document={doc} />
        </div>
      );

    case "filename":
      return <span className="line-clamp-1 font-medium">{doc.filename}</span>;

    case "sizeBytes":
      return (
        <span className="text-sm text-default-500">
          {formatBytes(doc.sizeBytes)}
        </span>
      );

    case "pageCount":
      return (
        <span className="text-sm text-default-500">{doc.pageCount ?? "—"}</span>
      );

    case "updatedAt":
      return (
        <span className="text-sm text-default-500">
          {formatDate(doc.updatedAt)}
        </span>
      );

    case "actions":
      return (
        <div className="flex justify-end">
          <DocumentActionsMenu
            document={doc}
            onDelete={() => onDelete(doc)}
            onRename={() => onRename(doc)}
          />
        </div>
      );

    default:
      return null;
  }
}
