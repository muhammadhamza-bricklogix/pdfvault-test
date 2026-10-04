/**
 * Event bus for the "file already exists in your library" prompt.
 *
 * Mirrors `paywall-bus`'s shape — a module-level handler slot the
 * `DuplicateFilenameModal` registers on mount, plus a promise-based
 * `requestDuplicatePrompt` that any save/auto-persist path can await
 * before deciding to Overwrite or Cancel.
 *
 * QA 2026-09-06: signed-in user re-uploads (or auto-adopts a
 * signed-out-then-signed-in file) whose name already exists in their
 * Vault. Currently the save silently fails or creates a duplicate row;
 * the UX needs an explicit choice with an Overwrite / Cancel modal so
 * the user is never stranded without a save path.
 */

import type { Document } from "@/lib/shared/types/documents.types";

export type DuplicateOutcome = "overwrite" | "cancel";

export interface DuplicatePromptRequest {
  filename: string;
  existing: Document;
}

type Handler = (req: DuplicatePromptRequest) => Promise<DuplicateOutcome>;

let handler: Handler | null = null;

/**
 * Called by `DuplicateFilenameModal` on mount to register itself.
 * Passing `null` on unmount clears the slot so a stale handler doesn't
 * outlive its component tree during HMR.
 */
export function setDuplicatePromptHandler(next: Handler | null): void {
  handler = next;
}

/**
 * Trigger the "file already exists" prompt and wait for the user to
 * pick Overwrite or Cancel. If no handler is registered (SSR, early
 * boot, or the modal was intentionally not mounted for a particular
 * surface), resolves to `cancel` so the caller falls back to the
 * safe path — never silently overwrites.
 */
export function requestDuplicatePrompt(
  req: DuplicatePromptRequest,
): Promise<DuplicateOutcome> {
  if (!handler) return Promise.resolve("cancel");

  return handler(req);
}
