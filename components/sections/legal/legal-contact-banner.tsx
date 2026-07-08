"use client";

import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";

import { ROUTES } from "@/lib/shared/constants/routes";

const SUPPORT_EMAIL = "support@pdfvault.ai";

type LegalContactBannerProps = {
  eyebrow: string;
};

export function LegalContactBanner({ eyebrow }: LegalContactBannerProps) {
  const router = useRouter();

  return (
    <div className="relative mt-14 overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-10">
      <div
        className="absolute inset-0 rounded-3xl"
        style={{
          background: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.08) 0%, transparent 45%),
            radial-gradient(circle at 80% 70%, rgba(255,255,255,0.06) 0%, transparent 40%),
            linear-gradient(145deg, var(--legal-cta-deep) 0%, var(--legal-burgundy) 100%)`,
        }}
      />
      <div className="relative z-[1] mx-auto max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/90">
          {eyebrow}
        </p>
        <h2 className="font-legal-serif mt-3 text-2xl font-bold text-white sm:text-3xl">
          We&apos;re here to help
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/90 sm:text-base">
          Our team typically responds within 24 hours. No bots — just real
          people ready to assist you.
        </p>
        <Button
          className="mt-8 !bg-white font-semibold !text-[var(--legal-burgundy)] shadow-md hover:!bg-white/95"
          size="lg"
          type="button"
          variant="primary"
          onPress={() => router.push(ROUTES.LEGAL.CONTACT)}
        >
          <span className="inline-flex items-center gap-2">
            <HugeiconsIcon icon={Mail01Icon} size={18} />
            Contact us
          </span>
        </Button>
        <p className="mt-6 text-sm text-white/85">
          or email us directly at{" "}
          <a
            className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
