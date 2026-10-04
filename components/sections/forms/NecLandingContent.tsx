import type { NecFaqEntry } from "./nec-faq";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { NecFaq } from "@/components/sections/forms/nec-faq";
import { NecPreviewScroller } from "@/components/sections/forms/NecPreviewScroller";
import { ROUTES } from "@/lib/shared/constants/routes";

const CURRENT_YEAR = new Date().getFullYear();
const CONTENT_LAST_UPDATED = "September 30, 2026";

const HERO_EYEBROW = "1099-NEC Form";
const HERO_TITLE = `Fill out a 1099-NEC Form Online in ${CURRENT_YEAR}`;
const HERO_SUB =
  "Easily complete, review, and download your official IRS Form 1099-NEC for nonemployee compensation directly in your browser — no printing, scanning, or software installation needed.";
const HERO_CTA_LABEL = "Open the 1099-NEC Template";
const HERO_CTA_NOTE =
  "No account needed to start. Sign in only when you're ready to save or download.";

const HOW_TO_STEPS = [
  {
    n: "1",
    title: "Identify Payer Information",
    body: "Enter the payer's legal business name, street address, city, state, ZIP code, telephone number, and Taxpayer Identification Number (EIN or SSN).",
  },
  {
    n: "2",
    title: "Fill in Recipient Details",
    body: "Enter the independent contractor's or freelancer's legal name, mailing address, and Taxpayer Identification Number (SSN or EIN).",
  },
  {
    n: "3",
    title: "Enter Nonemployee Compensation in Box 1",
    body: "Input the total amount of reportable nonemployee compensation paid to the recipient during the tax year (typically $600 or more).",
  },
  {
    n: "4",
    title: "Report Federal & State Tax Withholding",
    body: "If any federal income tax was withheld, enter it in Box 4. For state reporting, enter state tax withheld, state ID number, and state income in Boxes 5 through 7.",
  },
  {
    n: "5",
    title: "Review and Download PDF",
    body: "Double-check all figures and TIN numbers for accuracy, then export a print-ready IRS Form 1099-NEC PDF.",
  },
];

const WHO_GETS_ONE = [
  "Independent contractors, freelancers, or consultants paid $600 or more during the year",
  "Sole proprietors, partnerships, or LLCs providing nonemployee services to your business",
  "Attorneys or professional service firms paid for legal or advisory services",
];

const WHO_DOES_NOT_NEED = [
  "W-2 employees (whose compensation is reported on Form W-2)",
  "Payments for physical goods, merchandise, freight, or equipment rentals (reported elsewhere or non-reportable)",
  "C corporations and S corporations (unless payments were made for attorney services)",
  "Personal, non-business payments made between individuals",
];

const FAQ_ITEMS: NecFaqEntry[] = [
  {
    id: "report-income",
    question: "How do I report income from a 1099-NEC on my tax return?",
    answer:
      "If you are self-employed or an independent contractor and received a 1099-NEC, report that income on Schedule C (Profit or Loss from Business) when filing your Form 1040 federal tax return. Enter the total from Box 1 of Form 1099-NEC as gross receipts or sales, and deduct any eligible business expenses.",
  },
  {
    id: "diff-misc-nec",
    question:
      "What is the difference between Form 1099-MISC and Form 1099-NEC?",
    answer:
      "Form 1099-NEC is dedicated exclusively to reporting Nonemployee Compensation (contractor payments, freelance fees, commissions). Form 1099-MISC is used for other miscellaneous payments such as rents, royalties, prizes, awards, medical payments, and other reportable income.",
  },
  {
    id: "no-1099-issued",
    question: "What if a company does not issue a 1099-NEC?",
    answer:
      "Even if a payer fails to issue you a 1099-NEC, you are still legally required by the IRS to report all self-employment and contractor earnings on your tax return. Keep track of your bank statements and invoices to calculate your total gross income.",
  },
  {
    id: "account-number-box",
    question: "What is the account number box on Form 1099-NEC?",
    answer:
      "The account number box is optional for most businesses. It is recommended if you have multiple accounts for the recipient or if you file multiple 1099 forms, helping you and the IRS distinguish between separate records.",
  },
  {
    id: "reimbursed-expenses",
    question: "Should reimbursed expenses be included on Form 1099-NEC?",
    answer:
      "If the reimbursement was made under an accountable plan (where the contractor substantiated business expenses and returned excess amounts), it generally should not be included in Box 1. Unsubstantiated expense reimbursements are reportable as taxable compensation.",
  },
  {
    id: "llc-partnerships",
    question: "Do LLC partnerships and nonprofits receive a 1099-NEC?",
    answer:
      "Yes. Single-member LLCs and multi-member LLCs taxed as partnerships must receive a 1099-NEC if paid $600 or more for services. Tax-exempt nonprofit organizations providing taxable services or independent contractors working for nonprofits are also subject to 1099 reporting guidelines.",
  },
  {
    id: "due-date",
    question: "When is Form 1099-NEC due?",
    answer:
      "Form 1099-NEC must be filed with the IRS and furnished to the recipient by January 31st of the year immediately following the reporting tax year. Unlike certain other information returns, there is no automatic 30-day extension for 1099-NEC.",
  },
];

