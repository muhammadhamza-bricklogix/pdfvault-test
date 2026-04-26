"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import {
    File01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Spinner, Table } from "@heroui/react";
import { useMemo, useState } from "react";

import { useDocumentsQuery } from "@/lib/client/query/queries/documents.query";

import { DocumentActionsMenu } from "./document-actions-menu";
import { DocumentThumbnail } from "./document-thumbnail";
import { RenameDocumentModal } from "./rename-document-modal";
import { DeleteDocumentModal } from "./delete-document-modal";

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
    const d = new Date(iso);

    return d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export function DocumentsTable() {
    const query = useDocumentsQuery();
    const [renameTarget, setRenameTarget] = useState<Document | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

    const items = useMemo(
        () => query.data?.pages.flatMap((p) => p.items) ?? [],
        [query.data],
    );

    const isInitialLoading = query.isLoading;
    const isEmpty = !isInitialLoading && items.length === 0;

    if (isInitialLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (query.isError) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-center">
                <p className="text-sm font-medium">Failed to load documents.</p>
                {query.error instanceof Error ? (
                    <p className="max-w-md text-xs text-[var(--app-muted)]">
                        {query.error.message}
                    </p>
                ) : null}
                <Button onPress={() => query.refetch()}>Retry</Button>
            </div>
        );
    }

    if (isEmpty) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--app-border)] p-6 text-center">
                <HugeiconsIcon
                    className="text-[var(--app-muted)]"
                    icon={File01Icon}
                    size={32}
                />
                <p className="text-sm font-medium">No documents yet</p>
                <p className="text-xs text-[var(--app-muted)]">
                    Upload a PDF to see it here.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--color-background)]">
                <Table aria-label="My documents">
                    <Table.ScrollContainer className="max-h-[70vh]">
                        <Table.Content>
                            <Table.Header>
                                <Table.Column id="thumb" width={64}>
                                    {""}
                                </Table.Column>
                                <Table.Column id="name" isRowHeader>
                                    Name
                                </Table.Column>
                                <Table.Column id="size" width={100}>
                                    Size
                                </Table.Column>
                                <Table.Column id="pages" width={80}>
                                    Pages
                                </Table.Column>
                                <Table.Column id="updated" width={140}>
                                    Updated
                                </Table.Column>
                                <Table.Column id="actions" width={60}>
                                    <span className="sr-only">Actions</span>
                                </Table.Column>
                            </Table.Header>
                            <Table.Body>
                                {items.map((doc) => (
                                    <Table.Row key={doc.id} href={`/pdf-editor?id=${doc.id}`}>
                                        <Table.Cell>
                                            <DocumentThumbnail document={doc} />
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="line-clamp-1 font-medium">
                                                {doc.name}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="text-sm text-[var(--app-muted)]">
                                                {formatBytes(doc.size)}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="text-sm text-[var(--app-muted)]">
                                                {doc.pageCount ?? "—"}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="text-sm text-[var(--app-muted)]">
                                                {formatDate(doc.updatedAt)}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <DocumentActionsMenu
                                                document={doc}
                                                onDelete={() => setDeleteTarget(doc)}
                                                onRename={() => setRenameTarget(doc)}
                                            />
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                            <Table.LoadMore
                                isLoading={query.isFetchingNextPage}
                                onLoadMore={() => {
                                    if (query.hasNextPage && !query.isFetchingNextPage) {
                                        void query.fetchNextPage();
                                    }
                                }}
                            >
                                <Table.LoadMoreContent>
                                    <Spinner size="sm" />
                                </Table.LoadMoreContent>
                            </Table.LoadMore>
                        </Table.Content>
                    </Table.ScrollContainer>
                </Table>
            </div>

            <RenameDocumentModal
                document={renameTarget}
                onClose={() => setRenameTarget(null)}
            />
            <DeleteDocumentModal
                document={deleteTarget}
                onClose={() => setDeleteTarget(null)}
            />
        </>
    );
}
