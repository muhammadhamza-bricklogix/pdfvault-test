"use client";

import { useState } from "react";

import { UploadWorkspace } from "./upload-workspace";

type HeroMode = "edit" | "convert";

export function LandingHero() {
  const [mode, setMode] = useState<HeroMode>("edit");

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden bg-white"
    >
      {/* HeroBackground grid removed per user request — plain white
          background under the hero copy. */}

      <div className="pv-container relative z-10 flex flex-col items-center pt-16 text-center sm:pt-[8vh]">
        <h1 className="pv-display max-w-[760px] text-balance" id="hero-heading">
          Edit, sign, or convert any PDF in seconds
        </h1>
        <p className="mt-6 max-w-[600px] text-[17px] leading-relaxed text-[var(--pv-text-secondary)]">
          Sign, edit, protect and much more. Keep important documents in one
          secure workspace without losing track of files that matter.
        </p>

        {/* Segmented pill — flips the hero drop-zone between "Edit"
            (default: open in PDF composer) and "Convert" (route through
            the X→PDF pipeline, same as /convert/*). */}
        <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-[#e5e5e5] bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <ModeButton
            active={mode === "edit"}
            label="Edit"
            onSelect={() => setMode("edit")}
          />
          <ModeButton
            active={mode === "convert"}
            label="Convert"
            onSelect={() => setMode("convert")}
          />
        </div>
      </div>

      {/* Compact hero drop-zone (see public/landing/Background+Border.png).
          Wider full-frame variant with cloud chips lives on `/convert/*`. */}
      <div className="relative z-10 mx-auto w-full max-w-[880px] px-6 pb-10 pt-8">
        <UploadWorkspace heroMode={mode} variant="hero" />
      </div>
    </section>
  );
}

function ModeButton({
  active,
  label,
  onSelect,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex h-9 min-w-[92px] cursor-pointer items-center justify-center rounded-full px-5 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pv-brand-primary)] ${
        active
          ? "bg-[#F12C23] text-white shadow-[0_1px_2px_rgba(241,44,35,0.35)]"
          : "text-[#5f5f5f] hover:text-[#121212]"
      }`}
      type="button"
      onClick={onSelect}
    >
      {label}
    </button>
  );
}
