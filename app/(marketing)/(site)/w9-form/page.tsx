import type { Metadata } from "next";

import { ArrowRight01Icon, File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";

import { W9Faq } from "@/components/sections/forms/w9-faq";
import { ROUTES } from "@/lib/shared/constants/routes";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pdfedits.io"
).replace(/\/$/, "");
const PAGE_URL = `${SITE_URL}/w9-form`;
const PREVIEW_IMG = "/static/forms/w9-preview.png";

export const metadata: Metadata = {
  title: "Get Latest W-9 Form 2025-2026 — Printable & Editable Online",
  description:
    "Get the latest IRS Form W-9 (2025-2026). Fill it out online in your browser, sign, and export a clean, printable PDF in under 5 minutes — no software install.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: "Get Latest W-9 Form — Printable Template 2025-2026",
    description:
      "Fill out the IRS W-9 online and export a clean PDF in minutes. Free, browser-based, no install.",
    siteName: "PDFedits",
    images: [{ url: "/logo.svg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Get Latest W-9 Form — Printable Template 2025-2026",
    description:
      "Fill out the IRS W-9 online and export a clean PDF in minutes. Free, browser-based, no install.",
    images: ["/logo.svg"],
  },
};

// ---------------------------------------------------------------------------
// Content (single source of truth for both rendering and JSON-LD)
// ---------------------------------------------------------------------------

const QUICK_STEPS = [
  "Click the “Get W-9 Form” button at the top of the page.",
  "Make your edits.",
  "Once you’re finished, click “Done” and select the format you prefer. Rename it if you’d like.",
];

type FaqEntry = { id: string; question: string; answer: string };

const FAQ: FaqEntry[] = [
  {
    id: "who-needs",
    question: "Who needs a W-9 form?",
    answer:
      "U.S. taxpayers — individuals, sole proprietors, partnerships, LLCs, and corporations — provide a W-9 when a client, bank, or other payer requests their Taxpayer Identification Number for 1099 reporting.",
  },
  {
    id: "when-not-required",
    question: "When is a W-9 not required?",
    answer:
      "If you are not a U.S. person (you would use the W-8 series), if you are an employee filling out tax forms for an employer (W-4 instead), or if the requester already has a current W-9 on file and nothing has changed.",
  },
  {
    id: "how-to-get-blank",
    question: "How to get a blank W-9 form?",
    answer:
      "Download the latest blank W-9 (2025-2026) directly from the IRS at irs.gov, or click “Get W-9 Form” above to fill one out online and export a printable PDF.",
  },
  {
    id: "why-do-you-need",
    question: "Why do you need a W-9?",
    answer:
      "Payers must collect a W-9 to report payments to the IRS accurately. Submitting a complete W-9 helps you avoid backup withholding (24%) and ensures your 1099s reflect the right legal name and TIN.",
  },
  {
    id: "when-to-update",
    question: "When should you update your W-9?",
    answer:
      "Whenever your name, business name, address, tax classification, or TIN changes — for example after a name change, marriage, moving, or switching from sole proprietor to LLC. Send the updated form to every active requester.",
  },
];

const USED_FOR = [
  "Providing your Taxpayer Identification Number (TIN) to entities that pay you.",
  "Certifying your tax status as a U.S. person.",
  "Declaring any exemption from backup withholding, if applicable.",
];

const LINE_INSTRUCTIONS = [
  {
    n: "Line 1",
    text: "Enter your full name as it appears on your tax documents.",
  },
  {
    n: "Line 2",
    text: "If you have a business name that’s different from your personal name, enter it here.",
  },
  {
    n: "Line 3",
    text: "Select your federal tax classification (Individual, corporation, LLC, etc.).",
  },
  {
    n: "Line 4",
    text: "If you’re exempt from backup withholding, enter the appropriate code.",
  },
  { n: "Line 5", text: "Provide your complete address." },
  { n: "Line 6", text: "Include your city, state, and ZIP code." },
  {
    n: "Line 7",
    text: "List any account numbers your employer might need (optional).",
  },
];

const PART_INSTRUCTIONS = [
  {
    n: "Part I",
    text: "Enter your TIN — Taxpayer Identification Number. Use your SSN if you are an individual or sole proprietor, or your EIN if you are a business.",
  },
  {
    n: "Part II",
    text: "Review your information carefully, then sign and date to certify accuracy.",
  },
];

const DISCLAIMER =
  "PDFedits is an independent platform and is not affiliated with, endorsed by, or approved by any government agency (including IRS, SSA, or USCIS). PDFedits is not a law firm, and its tools, forms, and templates do not constitute legal advice or replace an attorney. We do not guarantee that any forms or templates are accurate, complete, or up to date; users are responsible for verifying they are using the correct and current versions for their needs.";

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

const HOW_TO_JSONLD = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Get the latest IRS Form W-9 online",
  description:
    "Three quick steps to fill out an IRS Form W-9 in your browser and export a printable PDF.",
  totalTime: "PT5M",
  step: QUICK_STEPS.map((text, index) => ({
    "@type": "HowToStep",
    position: index + 1,
    name: `Step ${index + 1}`,
    text,
  })),
};

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((entry) => ({
    "@type": "Question",
    name: entry.question,
    acceptedAnswer: { "@type": "Answer", text: entry.answer },
  })),
};

