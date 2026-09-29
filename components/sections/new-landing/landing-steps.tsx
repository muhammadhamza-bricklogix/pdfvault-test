"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { SectionHeading } from "./section-heading";

type Step = {
  icon: string;
  title: string;
  body: string;
};

// Icon paths — copy lives in `messages/landing/*.json → steps.*` so
// Weglot doesn't rewrite the German step titles into informal "du"
// forms (QA F-07) or drift the "vault / library / storage" naming
// (QA F-21). English source used to render:
//   - "Bring in your document" → Weglot → "Bringen Sie Ihr Dokument mit" (F-06)
//   - "Make it yours" → Weglot → "Mach es zu deinem eigenen" (F-07: informal)
//   - "Save it to your vault" → Weglot → "Speichere es in deinem Tresor" (F-07: informal, F-21: Tresor)
//   - "your personal document library" → Weglot → "Dokumentbibliothek" (F-21)
const STEP_ICONS: string[] = [
  "/landing/step-1.svg",
  "/landing/step-2.svg",
  "/landing/step-3.svg",
];

export function LandingSteps() {
  const t = useTranslations("steps");
  const steps = useMemo<Step[]>(
    () => [
      { icon: STEP_ICONS[0]!, title: t("step1Title"), body: t("step1Body") },
      { icon: STEP_ICONS[1]!, title: t("step2Title"), body: t("step2Body") },
      { icon: STEP_ICONS[2]!, title: t("step3Title"), body: t("step3Body") },
    ],
    [t],
  );

  return (
    <section
      aria-labelledby="steps-heading"
      className="bg-[var(--pv-section-gray)] pt-24 pb-10 sm:pt-28 sm:pb-12"
    >
      <div className="pv-container">
        <SectionHeading
          description={
            <span className="notranslate wg-notranslate" translate="no">
              {t("sectionDescription")}
            </span>
          }
          title={
            <span
              className="notranslate wg-notranslate"
              id="steps-heading"
              translate="no"
            >
              {t("sectionTitle")}
            </span>
          }
        />

        <ul className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.title}
              className="notranslate wg-notranslate flex flex-col rounded-[16px] bg-white p-9"
              translate="no"
            >
              <Image
                alt=""
                className="h-12 w-12 object-contain"
                height={48}
                src={step.icon}
                width={48}
              />
              <h3
                className="notranslate wg-notranslate mt-8 text-[20px] font-bold text-[var(--pv-text-primary)]"
                translate="no"
              >
                {step.title}
              </h3>
              <p
                className="notranslate wg-notranslate mt-3 text-[15px] leading-relaxed text-[var(--pv-text-secondary)]"
                translate="no"
              >
                {step.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
