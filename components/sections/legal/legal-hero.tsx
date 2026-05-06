import {
  Calendar03Icon,
  Clock01Icon,
  Globe02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

type LegalHeroProps = {
  description: string;
  lastUpdatedLabel: string;
  readMinutes: number;
  siteDomain?: string;
  title: string;
};

export function LegalHero({
  description,
  lastUpdatedLabel,
  readMinutes,
  siteDomain = "pdfedits.io",
  title,
}: LegalHeroProps) {
  return (
    <header
      className="relative w-full overflow-hidden px-6 py-12 sm:px-8 sm:py-16"
      style={{
        backgroundColor: "var(--legal-hero-bg)",
        backgroundImage: [
          "radial-gradient(circle at 25px 8px, rgba(255,255,255,0.08) 2px, transparent 0)",
          "radial-gradient(circle at 8px 25px, rgba(255,255,255,0.06) 2px, transparent 0)",
        ].join(", "),
        backgroundSize: "48px 48px",
      }}
    >
      <div className="relative z-[1] mx-auto max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          <HugeiconsIcon className="text-white" icon={SparklesIcon} size={14} />
          Legal information
        </div>
        <h1 className="font-legal-serif mt-5 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
          {description}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/85">
          <span className="inline-flex items-center gap-2">
            <HugeiconsIcon icon={Calendar03Icon} size={18} />
            Last updated: {lastUpdatedLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <HugeiconsIcon icon={Clock01Icon} size={18} />~{readMinutes} min
            read
          </span>
          <span className="inline-flex items-center gap-2">
            <HugeiconsIcon icon={Globe02Icon} size={18} />
            {siteDomain}
          </span>
        </div>
      </div>
    </header>
  );
}
