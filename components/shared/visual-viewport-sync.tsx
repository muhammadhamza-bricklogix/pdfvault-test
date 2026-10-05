"use client";

import { useEffect } from "react";

import {
  readViewportFrame,
  revealInDialog,
} from "@/lib/client/ui/visual-viewport";

const TOP_VAR = "--pv-vv-top";
const HEIGHT_VAR = "--pv-vv-height";

/**
 * Touch devices only. Publishes the visible area (iOS keyboard) as CSS vars so
 * HeroUI modals follow it (see globals.css), and keeps the focused field of an
 * open dialog, plus its error message, inside that area.
 */
export function VisualViewportSync() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const vv = window.visualViewport;

    if (!vv) return;

    const root = document.documentElement;
    const timers = new Set<number>();
    let lastHeight: number | null = null;

    const revealFocused = () => revealInDialog(document.activeElement);
    // Runs after the keyboard layout commits; repeated calls are no-ops once visible.
    const scheduleReveal = () => {
      requestAnimationFrame(() => requestAnimationFrame(revealFocused));
      const id = window.setTimeout(() => {
        timers.delete(id);
        revealFocused();
      }, 300);

      timers.add(id);
    };

    const sync = () => {
      const frame = readViewportFrame();

      // Root vars restyle the whole page, so only publish them while a modal is open.
      if (frame && document.querySelector(".modal__backdrop")) {
        root.style.setProperty(TOP_VAR, `${frame.top}px`);
        root.style.setProperty(HEIGHT_VAR, `${frame.height}px`);
      } else {
        root.style.removeProperty(TOP_VAR);
        root.style.removeProperty(HEIGHT_VAR);
      }

      const height = frame?.height ?? null;

      if (height !== lastHeight) {
        const shrank =
          height !== null && (lastHeight === null || height < lastHeight);

        lastHeight = height;
        if (shrank) scheduleReveal();
      }
    };

    const onFocusIn = () => {
      sync();
      scheduleReveal();
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("input", scheduleReveal, true);

    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("input", scheduleReveal, true);
      timers.forEach((id) => window.clearTimeout(id));
      root.style.removeProperty(TOP_VAR);
      root.style.removeProperty(HEIGHT_VAR);
    };
  }, []);

  return null;
}
