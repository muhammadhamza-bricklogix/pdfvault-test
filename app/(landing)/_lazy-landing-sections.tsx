"use client";

import dynamic from "next/dynamic";

const LandingBanner = dynamic(
  () =>
    import("@/components/sections/new-landing/landing-banner").then((m) => ({
      default: m.LandingBanner,
    })),
  { ssr: false },
);
const LandingFooter = dynamic(
  () =>
    import("@/components/sections/new-landing/landing-footer").then((m) => ({
      default: m.LandingFooter,
    })),
  { ssr: false },
);
const LandingTools = dynamic(
  () =>
    import("@/components/sections/new-landing/landing-tools").then((m) => ({
      default: m.LandingTools,
    })),
  { ssr: false },
);

export function LazyLandingTools() {
  return <LandingTools />;
}

export function LazyLandingBanner() {
  return <LandingBanner />;
}

export function LazyLandingFooter() {
  return <LandingFooter />;
}