function GetFormCta({ label = HERO_CTA_LABEL }: { label?: string }) {
  return (
    <Link
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-7 py-3 text-sm font-bold text-white shadow-md shadow-red-500/25 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 sm:text-base"
      // ?new=1 — arriving from the landing always starts a blank form.
      // Returning to a saved one goes through My PDFs, which links with
      // ?resumeDocId instead.
      href={`${ROUTES.FORMS.NEC_1099_EDIT}?new=1`}
    >
      {label}
      <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
    </Link>
  );
}

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2
      className="scroll-mt-24 text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl"
      id={id}
    >
      {children}
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="prose prose-sm max-w-none text-default-700 dark:text-default-300 [&_p]:mt-3 [&_p]:leading-7">
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-6 text-sm leading-7 text-default-700 dark:text-default-300">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function buildNecJsonLd(pageUrl: string) {
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Fill Out Form 1099-NEC Online",
    description:
      "A step-by-step guide to accurately filling out IRS Form 1099-NEC for nonemployee compensation.",
    step: HOW_TO_STEPS.map((s, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: s.title,
      text: s.body,
    })),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://pdfvault.ai",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Tax Forms",
        item: "https://pdfvault.ai/all-tools",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Form 1099-NEC",
        item: pageUrl,
      },
    ],
  };

  return { howTo, faqLd, breadcrumb };
}

