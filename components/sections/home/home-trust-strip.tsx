import { LockKeyIcon, Shield01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

export function HomeTrustStrip() {
  return (
    <section
      aria-labelledby="home-trust-heading"
      className="relative w-full overflow-hidden px-4 py-10 sm:px-6"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--color-accent)] via-red-600 to-red-800"
      />
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center sm:flex-row sm:text-start">
        <div className="flex shrink-0 gap-3 sm:gap-4">
          <span className="flex size-14 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-sm sm:size-16">
            <HugeiconsIcon aria-hidden icon={LockKeyIcon} size={28} />
          </span>
          <span className="flex size-14 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-sm sm:size-16">
            <HugeiconsIcon aria-hidden icon={Shield01Icon} size={28} />
          </span>
        </div>
        <div className="min-w-0 flex-1 text-white">
          <h2
            className="text-xl font-bold leading-snug tracking-tight sm:text-2xl"
            id="home-trust-heading"
          >
            HTTPS and TLS encryption on every visit
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/90 sm:text-base">
            Your browser talks to PDFedits over HTTPS using modern TLS (the
            standard that replaced legacy SSL), so traffic is encrypted in
            transit. We do not show Norton or other paid “verified site” seals
            unless we are enrolled in those programs—see how we protect data in
            our{" "}
            <Link
              className="font-semibold underline decoration-white/70 underline-offset-2 hover:decoration-white"
              href={ROUTES.LEGAL.PRIVACY}
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
