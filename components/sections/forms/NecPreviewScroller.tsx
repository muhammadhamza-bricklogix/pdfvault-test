"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const PREVIEW_IMG = "/static/forms/1099-nec-preview.png";
const NATURAL_WIDTH = 927;
const NATURAL_HEIGHT = 1200;

const IDLE_START_MS = 1000;
const CYCLE_DURATION_MS = 8000;

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
 * Hero preview showcase for the 1099-NEC landing page.
 */
export function NecPreviewScroller() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLDivElement | null>(null);
  const [isPaused, setIsPaused] = useState(true);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  useEffect(() => {
    if (reducedMotion) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let observer: IntersectionObserver | null = null;

    const startTimer = () => {
      timeoutId = setTimeout(() => {
        setIsPaused(false);
      }, IDLE_START_MS);
    };

    const target = frameRef.current;

    if (target && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];

          if (entry?.isIntersecting) {
            startTimer();
          } else {
            if (timeoutId) clearTimeout(timeoutId);
            setIsPaused(true);
          }
        },
        { threshold: 0.25 },
      );
      observer.observe(target);
    } else {
      startTimer();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (observer) observer.disconnect();
    };
  }, [reducedMotion]);

  useEffect(() => {
    const img = imageRef.current;
    const frame = frameRef.current;

    if (!img || !frame || reducedMotion) return;

    const frameHeight = frame.clientHeight;
    const imgHeight = img.clientHeight;
    const maxShift = Math.max(0, imgHeight - frameHeight);

    if (maxShift === 0) return;

    let animationFrameId: number;
    let startTime: number | null = null;
    let pausedTime = 0;
    let pauseStart: number | null = null;

    const step = (now: number) => {
      if (isPaused) {
        if (pauseStart === null) pauseStart = now;
        animationFrameId = requestAnimationFrame(step);

        return;
      }

      if (pauseStart !== null) {
        pausedTime += now - pauseStart;
        pauseStart = null;
      }

      if (startTime === null) startTime = now;
      const elapsed = now - startTime - pausedTime;
      const progress = (elapsed % CYCLE_DURATION_MS) / CYCLE_DURATION_MS;

      const factor = 0.5 - 0.5 * Math.cos(progress * 2 * Math.PI);
      const currentShift = factor * maxShift;

      img.style.transform = `translate3d(0, -${currentShift.toFixed(2)}px, 0)`;

      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPaused, reducedMotion]);

  return (
    <div
      ref={frameRef}
      className="relative mx-auto h-[320px] w-full max-w-2xl overflow-hidden rounded-2xl border border-default-200 bg-default-100 shadow-xl dark:border-default-700 sm:h-[420px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        if (!reducedMotion) setIsPaused(false);
      }}
    >
      <div
        ref={imageRef}
        className="relative w-full will-change-transform"
        style={{ transform: "translate3d(0, 0, 0)" }}
      >
        <Image
          priority
          alt="IRS Form 1099-NEC preview"
          className="h-auto w-full object-contain"
          height={NATURAL_HEIGHT}
          sizes="(max-width: 640px) 100vw, 672px"
          src={PREVIEW_IMG}
          width={NATURAL_WIDTH}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--color-background)] to-transparent opacity-80" />
    </div>
  );
}
