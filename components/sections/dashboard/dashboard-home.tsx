"use client";

import type { PvFileRow } from "./pv-mock-my-pdfs";
import type { Document } from "@/lib/shared/types/documents.types";

import { useUser } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { VersionHistoryModal } from "@/components/sections/pdf-editor/VersionHistoryModal";
import { useDocumentsQuery } from "@/lib/client/query/queries/documents.query";
import { usePendingConversionsStore } from "@/lib/client/stores/pending-conversions-store";
import { useProductTour } from "@/lib/client/tour/use-product-tour";
import { openDocumentInEditor } from "@/lib/client/utils/open-document-in-editor";
import { triggerDocumentDownload } from "@/lib/client/utils/trigger-document-download";
import { documentKeys } from "@/lib/shared/constants/query-keys";
import { toast } from "@/lib/shared/utils/toast";

import { BulkDeleteDocumentsModal } from "./bulk-delete-documents-modal";
import { DeleteDocumentModal } from "./delete-document-modal";
import { DocPickerModal } from "./doc-picker-modal";
import { PendingConversionBanner } from "./pending-conversion-banner";
import { PvFileTable } from "./pv-file-table";
import {
  documentToFileRow,
  pendingConversionToFileRow,
} from "./pv-mock-my-pdfs";
import { PvPageHeader, UploadPdfButton } from "./pv-page-header";
import { PvQuickToolCards } from "./pv-quick-tool-cards";
import { PvSearchToolbar } from "./pv-search-toolbar";
import { RenameDocumentModal } from "./rename-document-modal";

// Human-readable labels for the composer tool slugs that can arrive via
// `?openPicker=<slug>` on the dashboard URL. Used only for the picker
// modal's heading — the slug itself is the source of truth downstream.
const TOOL_LABELS: Record<string, string> = {
  compress: "Compress PDF",
  password: "Password Protect",
  unlock: "Unlock PDF",
  manage: "Organize Pages",
  split: "Split & Extract Pages",
  watermark: "Sign & Watermark",
  "extract-images": "Extract Images",
  flatten: "Remove Annotations",
};

/**
 * My PDFs — the page inside the AppShell's white card. Composes the header,
 * quick-tool gallery, search toolbar, and the real-data file table.
 *
 * Data flow:
 *   `useDocumentsQuery()` → flatten `pages[].items` → map each `Document`
 *   into a `PvFileRow` (adding uploader metadata from the Clerk user) →
 *   feed to `<PvFileTable rows>`. Row actions dispatch back to the same
 *   mutations the pre-existing `DocumentsTable` used, so rename / delete /
 *   history / download all keep their existing UX + optimistic updates.
 */