const BREADCRUMB_JSONLD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "W-9 Form", item: PAGE_URL },
  ],
};

// ---------------------------------------------------------------------------
// Reusable bits
// ---------------------------------------------------------------------------

function CtaBanner() {
  return (
    <section className="mx-auto my-12 w-full max-w-5xl px-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-accent)] via-red-600 to-red-800 px-6 py-10 text-center shadow-xl shadow-red-500/20 sm:px-10 dark:shadow-red-900/30">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-8 -left-8 size-40 rounded-full bg-white/10 blur-2xl"
        />
        <p className="relative text-2xl font-semibold text-white sm:text-3xl">
          Fill W-9 in less than 5 minutes
        </p>
        <Link
          className="relative mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[var(--color-accent)] shadow-md transition-transform hover:scale-[1.03]"
          href={ROUTES.FORMS.W9_EDIT}
        >
          Get W-9 Form
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
        </Link>
      </div>
    </section>
  );
}

function LinePill({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-[var(--color-accent)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function W9FormPage() {
  return (
    <div className="w-full">
      {/* Hero — form image as darkened background, title + CTA overlaid on top */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-6 pb-4 sm:pt-10">
        <div className="relative overflow-hidden rounded-3xl shadow-xl shadow-black/10">
          {/* Background: top portion of the W-9 form, cropped */}
          <Image
            aria-hidden
            priority
            alt="Preview of IRS Form W-9 page 1"
            className="absolute inset-0 h-full w-full object-cover object-top"
            height={1200}
            src={PREVIEW_IMG}
            width={927}
          />
          {/* Dark overlay */}
          <div aria-hidden className="absolute inset-0 bg-black/55" />
          {/* Spacer to give the card height (~16:9 mobile, ~16:7 desktop) */}
          <div className="relative aspect-[16/9] min-h-[280px] w-full sm:aspect-[16/7] sm:min-h-[360px]" />
          {/* Foreground content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md sm:text-5xl">
              Get Latest W-9 Form
            </h1>
            <p className="text-base font-semibold text-white drop-shadow-md sm:text-xl">
              Printable template 2025-2026
            </p>
            <Link
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-red-900/30 transition-transform hover:scale-[1.03] sm:text-base"
              href={ROUTES.FORMS.W9_EDIT}
            >
              Get W-9 Form
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
            </Link>
          </div>
        </div>
        <p className="mt-5 text-center text-xs italic text-default-500">
          This website is not affiliated with the IRS
        </p>
      </section>

      {/* Complete your W-9 in just a few steps */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid items-center gap-8 sm:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
              Complete your W-9 in just a few steps
            </h2>
            <p className="mt-2 text-sm text-default-500">
              It’s easy to get started:
            </p>
            <ol className="mt-5 space-y-3">
              {QUICK_STEPS.map((step, index) => (
                <li
                  key={step}
                  className="flex items-start gap-3 rounded-xl border border-default-200 bg-[var(--color-background)] px-4 py-3 dark:border-default-700"
                >
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-accent)_15%,transparent)] text-xs font-bold text-[var(--color-accent)]"
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-default-700 dark:text-default-300">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div aria-hidden className="hidden sm:block">
            <div className="flex h-44 w-44 items-center justify-center rounded-2xl border border-default-200 bg-[color-mix(in_oklab,var(--color-accent)_4%,transparent)] dark:border-default-700">
              <div className="flex flex-col items-center gap-2 text-[var(--color-accent)]">
                <HugeiconsIcon icon={File01Icon} size={64} />
                <p className="text-sm font-semibold tracking-widest">
                  PDF · Ab Cd
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaBanner />

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl bg-default-100/60 px-5 py-8 dark:bg-default-50/5">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
              Your questions are important
            </h2>
            <p className="mt-2 text-sm text-default-500">
              Our answers are here to support you
            </p>
          </div>
          <div className="mt-6">
            <W9Faq items={FAQ} />
          </div>
        </div>
      </section>

      {/* What is the W-9 used for */}
      <section className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="text-xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-2xl">
          What is the W-9 form used for?
        </h2>
        <p className="mt-2 text-sm leading-6 text-default-700 dark:text-default-300">
          The W-9 form is crucial for accurate tax documentation, as it serves
          these key purposes:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-sm leading-6 text-default-700 dark:text-default-300">
          {USED_FOR.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {/* When might NOT be necessary */}
      <section className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="text-xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-2xl">
          When might filling out a W-9 not be necessary?
        </h2>
        <p className="mt-2 text-sm leading-6 text-default-700 dark:text-default-300">
          In certain cases, completing a W-9 may not be advisable. For example,
          if an unexpected party requests a W-9, make sure the reason for the
          request is valid. Financial institutions, such as banks, may use the
          W-9 form to report dividends at year-end; however, if they already
          have your TIN, submitting a new W-9 form might be redundant.
        </p>
      </section>

      {/* When should you submit an updated W-9 */}
      <section className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="text-xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-2xl">
          When should you submit an updated W-9?
        </h2>
        <p className="mt-2 text-sm leading-6 text-default-700 dark:text-default-300">
          It’s important to provide a new W-9 to your employer or client
          whenever there’s a change in your personal or business information,
          such as a new address, new Social Security Number, or name change due
          to marriage or other reasons. Updating this information ensures that
          all tax documentation remains accurate.
        </p>
      </section>

      <CtaBanner />

      {/* W-9 form instructions — step by step */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-center text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
          W-9 form instructions – step by step
        </h2>
        <div className="mt-6 overflow-hidden rounded-2xl border border-default-200 dark:border-default-700">
          <Image
            alt="W-9 form layout with numbered field areas"
            className="h-auto w-full"
            height={1200}
            src={PREVIEW_IMG}
            width={927}
          />
        </div>
        <ul className="mt-6 space-y-3">
          {LINE_INSTRUCTIONS.map((line) => (
            <li
              key={line.n}
              className="flex items-start gap-3 rounded-xl border border-default-200 bg-[var(--color-background)] px-4 py-3 dark:border-default-700"
            >
              <LinePill label={line.n} />
              <span className="text-sm leading-6 text-default-700 dark:text-default-300">
                {line.text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Personal Details Section */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-2xl">
          Personal Details Section
        </h2>
        <p className="mt-2 text-sm leading-6 text-default-700 dark:text-default-300">
          In the second panel of the form, you’ll need to provide your personal
          information for your employer’s tax reporting. Here’s how to complete
          this section.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-default-200 dark:border-default-700">
          <Image
            alt="Part I and Part II area of the W-9"
            className="h-auto w-full object-cover object-bottom"
            height={1200}
            src={PREVIEW_IMG}
            style={{ aspectRatio: "927 / 480", objectPosition: "0 80%" }}
            width={927}
          />
        </div>
        <ul className="mt-6 space-y-3">
          {PART_INSTRUCTIONS.map((part) => (
            <li
              key={part.n}
              className="flex items-start gap-3 rounded-xl border border-default-200 bg-[var(--color-background)] px-4 py-3 dark:border-default-700"
            >
              <LinePill label={part.n} />
              <span className="text-sm leading-6 text-default-700 dark:text-default-300">
                {part.text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <CtaBanner />

      {/* Disclaimer */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <div className="rounded-2xl border border-default-200 bg-default-50/60 px-5 py-6 text-xs leading-6 text-default-600 dark:border-default-700 dark:bg-default-50/5 dark:text-default-400">
          <p className="font-semibold text-default-700 dark:text-default-300">
            Disclaimer
          </p>
          <p className="mt-2">{DISCLAIMER}</p>
        </div>
      </section>

      {/* JSON-LD */}
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO_JSONLD) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_JSONLD) }}
        type="application/ld+json"
      />
    </div>
  );
}
