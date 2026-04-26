"use client";

import { DocumentsTable } from "./documents-table";
import { UploadCta } from "./upload-cta";

export function DashboardHome() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        My Documents
                    </h1>
                    <p className="text-sm text-[var(--app-muted)]">
                        Open, rename, download, or delete your saved PDFs.
                    </p>
                </div>

                <UploadCta />
            </div>

            <DocumentsTable />
        </div>
    );
}
