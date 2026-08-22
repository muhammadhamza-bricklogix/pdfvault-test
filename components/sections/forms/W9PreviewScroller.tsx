"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const PREVIEW_IMG = "/static/forms/w9-preview.png";
const NATURAL_WIDTH = 927;
const NATURAL_HEIGHT = 1200;

// Time from initial mount before the scroll-loop kicks in. Long enough that
// a user who lands and immediately scrolls doesn't see the animation start
// under them (matches the "user stays for a second" spec).
const IDLE_START_MS = 1000;

// One full down→up cycle. Slow enough to feel like a considered showcase
// rather than a distracting ticker.
const CYCLE_DURATION_MS = 8000;

// External-store subscription for prefers-reduced-motion. Using
// `useSyncExternalStore` (vs. a `useEffect` + `setState`) avoids the
// react-hooks/set-state-in-effect lint rule and keeps SSR / client
// snapshots aligned — the server always renders motion enabled (default
// false), and the client hydrates with the user's actual OS preference.
function subscribeReducedMotion(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");

  mql.addEventListener("change", cb);

  return () => mql.removeEventListener("change", cb);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") return false;

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

/**
 * Hero preview showcase for the W-9 landing page.
 *
 * Renders the full-page W-9 preview PNG inside a fixed-height frame.
 * After the user has been on the page for ~1 second, the image translates
 * vertically from top to bottom and back in a loop so first-time visitors
 * see every section of the form (identity → tax classification →
 * signature) without touching the page scroll position.
 *
 * Pauses on:
 *   - Hover / focus-within (user is looking at a specific part)
 *   - `prefers-reduced-motion` users (respects OS-level accessibility)
 *   - When scrolled off-screen (no wasted paint work)
 */
export function W9PreviewScroller() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLDivElement | null>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  // Wait `IDLE_START_MS` after mount before starting the animation so the
  // user isn't hit with motion the instant the page renders.
  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = window.setTimeout(() => setIsPaused(false), IDLE_START_MS);

    return () => window.clearTimeout(id);
  }, [prefersReducedMotion]);

  // Pause the loop when the frame scrolls out of view. Saves paint work on
  // long pages and stops the animation from "catching up" when the user
  // scrolls back — starts fresh each time.
  useEffect(() => {
    const el = frameRef.current;

    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.1 },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const shouldAnimate = isVisible && !isPaused && !prefersReducedMotion;

  return (
    <div
      ref={frameRef}
      className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-default-200 bg-white shadow-lg shadow-black/5 dark:border-default-700"
      style={{ aspectRatio: "927 / 640" }}
      onBlur={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Full-height inner track. We translate this element up/down by
          computing the delta between the frame height (aspect 927/640) and
          the image height (aspect 927/1200) at the same width. The image
          is ~1.875x taller than the frame — animating translateY between
          0% and -(1 - frameH/imageH) shows every part of the form. */}
      <div
        ref={imageRef}
        className={shouldAnimate ? "w9-preview-scroll" : ""}
        style={{
          animationDuration: `${CYCLE_DURATION_MS}ms`,
        }}
      >
        <Image
          priority
          alt="Preview of IRS Form W-9 page 1"
          className="h-auto w-full select-none"
          draggable={false}
          height={NATURAL_HEIGHT}
          src={PREVIEW_IMG}
          width={NATURAL_WIDTH}
        />
      </div>

      {/* Subtle vignette so the top/bottom edges look intentional as the
          image scrolls past them. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent dark:from-default-950"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent dark:from-default-950"
      />

      <style>{`
        /* Image is 927x1200; frame aspect is 927/640. At any given width,
           the image is 1200/640 = 1.875x the frame height. To scroll from
           top-flush to bottom-flush we translate the image up by
           (image_h - frame_h) / image_h = (1200-640)/1200 = 46.67% of its
           own height. translateY percentages are relative to the element
           itself, which is the correct anchor here. */
        @keyframes w9PreviewScroll {
          0%   { transform: translateY(0%); }
          45%  { transform: translateY(-46.67%); }
          55%  { transform: translateY(-46.67%); }
          100% { transform: translateY(0%); }
        }
        .w9-preview-scroll {
          animation-name: w9PreviewScroll;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
      `}</style>
    </div>
  );
}
