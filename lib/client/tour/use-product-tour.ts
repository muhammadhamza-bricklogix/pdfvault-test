"use client";

import { driver } from "driver.js";
import { useCallback, useEffect, useRef } from "react";

import { TOUR_STORAGE_KEYS, TOURS, type TourKey } from "./tour-config";

import "driver.js/dist/driver.css";

// Auto-launch is desktop-only. On mobile the sidebar is behind a
// hamburger and the editor's chrome differs — a driven overlay would
// mis-anchor. The help button (`?`) still lets a mobile user replay.
const AUTO_LAUNCH_MIN_WIDTH = 768;

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

export function useProductTour(key: TourKey) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;

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
        onDestroyed: () => {
          markSeen(key);
        },
      });

      driverRef.current = instance;
      instance.drive();
    });
  }, [key]);

  // Auto-launch once per surface, desktop only.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < AUTO_LAUNCH_MIN_WIDTH) return;
    if (alreadySeen(key)) return;

    const id = window.setTimeout(() => {
      start();
    }, 600);

    return () => window.clearTimeout(id);
  }, [key, start]);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  return { start };
}