export function DashboardHome() {
  const { start: startDashboardTour } = useProductTour("dashboard");
  const [search, setSearch] = useState("");
  const [renameTarget, setRenameTarget] = useState<Document | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<Document[] | null>(
    null,
  );
  const [historyTarget, setHistoryTarget] = useState<Document | null>(null);

  const query = useDocumentsQuery();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // `?openPicker=<slug>` arrives from the composer's signed-in redirect
  // (see PendingEditorFileHydrator Step 1). Open the DocPickerModal for
  // that tool once, then strip the param from the URL so a refresh
  // doesn't re-open it. React's "adjust state during render" pattern
  // (see rename-document-modal.tsx) avoids the set-state-in-effect
  // lint + the flash a mount-effect would cause.
  const openPickerParam = searchParams.get("openPicker");
  const [pickerTool, setPickerTool] = useState<string | null>(openPickerParam);
  const [consumedPickerParam, setConsumedPickerParam] = useState<string | null>(
    openPickerParam,
  );

  if (openPickerParam !== consumedPickerParam) {
    setConsumedPickerParam(openPickerParam);
    if (openPickerParam) setPickerTool(openPickerParam);
  }

  // Flow 1 (spec 2026-09-09) post-signup landing moved OUT of the
  // dashboard 2026-09-09: the overlay is now on `/pdf-composer`
  // (`<FlowOneConvertPendingOverlay/>`) so the user lands directly
  // on the editor and sees a "Converting…" spinner while the
  // backend runs the X→PDF conversion. The paywall then fires from
  // `useEditorDocumentLoader` on the converted doc. See
  // `components/sections/pdf-editor/FlowOneConvertPendingOverlay.tsx`.

  useEffect(() => {
    if (!openPickerParam) return;
    const next = new URLSearchParams(searchParams.toString());

    next.delete("openPicker");
    const suffix = next.toString();

    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  }, [openPickerParam, pathname, router, searchParams]);

  // `?tour=dashboard` triggers the product tour, then strips the param.
  const tourParam = searchParams.get("tour");

  useEffect(() => {
    if (tourParam !== "dashboard") return;
    startDashboardTour();

    const next = new URLSearchParams(searchParams.toString());

    next.delete("tour");
    const suffix = next.toString();

    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  }, [tourParam, pathname, router, searchParams, startDashboardTour]);

  const items: readonly Document[] = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const uploader = useMemo(
    () => ({
      name: user?.fullName ?? "You",
      email: user?.primaryEmailAddress?.emailAddress ?? "",
      avatarUrl: user?.imageUrl ?? null,
    }),
    [user],
  );

  // Pending conversions land at the top so the "Preparing your
  // document…" row is the first thing the user sees when they get
  // bounced here from a `/convert/*` upload. Filtered against saved
  // rows by filename so a completed conversion that has already
  // refetched into `items` doesn't render twice for one blink.
  const pendingItems = usePendingConversionsStore((s) => s.items);
  const pendingRows: readonly PvFileRow[] = useMemo(() => {
    const savedNames = new Set(items.map((d) => d.filename));

    return pendingItems
      .filter((p) => !savedNames.has(p.filename))
      .map((p) => pendingConversionToFileRow(p, uploader));
  }, [pendingItems, items, uploader]);

  const rows: readonly PvFileRow[] = useMemo(
    () => [
      ...pendingRows,
      ...items.map((doc) => documentToFileRow(doc, uploader)),
    ],
    [pendingRows, items, uploader],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.uploadedByName.toLowerCase().includes(q) ||
        row.uploadedByEmail.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const handleDownload = async (row: PvFileRow) => {
    if (!row.doc) return;
    try {
      await triggerDocumentDownload(row.doc);
    } catch (err) {
      toast.error({
        title: "Download failed",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PendingConversionBanner />
      <PvPageHeader
        action={<UploadPdfButton />}
        subtitle="Open, rename, download, or delete your saved PDFs."
        title="My PDFs"
      />
      <PvQuickToolCards />
      <PvSearchToolbar value={search} onChange={setSearch} />
      <PvFileTable
        isLoading={query.isLoading}
        rows={filteredRows}
        onBulkDelete={(bulk) =>
          setBulkDeleteTargets(
            bulk.map((r) => r.doc).filter((d): d is Document => d !== null),
          )
        }
        onDelete={(row) => {
          if (row.doc) setDeleteTarget(row.doc);
        }}
        onDownload={(row) => void handleDownload(row)}
        onHistory={(row) => {
          if (row.doc) setHistoryTarget(row.doc);
        }}
        onOpen={(row) => {
          if (!row.doc) return;
          void openDocumentInEditor(router, row.doc).catch((err) => {
            toast.error({
              title: "Couldn't open file",
              description: err instanceof Error ? err.message : undefined,
            });
          });
        }}
        onRename={(row) => {
          if (row.doc) setRenameTarget(row.doc);
        }}
      />

      <RenameDocumentModal
        document={renameTarget}
        onClose={() => setRenameTarget(null)}
      />
      <DeleteDocumentModal
        document={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
      <BulkDeleteDocumentsModal
        documents={bulkDeleteTargets}
        onClose={() => setBulkDeleteTargets(null)}
      />
      <DocPickerModal
        isOpen={pickerTool !== null}
        toolLabel={pickerTool ? (TOOL_LABELS[pickerTool] ?? "Tool") : null}
        toolSlug={pickerTool}
        onClose={() => setPickerTool(null)}
      />
      <VersionHistoryModal
        documentId={historyTarget?.id ?? null}
        isOpen={historyTarget !== null}
        onClose={() => setHistoryTarget(null)}
        onRestored={() => {
          if (!historyTarget) return;
          void queryClient.invalidateQueries({
            queryKey: documentKeys.lists(),
          });
          void queryClient.invalidateQueries({
            queryKey: documentKeys.detail(historyTarget.id),
          });
        }}
      />
    </div>
  );
}
