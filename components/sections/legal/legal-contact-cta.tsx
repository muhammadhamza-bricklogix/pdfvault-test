"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";

import { ROUTES } from "@/lib/shared/constants/routes";

const SUPPORT_EMAIL = "support@pdfeditsapp.com";

type LegalContactCtaProps = {
  heading: string;
};

export function LegalContactCta({ heading }: LegalContactCtaProps) {
  const router = useRouter();

  return (
    <div className="mt-12 rounded-xl border border-default-200 bg-default-100/40 p-6">
      <h2 className="text-base font-semibold text-[var(--color-foreground)]">
        {heading}
      </h2>
      <p className="mt-2 text-sm text-default-600 dark:text-default-400">
        We&apos;d love to hear from you — our team typically answers within 24
        hours.
      </p>
      <p className="mt-1 text-sm text-default-600 dark:text-default-400">
        Or email us directly at{" "}
        <a
          className="font-medium text-[var(--color-accent)] underline underline-offset-2 hover:opacity-90"
          href={`mailto:${SUPPORT_EMAIL}`}
        >
          {SUPPORT_EMAIL}
        </a>
      </p>
      <Button
        className="mt-4"
        type="button"
        variant="primary"
        onPress={() => router.push(ROUTES.LEGAL.CONTACT)}
      >
        Contact us
      </Button>
    </div>
  );
}
