import Image from "next/image";

import { SectionHeading } from "./section-heading";

type Step = {
  icon: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: "/landing/step-1.svg",
    title: "Bring in your document",
    body: "Upload from your device or import directly from Google Drive or Microsoft OneDrive.",
  },
  {
    icon: "/landing/step-2.svg",
    title: "Make it yours",
    body: "Edit, convert, compress, protect, organize, or sign your document with the tools you need.",
  },
  {
    icon: "/landing/step-3.svg",
    title: "Save it to your vault",
    body: "Keep the latest version in your personal document library, ready whenever you need it again.",
  },
];

export function LandingSteps() {
  return (
    <section
      aria-labelledby="steps-heading"
      className="bg-[var(--pv-section-gray)] py-20 sm:py-24"
    >
      <div className="pv-container">
        <SectionHeading
          description="From upload to a securely saved document, PDFVault makes it easy to handle every PDF in one place."
          title={<span id="steps-heading">Get started in three simple steps</span>}
        />

        <ul className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.title}
              className="flex flex-col rounded-[16px] bg-white p-8"
            >
              <Image
                alt=""
                className="h-12 w-12 object-contain"
                height={48}
                src={step.icon}
                width={48}
              />
              <h3 className="mt-8 text-[20px] font-bold text-[var(--pv-text-primary)]">
                {step.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--pv-text-secondary)]">
                {step.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