export function NecLandingContent() {
  return (
    <div className="w-full pb-16">
      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-8 pb-6 sm:pt-14">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            {HERO_EYEBROW}
          </p>
          <p className="mt-2 text-xs text-default-500">
            Content last updated: {CONTENT_LAST_UPDATED}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-5xl">
            {HERO_TITLE}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-default-600 dark:text-default-400 sm:text-base">
            {HERO_SUB}
          </p>
          <div className="mt-6 flex justify-center">
            <GetFormCta label={HERO_CTA_LABEL} />
          </div>
          <p className="mt-3 text-xs text-default-500">{HERO_CTA_NOTE}</p>
        </div>

        <div className="mt-10">
          <NecPreviewScroller />
        </div>
        <p className="mt-4 text-center text-xs italic text-default-500">
          This website is not affiliated with the IRS
        </p>
      </section>

      {/* Main Content Layout with Sticky TOC */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[280px_1fr]">
        {/* Sticky Table of Contents */}
        <aside className="hidden lg:block">
          <nav
            aria-label="Table of contents"
            className="sticky top-20 rounded-2xl border border-default-200 bg-[var(--color-background)] p-5 text-sm shadow-sm dark:border-default-700"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-default-500">
              On this page
            </p>
            <ul className="mt-4 space-y-2.5 text-default-600 dark:text-default-400">
              <li>
                <a
                  className="transition-colors hover:text-[var(--color-accent)]"
                  href="#what-is-1099-nec"
                >
                  What is Form 1099-NEC?
                </a>
              </li>
              <li>
                <a
                  className="transition-colors hover:text-[var(--color-accent)]"
                  href="#purpose-of-form"
                >
                  Purpose of Form 1099-NEC
                </a>
              </li>
              <li>
                <a
                  className="transition-colors hover:text-[var(--color-accent)]"
                  href="#how-to-fill"
                >
                  How to fill out Form 1099-NEC
                </a>
              </li>
              <li>
                <a
                  className="transition-colors hover:text-[var(--color-accent)]"
                  href="#who-gets-one"
                >
                  Who gets a 1099-NEC?
                </a>
              </li>
              <li>
                <a
                  className="transition-colors hover:text-[var(--color-accent)]"
                  href="#deadlines"
                >
                  Filing deadlines & instructions
                </a>
              </li>
              <li>
                <a
                  className="transition-colors hover:text-[var(--color-accent)]"
                  href="#related-forms"
                >
                  Related tax forms
                </a>
              </li>
              <li>
                <a
                  className="transition-colors hover:text-[var(--color-accent)]"
                  href="#faq"
                >
                  Frequently asked questions
                </a>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Article Body */}
        <article className="space-y-12">
          {/* Section 1: What is Form 1099-NEC? */}
          <section>
            <SectionHeading id="what-is-1099-nec">
              What is a 1099-NEC Form?
            </SectionHeading>
            <Prose>
              <p>
                The <strong>Form 1099-NEC (Nonemployee Compensation)</strong> is
                the dedicated IRS tax document used by businesses and
                self-employed individuals to report payments made to
                nonemployees, such as independent contractors, freelancers, gig
                workers, and consultants.
              </p>
              <p>
                If your business pays a service provider $600 or more in
                nonemployee compensation during the tax calendar year, you must
                prepare and submit Form 1099-NEC both to the recipient and
                directly to the IRS.
              </p>
            </Prose>
          </section>

          {/* Section 2: Purpose */}
          <section>
            <SectionHeading id="purpose-of-form">
              What is the Purpose of Form 1099-NEC?
            </SectionHeading>
            <Prose>
              <p>
                Form 1099-NEC serves several vital purposes in federal tax
                compliance:
              </p>
              <BulletList
                items={[
                  "To report compensation paid to self-employed individuals for trade or business services.",
                  "To provide independent contractors with accurate documentation of gross earnings for their annual tax filing.",
                  "To document any federal income tax withheld under backup withholding rules.",
                  "To cross-reference reported business expense deductions with contractor income reported to the IRS.",
                ]}
              />
            </Prose>
          </section>

          {/* Section 3: How to fill out */}
          <section>
            <SectionHeading id="how-to-fill">
              How to Fill Out a 1099-NEC Step-by-Step
            </SectionHeading>
            <Prose>
              <p>
                Filling out Form 1099-NEC in our online editor is quick and
                straightforward. Follow these five key steps:
              </p>
            </Prose>
            <div className="mt-6 space-y-4">
              {HOW_TO_STEPS.map((step) => (
                <div
                  key={step.n}
                  className="flex gap-4 rounded-xl border border-default-200 bg-[var(--color-background)] p-4 shadow-sm dark:border-default-700"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-sm font-bold text-white">
                    {step.n}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-foreground)]">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm text-default-600 dark:text-default-400">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Who gets one */}
          <section>
            <SectionHeading id="who-gets-one">
              Who Gets a 1099-NEC (and Who Doesn&apos;t)?
            </SectionHeading>
            <Prose>
              <p>
                Understanding when a 1099-NEC is required helps prevent
                penalties and unnecessary filing overhead:
              </p>
              <h3 className="mt-4 text-base font-bold text-[var(--color-foreground)]">
                You must issue a 1099-NEC if:
              </h3>
              <BulletList items={WHO_GETS_ONE} />

              <h3 className="mt-6 text-base font-bold text-[var(--color-foreground)]">
                A 1099-NEC is NOT required if:
              </h3>
              <BulletList items={WHO_DOES_NOT_NEED} />
            </Prose>
          </section>

          {/* Section 5: Deadlines */}
          <section>
            <SectionHeading id="deadlines">
              When is Form 1099-NEC Due?
            </SectionHeading>
            <Prose>
              <p>
                The strict deadline for Form 1099-NEC is{" "}
                <strong>January 31st</strong> of the year following the tax year
                in which payments were made. Both Copy B (to the recipient) and
                Copy A (to the IRS) must be postmarked or electronically
                submitted by this date.
              </p>
              <p>
                Unlike general Form 1099-MISC filings, there is no automatic
                30-day extension granted for nonemployee compensation reporting,
                making timely preparation essential.
              </p>
            </Prose>
          </section>

          {/* Section 6: Related Forms */}
          <section>
            <SectionHeading id="related-forms">
              What Other Tax Forms Are Related to 1099-NEC?
            </SectionHeading>
            <Prose>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-default-200 bg-[var(--color-background)] p-4 shadow-sm dark:border-default-700">
                  <h3 className="font-semibold text-[var(--color-foreground)]">
                    Form W-9
                  </h3>
                  <p className="mt-1 text-xs text-default-600 dark:text-default-400">
                    Use Form W-9 to request and collect a contractor’s legal
                    name, address, and Taxpayer Identification Number prior to
                    issuing a 1099-NEC.
                  </p>
                  <Link
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                    href={ROUTES.FORMS.W9}
                  >
                    Open Form W-9
                    <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
                  </Link>
                </div>

                <div className="rounded-xl border border-default-200 bg-[var(--color-background)] p-4 shadow-sm dark:border-default-700">
                  <h3 className="font-semibold text-[var(--color-foreground)]">
                    Form 1096
                  </h3>
                  <p className="mt-1 text-xs text-default-600 dark:text-default-400">
                    When filing paper copies of 1099-NEC with the IRS, Form 1096
                    acts as the master transmittal and summary cover sheet.
                  </p>
                </div>
              </div>
            </Prose>
          </section>

          {/* Section 7: FAQs */}
          <section>
            <SectionHeading id="faq">Frequently Asked Questions</SectionHeading>
            <div className="mt-6">
              <NecFaq items={FAQ_ITEMS} />
            </div>
          </section>

          {/* Bottom CTA Banner */}
          <section className="rounded-2xl border border-default-200 bg-gradient-to-br from-default-50 to-default-100 p-8 text-center dark:border-default-700 dark:from-default-50/10 dark:to-default-100/10">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
              Ready to generate your 1099-NEC?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-default-600 dark:text-default-400">
              Type your payer & recipient data, verify amounts, and export a
              clean PDF in minutes.
            </p>
            <div className="mt-6 flex justify-center">
              <GetFormCta />
            </div>
          </section>

          <p className="text-xs italic leading-6 text-default-500">
            Disclaimer: This page is provided for general informational purposes
            only and does not constitute tax, legal, or accounting advice. Tax
            rules can change and may vary based on your individual circumstances
            — consult a qualified tax professional or the IRS for guidance
            specific to your situation.
          </p>
        </article>
      </div>
    </div>
  );
}
