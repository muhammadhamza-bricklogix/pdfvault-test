import { HomeClosingSection } from "@/components/sections/home/home-closing-section";
import { HomeFaq } from "@/components/sections/home/home-faq";
import { HomeHero } from "@/components/sections/home/home-hero";
import { HomeToolGrid } from "@/components/sections/home/home-tool-grid";
import { HomeTrustStrip } from "@/components/sections/home/home-trust-strip";

export default function Home() {
  return (
    <div className="relative flex w-full flex-col items-center overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[var(--color-background)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-1/4 top-0 -z-10 h-[min(70vh,520px)] w-[min(85vw,480px)] rounded-full bg-gradient-to-br from-red-200/60 via-rose-100/35 to-transparent blur-3xl dark:from-red-900/30 dark:via-rose-900/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-1/4 top-10 -z-10 h-[min(65vh,480px)] w-[min(80vw,440px)] rounded-full bg-gradient-to-bl from-orange-200/50 via-amber-100/30 to-transparent blur-3xl dark:from-orange-900/25 dark:via-amber-900/15"
      />
      <HomeHero />
      <HomeTrustStrip />
      <HomeToolGrid />
      <HomeClosingSection />
      <HomeFaq />
    </div>
  );
}
