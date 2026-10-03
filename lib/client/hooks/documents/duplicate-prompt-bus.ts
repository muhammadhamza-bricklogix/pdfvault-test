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

/**
 * What the user chose.
 *
 * `rename` carries the name they settled on, so the caller saves under it and
 * creates a NEW row rather than claiming the existing one.
 */
export type DuplicateOutcome =
  | { kind: "overwrite" }
  | { kind: "rename"; filename: string }
  | { kind: "cancel" };

export interface DuplicatePromptRequest {
  filename: string;
  existing: Document;
  /**
   * Pre-filled value for the rename input — the first free "name (n)" the
   * caller found. Omitted when the caller could not look one up, in which
   * case the modal falls back to the colliding name.
   */
  suggestion?: string;
}

type Handler = (req: DuplicatePromptRequest) => Promise<DuplicateOutcome>;

let handler: Handler | null = null;
let inFlight: Promise<DuplicateOutcome> | null = null;
/** Lets the bus force-resolve the open prompt if the modal disappears. */
let settleInFlight: ((outcome: DuplicateOutcome) => void) | null = null;

/**
 * True while a prompt is waiting on the user. The navigation-save timeout
 * consults this so a slow decision is not reported as a failed save.
 */
export function isDuplicatePromptOpen(): boolean {
  return inFlight !== null;
}

/**
 * Resolves once no prompt is open.
 *
 * A save that arrives while the user is already deciding about a filename
 * (autosave has one open, then the user clicks Back) must WAIT for that
 * decision rather than be refused — refusing it reads as "user cancelled"
 * and silently strands the navigation.
 */
export async function waitForDuplicatePrompt(): Promise<void> {
  // Bounded: a save must never be able to hang forever behind this. Two
  // minutes is far longer than any real decision and still finite.
  const deadline = Date.now() + 120_000;

  while (inFlight && Date.now() < deadline) {
    try {
      await inFlight;
    } catch {
      // The prompt's own caller handles its failure; we only care that it
      // is no longer open.
      break;
    }
  }
}

/**
 * Called by `DuplicateFilenameModal` on mount to register itself.
 * Passing `null` on unmount clears the slot so a stale handler doesn't
 * outlive its component tree during HMR.
 */
export function setDuplicatePromptHandler(next: Handler | null): void {
  handler = next;

  // Clearing the slot means the modal is going away. Anything still waiting
  // on it would otherwise wait forever — and because `inFlight` would never
  // clear, EVERY later save would hang in `waitForDuplicatePrompt`.
  if (!next) settleInFlight?.({ kind: "cancel" });
}

/**
 * Trigger the "file already exists" prompt and wait for the user to
 * pick Overwrite, Rename or Cancel. If no handler is registered (SSR,
 * early boot, or the modal was intentionally not mounted for a particular
 * surface), resolves to `cancel` so the caller falls back to the
 * safe path — never silently overwrites.
 */
export function requestDuplicatePrompt(
  req: DuplicatePromptRequest,
): Promise<DuplicateOutcome> {
  if (!handler) return Promise.resolve({ kind: "cancel" });

  // The modal keeps a single `resolve` slot, so a second concurrent request
  // would orphan the first promise. Callers are expected to have awaited
  // `waitForDuplicatePrompt()` first; this is the backstop for the ones
  // that race anyway (a double-clicked Back button).
  if (inFlight) return Promise.resolve({ kind: "cancel" });

  // Raced against the handler so the bus can always settle it — see
  // `setDuplicatePromptHandler`.
  const promise = Promise.race([
    handler(req),
    new Promise<DuplicateOutcome>((resolve) => {
      settleInFlight = resolve;
    }),
  ]).finally(() => {
    inFlight = null;
    settleInFlight = null;
  });

  inFlight = promise;

  return promise;
}
