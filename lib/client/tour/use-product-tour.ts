"use client";

import { driver } from "driver.js";
import { useCallback, useEffect } from "react";

import { TOUR_STORAGE_KEYS, TOURS, type TourKey } from "./tour-config";

import "driver.js/dist/driver.css";

/**
 * Event name fired when any tour instance is destroyed (completed,
 * skipped, or route-change cleanup). Listeners can defer their own
 * work until after the tour finishes — e.g. the composer hydrator
 * uses this to wait out the tour before dispatching a tool-open event
 * when the tour is manually started from `TourHelpButton`.
 */
export const TOUR_ENDED_EVENT = "editor:tour-ended";

/**
 * Retained for backwards-compatibility with the composer hydrator
 * (`pending-editor-file-hydrator.tsx`) which checks this flag before
 * deferring its auto-launch behind `TOUR_ENDED_EVENT`. Auto-launch is
 * disabled (product decision 2026-09-17: interrupting first use hurt
 * conversion; tours are now user-initiated via `TourHelpButton`), so
 * this always returns false and the hydrator takes the return-visitor
 * (instant launch) path.
 */
export function willTourAutoLaunch(_key: TourKey): boolean {
  return false;
}

// Module-level singleton so the hook stays safe when multiple
// components mount it for the same surface (e.g. DashboardHome +
// TourHelpButton both call useProductTour("dashboard")). Without
// this guard, each caller spawns its own driver instance and the
// overlays overlap on screen — two "Next" buttons visible at once.
let activeInstance: ReturnType<typeof driver> | null = null;

type DataLayerWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
};

function pushDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const w = window as DataLayerWindow;

  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(payload);
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
    if (!enabled) return;
    if (typeof window === "undefined") return;

    // Kill any prior instance BEFORE spawning a new one. Guards against
    // two callers of this hook racing to `.drive()` on top of each
    // other, or the user hitting the help button while a tour is
    // already running.
    if (activeInstance) {
      activeInstance.destroy();
      activeInstance = null;
    }

    const totalSteps = TOURS[key].length;
    let lastStepIndex = 0;

    // GA4 via GTM — fires "tour_started" so completion rate can be
    // computed against "tour_ended" downstream.
    pushDataLayer({
      event: "tour_started",
      tour_key: key,
      total_steps: totalSteps,
    });

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
        // Mobile UX #21: driver.js cuts a hole in its overlay over the
        // highlighted "stage" element, and by default leaves whatever's
        // under that hole fully clickable — meant for tours that want the
        // user to click the real UI as a tour step. None of ours are that
        // kind (every step here is just "here's this area", not "click
        // this"), so real controls underneath a highlighted section (a
        // Quick Tools card, the language switcher inside the nav, an
        // unlock/upgrade action in the profile menu) stayed tappable
        // DURING the tour. Tapping one opened the real app modal behind
        // the tour, stacking two overlays with their own darkened
        // backdrops on top of each other. `disableActiveInteraction`
        // keeps the stage visible/highlighted but inert to clicks, same
        // as the rest of the dimmed page.
        disableActiveInteraction: true,
        popoverClass: "pv-tour-popover",
        overlayColor: "#171717",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Got it",
        steps: TOURS[key],
        onHighlightStarted: (_el, _step, opts) => {
          const idx = opts?.state?.activeIndex;

          if (typeof idx === "number") lastStepIndex = idx;
        },
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

          const completed = lastStepIndex >= totalSteps - 1;

          pushDataLayer({
            event: "tour_ended",
            tour_key: key,
            last_step_index: lastStepIndex,
            total_steps: totalSteps,
            completed,
            completion_rate:
              totalSteps > 0
                ? Math.round(((lastStepIndex + 1) / totalSteps) * 100)
                : 0,
          });

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
  }, [key, enabled]);

  // Destroy any active tour instance when the host component unmounts —
  // the most common trigger is a route change (browser back, in-app
  // navigation). driver.js paints its overlay onto <body>, so without
  // this cleanup the popover + backdrop leak onto the destination page
  // (user report: tour visible on landing after leaving the editor).
  // `activeInstance` is a module-level singleton, so tearing it down
  // here doesn't affect other surfaces — the next surface's mount
  // triggers its own `start()`.
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
