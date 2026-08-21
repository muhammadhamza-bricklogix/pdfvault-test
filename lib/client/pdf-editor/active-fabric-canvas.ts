import type { Canvas as FabricCanvas } from "fabric";

/**
 * Small pub/sub module that publishes the currently-mounted pdf-composer
 * Fabric canvas so cross-feature integrations (e.g. the W-9 form-field →
 * Fabric value sync) can subscribe without dragging the reference through
 * React context down every layer of PdfEditorShell.
 *
 * The publisher is `PdfEditorShell` (one `useEffect` writing on mount /
 * clearing on unmount). Any subscriber wired via `useSyncExternalStore`
 * gets the current value on first render and re-renders when it changes.
 *
 * Only one canvas is mounted at a time in the pdf editor, so a single
 * slot is enough — no need for a Map keyed by editor instance.
 */

type Listener = () => void;

let current: FabricCanvas | null = null;
const listeners = new Set<Listener>();

export function publishActiveFabricCanvas(next: FabricCanvas | null): void {
  if (current === next) return;
  current = next;
  listeners.forEach((l) => l());
}

export function getActiveFabricCanvas(): FabricCanvas | null {
  return current;
}

export function getActiveFabricCanvasServerSnapshot(): FabricCanvas | null {
  return null;
}

export function subscribeActiveFabricCanvas(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
