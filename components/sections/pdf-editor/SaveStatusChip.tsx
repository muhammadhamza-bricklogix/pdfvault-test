"use client";

import { CheckmarkCircle02Icon, Time04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { usePdfEditorStore } from "@/lib/client/stores";

// Small status pill rendered next to the filename in the editor's top
// chrome. Answers the QA feedback "users didn't know files were being
// auto-saved to My PDFs" (item 18, 13, 50 from the 2026-07-29 QA round).
//
// States:
//   - Signed-in + saved doc + no dirty edits → "Saved to My PDFs"
//   - Signed-in + saved doc + dirty → "Unsaved edits"
//   - Signed-in + no saved doc yet → "Saving…" (first auto-upload in flight
//     via pending-editor-file-hydrator)
//   - Signed-out → hidden (there's a separate sign-in prompt for Save)
export function SaveStatusChip({ compact = false }: { compact?: boolean }) {
  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const hasUnsavedChanges = usePdfEditorStore((s) => s.hasUnsavedChanges);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const file = usePdfEditorStore((s) => s.file);

  if (!isSignedIn || !file) return null;

  let label: string;
  let icon = CheckmarkCircle02Icon;
  let tone: "saved" | "dirty" | "pending" = "saved";

  if (!currentDocumentId) {
    label = "Saving to My PDFs…";
    icon = Time04Icon;
    tone = "pending";
  } else if (hasUnsavedChanges) {
    label = "Unsaved edits";
    icon = Time04Icon;
    tone = "dirty";
  } else {
    label = "Saved to My PDFs";
    tone = "saved";
  }

  const toneClass =
    tone === "saved"
      ? "text-emerald-600 bg-emerald-50 ring-emerald-200"
      : tone === "dirty"
        ? "text-amber-700 bg-amber-50 ring-amber-200"
        : "text-default-600 bg-default-50 ring-default-200";

  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${toneClass}`}
      role="status"
    >
      <HugeiconsIcon icon={icon} size={12} strokeWidth={2} />
      {!compact && <span>{label}</span>}
    </span>
  );
}
