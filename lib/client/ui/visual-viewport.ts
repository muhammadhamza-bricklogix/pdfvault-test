"use client";

import { useEffect, useState } from "react";

export type ViewportFrame = { top: number; height: number };

/**
 * Visible area while the on-screen keyboard (or an iOS page pan) shrinks it,
 * in layout-viewport px. `null` when the whole layout viewport is visible.
 */
export function readViewportFrame(): ViewportFrame | null {
  const vv = window.visualViewport;

  // Pinch-zoom also shrinks the visual viewport; leave the layout alone then.
  if (!vv || vv.scale > 1.01) return null;

  const top = Math.max(0, Math.round(vv.offsetTop));
  const height = Math.round(vv.height);
  const layoutHeight = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight,
  );

  if (top === 0 && height >= layoutHeight - 1) return null;

  return { top, height };
}

/** Tracks `readViewportFrame()` on visualViewport resize/scroll. */
export function useVisualViewportFrame(enabled = true): ViewportFrame | null {
  const [frame, setFrame] = useState<ViewportFrame | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const vv = window.visualViewport;

    if (!vv) return;

    const sync = () => {
      const next = readViewportFrame();

      setFrame((prev) =>
        prev?.top === next?.top && prev?.height === next?.height ? prev : next,
      );
    };
    const raf = requestAnimationFrame(sync);

    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);

    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [enabled]);

  return enabled ? frame : null;
}

const EDGE_GAP_PX = 8;

function findScrollContainer(
  from: HTMLElement,
  dialog: Element,
): HTMLElement | null {
  let node: HTMLElement | null = from.parentElement;

  while (node && dialog.contains(node)) {
    const overflowY = getComputedStyle(node).overflowY;

    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

/**
 * Scrolls only the dialog's own scroll container (never the page, which makes
 * iOS pan and loop) so `target` and its nearby `role="alert"` message are
 * inside the visible area. No-op when they already are.
 */
export function revealInDialog(target: Element | null): void {
  if (!(target instanceof HTMLElement)) return;

  const dialog = target.closest('[role="dialog"], [role="alertdialog"]');

  if (!dialog) return;

  const scroller = findScrollContainer(target, dialog);

  if (!scroller) return;

  const targetRect = target.getBoundingClientRect();
  let top = targetRect.top;
  let bottom = targetRect.bottom;
  let group: HTMLElement | null = target.parentElement;

  for (let depth = 0; depth < 4 && group && group !== dialog; depth++) {
    const alert = group.querySelector('[role="alert"]');

    if (alert) {
      const alertRect = alert.getBoundingClientRect();

      top = Math.min(top, alertRect.top);
      bottom = Math.max(bottom, alertRect.bottom);
      break;
    }
    group = group.parentElement;
  }

  const vv = window.visualViewport;
  const bandTop = vv ? vv.offsetTop : 0;
  const bandBottom = bandTop + (vv ? vv.height : window.innerHeight);
  const scrollerRect = scroller.getBoundingClientRect();
  const visibleTop = Math.max(scrollerRect.top, bandTop) + EDGE_GAP_PX;
  const visibleBottom = Math.min(scrollerRect.bottom, bandBottom) - EDGE_GAP_PX;

  if (visibleBottom <= visibleTop) return;

  let delta = 0;

  if (bottom - top > visibleBottom - visibleTop || top < visibleTop) {
    delta = top - visibleTop;
  } else if (bottom > visibleBottom) {
    delta = bottom - visibleBottom;
  }

  if (Math.abs(delta) >= 1) scroller.scrollTop += delta;
}
