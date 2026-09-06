"use client";

import { driver } from "driver.js";
import { useCallback, useEffect } from "react";

import { TOUR_STORAGE_KEYS, TOURS, type TourKey } from "./tour-config";

import "driver.js/dist/driver.css";

// Auto-launch is desktop-only. On mobile the sidebar is behind a
// hamburger and the editor's chrome differs — a driven overlay would
// mis-anchor. The help button (`?`) still lets a mobile user replay.
const AUTO_LAUNCH_MIN_WIDTH = 768;

/**
 * Event name fired when any tour instance is destroyed (completed,
 * skipped, or route-change cleanup). Listeners can defer their own
 * work until after the tour finishes — e.g. the composer hydrator
 * uses this to wait out the first-visit tour before dispatching a
 * tool-open event (QA 2026-09-06: tool modal + tour opened together
 * and interfered with each other).
 */
export const TOUR_ENDED_EVENT = "editor:tour-ended";

/**
 * True when `useProductTour(key)` WOULD auto-launch on this visit —
 * used by out-of-tree callers (hydrator, etc.) to decide whether to
 * defer their own work behind the tour. Mirrors the exact gates in
 * the auto-launch effect below (SSR-safe, viewport-gated,
 * already-seen aware, module-level dedupe).
 */
export function willTourAutoLaunch(key: TourKey): boolean {
  if (typeof window === "undefined") return false;
  if (window.innerWidth < AUTO_LAUNCH_MIN_WIDTH) return false;
  if (alreadySeen(key)) return false;
  if (autoLaunchedKeys.has(key)) return false;

  return true;
}

// Module-level singletons so the hook stays safe when multiple
// components mount it for the same surface (e.g. DashboardHome +
// TourHelpButton both call useProductTour("dashboard")). Without
// these guards, each caller spawns its own driver instance and the
// overlays overlap on screen — two "Next" buttons visible at once.
const autoLaunchedKeys = new Set<TourKey>();
let activeInstance: ReturnType<typeof driver> | null = null;

function alreadySeen(key: TourKey): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEYS[key]) === "1";
  } catch {
    return true;
  }
}

function markSeen(key: TourKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEYS[key], "1");
  } catch {
    // Private-mode storage rejection is fine — the tour just re-launches next visit.
  }
}

export function useProductTour(key: TourKey, enabled: boolean = true) {
  const start = useCallback(() => {
    if (typeof window === "undefined") return;

    // Kill any prior instance BEFORE spawning a new one. Guards against
    // two callers of this hook racing to `.drive()` on top of each
    // other, or the user hitting the help button while a tour is
    // already running.
    if (activeInstance) {
      activeInstance.destroy();
      activeInstance = null;
    }

    // Wait a frame so the target elements are actually mounted when the
    // caller fires immediately after a route transition.
    requestAnimationFrame(() => {
      const instance = driver({
        showProgress: true,
        allowClose: true,
        overlayOpacity: 0.55,
        stagePadding: 6,
        stageRadius: 12,
        smoothScroll: true,
        popoverClass: "pv-tour-popover",
        overlayColor: "#171717",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Got it",
        steps: TOURS[key],
        onPopoverRender: (popover) => {
          // Inject a "Skip all" button on the left of the footer.
          // driver.js re-renders the popover on every step, so this
          // fires per step — safe to build the button from scratch
          // each time.
          const skipBtn = document.createElement("button");

          skipBtn.type = "button";
          skipBtn.textContent = "Skip all";
          skipBtn.className = "pv-tour-skip-btn";
          skipBtn.addEventListener("click", () => {
            activeInstance?.destroy();
          });
          popover.footer.insertBefore(skipBtn, popover.footer.firstChild);
        },
        onDestroyed: () => {
          markSeen(key);
          if (activeInstance === instance) activeInstance = null;
          // Notify deferred consumers (composer hydrator, etc.) that
          // the tour is done so they can now run their own auto-launch
          // (tool modal, export, etc.) without fighting the driver.js
          // overlay for the top layer.
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent(TOUR_ENDED_EVENT, { detail: { key } }),
            );
          }
        },
      });

      activeInstance = instance;
      instance.drive();
    });
  }, [key]);

  // Auto-launch once per surface, desktop only. Module-level Set makes
  // sure only ONE caller triggers the tour per session even when
  // several components share the same `useProductTour(key)` call.
  // `enabled=false` short-circuits so a caller can suppress the tour on
  // specific routes without breaking the rules-of-hooks (e.g. the W-9
  // form reuses <PdfEditorShell /> but must NOT auto-run the editor
  // tour — anchors don't map, copy references the wrong surface).
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (window.innerWidth < AUTO_LAUNCH_MIN_WIDTH) return;
    if (alreadySeen(key)) return;
    if (autoLaunchedKeys.has(key)) return;
    autoLaunchedKeys.add(key);

    const id = window.setTimeout(() => {
      start();
    }, 600);

    return () => window.clearTimeout(id);
  }, [key, start, enabled]);

  // Destroy any active tour instance when the host component unmounts —
  // the most common trigger is a route change (browser back, in-app
  // navigation). driver.js paints its overlay onto <body>, so without
  // this cleanup the popover + backdrop leak onto the destination page
  // (user report: tour visible on landing after leaving the editor).
  // `activeInstance` is a module-level singleton, so tearing it down
  // here doesn't affect other surfaces — the next surface's mount
  // triggers its own `start()`. `markSeen` still fires via
  // `onDestroyed` so the tour won't auto-relaunch on the same key.
  useEffect(() => {
    return () => {
      if (activeInstance) {
        activeInstance.destroy();
        activeInstance = null;
      }
    };
  }, []);

  return { start };
}
