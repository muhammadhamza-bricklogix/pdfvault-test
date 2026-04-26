"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useEffect, useState } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

type PerformancePanelProps = {
  fabricCanvas: FabricCanvas | null;
  isOpen: boolean;
};

type MemoryInfo = {
  percent: number;
  usedMB: number;
};

export function PerformancePanel({
  fabricCanvas,
  isOpen,
}: PerformancePanelProps) {
  const file = usePdfEditorStore((s) => s.file);
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState<MemoryInfo | null>(null);

  // FPS counter
  useEffect(() => {
    if (!isOpen) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      frameCount++;
      const delta = now - lastTime;

      if (delta >= 1000) {
        setFps(Math.round((frameCount / delta) * 1000));
        frameCount = 0;
        lastTime = now;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  // Memory usage (Chrome only)
  useEffect(() => {
    if (!isOpen) return;

    const update = () => {
      const mem = (performance as unknown as Record<string, unknown>).memory as
        | { jsHeapSizeLimit: number; usedJSHeapSize: number }
        | undefined;

      if (mem) {
        const usedMB =
          Math.round((mem.usedJSHeapSize / 1024 / 1024) * 100) / 100;
        const percent =
          Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 1000) / 10;

        setMemory({ percent, usedMB });
      } else {
        setMemory(null);
      }
    };

    update();
    const interval = setInterval(update, 2000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const objectCount = fabricCanvas ? fabricCanvas.getObjects().length : 0;

  // File size
  const fileSizeDisplay = (() => {
    if (!file) return "0 KB";

    if (file.size > 1024 * 1024) {
      return `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    }

    return `${(file.size / 1024).toFixed(2)} KB`;
  })();

  if (!isOpen) return null;

  return (
    <div className="absolute right-4 top-4 z-50 w-60 rounded-lg border border-[var(--app-border)] bg-[var(--color-background)] p-3 shadow-lg">
      {/* Memory bar */}
      {memory ? (
        <div className="mb-3">
          <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--app-surface)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${Math.min(memory.percent, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--app-muted)]">
            <span>Total memory used</span>
            <span className="font-medium text-[var(--color-foreground)]">
              {memory.percent}% ({memory.usedMB} MB)
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-3 text-xs text-[var(--app-muted)]">
          Memory: N/A (Chrome only)
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
        <div>
          <span className="text-[var(--app-muted)]">Size</span>
          <p className="font-medium text-[var(--color-foreground)]">
            {fileSizeDisplay}
          </p>
        </div>
        <div>
          <span className="text-[var(--app-muted)]">Objects</span>
          <p className="font-medium text-[var(--color-foreground)]">
            {objectCount}
          </p>
        </div>
        <div>
          <span className="text-[var(--app-muted)]">Rotation</span>
          <p className="font-medium text-[var(--color-foreground)]">0&deg;</p>
        </div>
        <div>
          <span className="text-[var(--app-muted)]">FPS</span>
          <p className="font-medium text-[var(--color-foreground)]">{fps}</p>
        </div>
      </div>
    </div>
  );
}
