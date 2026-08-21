import type { FaqEntry } from "./w9-faq";

import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Download01Icon,
  Edit02Icon,
  File01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";

import { W9Faq } from "@/components/sections/forms/w9-faq";
import { W9PreviewScroller } from "@/components/sections/forms/W9PreviewScroller";
import { ROUTES } from "@/lib/shared/constants/routes";

// ---------------------------------------------------------------------------
// Content — single source of truth for both /w9-form and /forms/w-9. Copy
// mirrors pdfguru's section order but is written from scratch (no verbatim
// lifting). Uses our accent color, not their purple.
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear();

const HERO_TITLE = `Fill out W-9 Form Online in ${CURRENT_YEAR}`;
const HERO_SUB =
  "Follow easy steps to provide the information you need without confusion.";

const THREE_STEP = [
  {
    n: "1",
    title: "Open the form",
    body: "Access the pre-loaded form directly in our PDF editor. No need to search for or upload a template.",
    icon: File01Icon,
  },
  {
    n: "2",
    title: "Fill in your details",
    body: "Complete the required fields to ensure accuracy and validity. Every field is highlighted so you never miss one.",
    icon: Edit02Icon,
  },
  {
    n: "3",
    title: "Download as PDF",
    body: "Save your filled-out W-9 to PDF ready for submission or other needs — clean, printable, and shareable.",
    icon: Download01Icon,
  },
];

const REQUIRED_INFO = [
  {
    label: "Legal Name",
    body: "Your full name or entity name as it appears on your federal tax return.",
  },
  {
    label: "Business Name (DBA)",
    body: "If you operate under a secondary name, list it here. Different from your legal name is fine.",
  },
  {
    label: "Federal Tax Classification",
    body: "Your legal structure for tax purposes: Individual/Sole Proprietor, C Corporation, S Corporation, Partnership, Trust/Estate, or LLC.",
  },
  {
    label: "Exemption Codes (if applicable)",
    body: "Codes for exempt payees or FATCA reporting exemptions. Most individuals leave these blank.",
  },
  {
    label: "Address",
    body: "Your complete mailing address where the payer will send information forms (1099s).",
  },
  {
    label: "Taxpayer Identification Number (TIN)",
    body: "Your SSN if you are an individual or sole proprietor, or your EIN if you are a business.",
  },
  {
    label: "Certification and Signature",
    body: "Your signature confirms that all information provided is correct under penalty of perjury.",
  },
];

const HOW_TO_STEPS = [
  {
    n: "1",
    title: "Open the form in our PDF editor",
    body: "Click 'Get Form' to load an electronic W-9 and start entering your details.",
  },
  {
    n: "2",
    title: "Complete your identity (Lines 1–4)",
    body: "Line 1: enter your legal name as it appears on your tax return. Line 2: add your business name, if you use one. Line 3: tick your federal tax classification (for example, Individual/Sole Proprietor, LLC). Line 4: enter any exemption codes.",
  },
  {
    n: "3",
    title: "Add your address (Lines 5–6)",
    body: "Provide the address where you expect to receive tax documents such as your 1099.",
  },
  {
    n: "4",
    title: "Enter your Taxpayer Identification Number (Part I)",
    body: "Use your SSN if you are filing as an individual, or your EIN if you are completing the form for a business.",
  },
  {
    n: "5",
    title: "Sign the form (Part II)",
    body: "Use our signature tool to sign and date the form electronically. That certifies your information.",
  },
  {
    n: "6",
    title: "Download",
    body: "Click 'Done' to save and download your printable W-9 as a PDF.",
  },
];

const RELATED = [
  {
    code: "1099-NEC",
    body: "Report nonemployee compensation of $600 or more (2024–2025) using the basic taxpayer details you collected on Form W-9.",
  },
  {
    code: "1099-MISC",
    body: "Report payments including rent, prizes, awards, or medical fees. The threshold is usually $600, or $10 for certain royalties. Based on details from a W-9.",
  },
  {
    code: "W-4",
    body: "Employees submit a W-4 to their employer to declare tax withholding — NOT a W-9.",
  },
  {
    code: "W-8BEN",
    body: "Confirms the payee is an individual who is NOT a U.S. taxpayer and therefore provides this form instead of a W-9.",
  },
  {
    code: "W-8BEN-E",
    body: "Confirms the payee is a business based outside the United States and therefore provides this form instead of a W-9.",
  },
];

const FAQ: FaqEntry[] = [
  {
    id: "what-is-w9-for-business",
    question: "What is Form W-9 for business?",
    answer:
      "Businesses use Form W-9 to collect Taxpayer Identification Numbers (TINs) from independent contractors and vendors. The TIN is used to report payments made to the IRS on the annual 1099 forms.",
  },
  {
    id: "c-corp-vs-w9",
    question: "What is a C Corporation on Form W-9?",
    answer:
      "A C Corporation is a legal structure taxed separately from its owners. On Form W-9, C Corporations tick the 'C corporation' box under federal tax classification.",
  },
  {
    id: "why-request",
    question: "Why would someone request Form W-9?",
    answer:
      "A payer requests a W-9 to collect your TIN so they can correctly report payments to the IRS. This typically happens before you start work as a contractor, open a bank account, or enter certain financial transactions.",
  },
  {
    id: "how-long-valid",
    question: "How long is a W-9 form valid for?",
    answer:
      "A W-9 does not have a set expiration date. It is valid until your information — legal name, business name, address, tax classification, or TIN — changes.",
  },
  {
    id: "how-it-looks",
    question: "What does Form W-9 look like?",
    answer:
      "The W-9 is a single-page IRS form with sections for identity (name and business name), federal tax classification (a row of tick boxes), address, and Taxpayer Identification Number, ending with a signature and date line.",
  },
  {
    id: "when-need-from-vendor",
    question: "When do you need a W-9 from a vendor?",
    answer:
      "Request a W-9 before you make the first payment to a new vendor. That way you have their TIN on file when it is time to issue 1099 forms at year-end.",
  },
  {
    id: "taxes-if-w9",
    question: "Do I have to pay taxes if I fill out W-9?",
    answer:
      "Filling out a W-9 does not by itself trigger taxes. It only shares your TIN with the payer. You still owe income tax on any earnings, which you report on your own tax return.",
  },
  {
    id: "fillable-w9",
    question: "How to get a fillable W-9?",
    answer:
      "Click 'Get Form' above to open a fillable W-9 in our online editor. Type your details, tick your classification, sign, and download the completed PDF.",
  },
  {
    id: "every-year",
    question: "Do I need a W-9 Form every year?",
    answer:
      "Not automatically. You only need to submit a new W-9 when your legal name, business name, address, classification, or TIN changes.",
  },
  {
    id: "how-cancel",
    question: "How do I cancel?",
    answer:
      "You can revoke a W-9 by contacting the requester in writing. Note that once submitted, the payer may still use the information on 1099 forms for the reporting period covered.",
  },
];

// ---------------------------------------------------------------------------
// UI bits
// ---------------------------------------------------------------------------

function GetFormCta({ label = "Get Form" }: { label?: string }) {
  return (
    <Link
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-7 py-3 text-sm font-bold text-white shadow-md shadow-red-500/25 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 sm:text-base"
      href={ROUTES.FORMS.W9_SHORT}
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

// ---------------------------------------------------------------------------
// Page content — shared between /w9-form and /forms/w-9
// ---------------------------------------------------------------------------

export function W9LandingContent() {
  return (
    <div className="w-full pb-16">
      {/* Hero — centered heading + subtitle + CTA + auto-scrolling preview */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-8 pb-6 sm:pt-14">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-5xl">
            {HERO_TITLE}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-default-500 sm:text-base">
            {HERO_SUB}
          </p>
          <div className="mt-6 flex justify-center">
            <GetFormCta />
          </div>
        </div>
        <div className="mt-10">
          <W9PreviewScroller />
        </div>
        <p className="mt-4 text-center text-xs italic text-default-500">
          This website is not affiliated with the IRS
        </p>
      </section>

      {/* Get your W-9 form — three cards mirroring pdfguru's 3-step section */}
      <section className="mx-auto max-w-5xl px-4 py-12" id="get-form">
        <h2 className="text-center text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
          Get your W-9 form
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {THREE_STEP.map((step) => (
            <article
              key={step.n}
              className="flex flex-col gap-3 rounded-2xl border border-default-200 bg-[var(--color-background)] p-5 shadow-sm dark:border-default-700"
            >
              <header className="flex items-center gap-3">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-accent)_15%,transparent)] text-sm font-bold text-[var(--color-accent)]">
                  {step.n}
                </span>
                <h3 className="text-base font-semibold text-[var(--color-foreground)]">
                  {step.title}
                </h3>
              </header>
              <div className="flex items-center justify-center rounded-xl border border-default-200 bg-default-50 py-6 text-[var(--color-accent)] dark:border-default-700 dark:bg-default-100/5">
                <HugeiconsIcon icon={step.icon} size={40} />
              </div>
              <p className="text-sm leading-6 text-default-600 dark:text-default-400">
                {step.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Content — sections match pdfguru's TOC (order + headings) */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[220px_1fr]">
        {/* Sticky TOC (desktop only). Content sections use scroll-mt so
            anchor links land below the sticky top-bar / header. */}
        <aside className="hidden lg:block">
          <nav
            aria-label="On this page"
            className="sticky top-24 flex flex-col gap-1 border-l border-default-200 pl-4 text-sm dark:border-default-700"
          >
            {[
              ["What is a W-9 form?", "what-is-w9"],
              ["What is a W-9 form used for?", "used-for"],
              ["What information is required?", "required-info"],
              ["How to fill out a W-9 form", "how-to-fill"],
              ["Who is required to fill out a W-9?", "who"],
              ["When is a W-9 not required?", "not-required"],
              ["When is a W-9 Form due?", "when-due"],
              ["Where can I get a blank W-9?", "blank"],
              ["How to sign a W-9 form online", "how-to-sign"],
              ["Where to file a W-9?", "where-to-file"],
              ["What other tax forms are related?", "related"],
              ["FAQ", "faq"],
            ].map(([label, id]) => (
              <Link
                key={id}
                className="rounded px-2 py-1 text-default-600 transition-colors hover:bg-default-100 hover:text-[var(--color-accent)] dark:text-default-400 dark:hover:bg-default-800"
                href={`#${id}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex flex-col gap-10">
          <section>
            <SectionHeading id="what-is-w9">What is a W-9 form?</SectionHeading>
            <Prose>
              <p>
                The IRS W-9 (Form, formally titled &ldquo;Request for Taxpayer
                Identification Number and Certification&rdquo;) is essential for
                anyone who works as a freelancer, independent contractor, or any
                entity receiving payments for services. It&apos;s used to
                provide your Taxpayer Identification Number (TIN) to entities
                that pay you, ensuring the correct reporting of taxes to the
                IRS. Filing this form helps manage your responsibilities
                efficiently, avoiding potential issues with tax withholdings and
                reporting.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="used-for">
              What is a W-9 form used for?
            </SectionHeading>
            <Prose>
              <p>
                Filing out a W-9 form is important for accurate tax
                documentation. Here&apos;s what it&apos;s used for:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>
                  Providing your Taxpayer Identification Number to entities that
                  pay you.
                </li>
                <li>Certifying your tax status as a U.S. person.</li>
                <li>
                  Claiming exemption from backup withholding, if applicable.
                </li>
              </ul>
            </Prose>
          </section>

          <section>
            <SectionHeading id="required-info">
              What information is required on a W-9 form?
            </SectionHeading>
            <ul className="mt-4 space-y-3">
              {REQUIRED_INFO.map((item) => (
                <li
                  key={item.label}
                  className="rounded-xl border border-default-200 bg-[var(--color-background)] px-4 py-3 dark:border-default-700"
                >
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-default-600 dark:text-default-400">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionHeading id="how-to-fill">
              How to fill out a W-9 form
            </SectionHeading>
            <div className="mt-4 overflow-hidden rounded-2xl border border-default-200 dark:border-default-700">
              <Image
                alt="W-9 form layout with numbered field areas"
                className="h-auto w-full"
                height={1200}
                src="/static/forms/w9-preview.png"
                width={927}
              />
            </div>
            <ol className="mt-6 space-y-3">
              {HOW_TO_STEPS.map((step) => (
                <li
                  key={step.n}
                  className="flex items-start gap-3 rounded-xl border border-default-200 bg-[var(--color-background)] px-4 py-3 dark:border-default-700"
                >
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-white">
                    {step.n}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-foreground)]">
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-default-600 dark:text-default-400">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Inline CTA banner — matches pdfguru's "Complete your W-9 form now!"
              placement between how-to and the rest of the reference sections. */}
          <section
            aria-label="Call to action"
            className="rounded-2xl bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] px-6 py-8 text-center"
          >
            <p className="text-lg font-semibold text-[var(--color-foreground)] sm:text-xl">
              Complete your W-9 form now!
            </p>
            <div className="mt-4 flex justify-center">
              <GetFormCta label="Fill Form" />
            </div>
          </section>

          <section>
            <SectionHeading id="who">
              Who is required to fill out a W-9 form?
            </SectionHeading>
            <Prose>
              <p>
                Form W-9 is primarily filled out by freelancers, independent
                contractors, and vendors to provide their Taxpayer
                Identification Number (TIN) to entities that need it for
                information reporting to the IRS. Businesses and financial
                institutions can be completed Form W-9 to report income paid to
                contractors and to manage tax reporting to the IRS.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="not-required">
              When is a W-9 not required?
            </SectionHeading>
            <Prose>
              <p>
                Certain individuals may not need to complete a W-9 Form. For
                example, those who are not engaged in an employment relationship
                or independent contractor arrangement within the United States
                might not require filing out this form. Additionally,
                non-residents performing work outside the U.S. typically do not
                need to submit a W-9. It&apos;s designed primarily for U.S.
                persons — including citizens and residents — to provide their
                taxpayer identification numbers to entities that pay them.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="when-due">
              When is a W-9 Form due?
            </SectionHeading>
            <Prose>
              <p>
                The deadline for submitting a W-9 Form is typically upon request
                by the individual or entity that requires your tax information
                for reporting purposes. There&apos;s not a specific due date,
                but it&apos;s important to provide it promptly when asked.
              </p>
              <p>
                Submitting your W-9 Form in a timely manner ensures compliance
                with tax reporting requirements and helps avoid potential delays
                or issues with reporting.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="blank">
              Where can I get a blank W-9 Form?
            </SectionHeading>
            <Prose>
              <p>
                If you need to complete a W-9 Form, PDFVault offers an
                IRS-approved digital W-9 template right in our editor. This
                blank form is preloaded and editable, so you can start entering
                your information right away without downloading it from another
                site.
              </p>
              <p>
                Using our online W-9 Form helps you complete it more quickly
                because you don&apos;t need to print, scan, or upload anything
                to start working. Keep in mind that PDF Guru helps you fill out
                and save the form, but you&apos;ll still need to submit it
                independently on your own.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="how-to-sign">
              How to sign a W-9 form online
            </SectionHeading>
            <Prose>
              <p>
                To sign a W-9 Form online with PDFVault, start by filing out the
                necessary fields. Once finished, look for the Sign tool. Please
                note that PDFVault lets you create simple electronic signatures.
                Follow the steps on the screen to place your signature on the
                form, then download your finished copy.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="where-to-file">
              Where to file a W-9?
            </SectionHeading>
            <Prose>
              <p>
                To submit a W-9, send it directly to the requester. It is not
                sent to the IRS. Make sure all details on the form are accurate
                before submitting it to avoid any potential issues with payment
                or reporting.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="related">
              What other tax forms are related to W-9?
            </SectionHeading>
            <ul className="mt-4 space-y-3">
              {RELATED.map((item) => (
                <li
                  key={item.code}
                  className="rounded-xl border border-default-200 bg-[var(--color-background)] px-4 py-3 dark:border-default-700"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
                    <HugeiconsIcon
                      className="text-[var(--color-accent)]"
                      icon={CheckmarkCircle02Icon}
                      size={16}
                    />
                    Form {item.code}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-default-600 dark:text-default-400">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Second CTA at the end of the reference body — right before FAQ */}
          <section
            aria-label="Call to action"
            className="rounded-2xl bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] px-6 py-8 text-center"
          >
            <p className="text-lg font-semibold text-[var(--color-foreground)] sm:text-xl">
              Prepare your W-9 form for tax season
            </p>
            <div className="mt-4 flex justify-center">
              <GetFormCta label="Fill Form" />
            </div>
          </section>

          <section id="faq">
            <SectionHeading id="faq-heading">
              Frequently asked questions
            </SectionHeading>
            <div className="mt-6">
              <W9Faq items={FAQ} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JSON-LD helpers — reused by both marketing routes so each canonical URL
// gets structured data with its own URL.
// ---------------------------------------------------------------------------

export function buildW9JsonLd(pageUrl: string) {
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to fill out IRS Form W-9 in ${CURRENT_YEAR}`,
    description:
      "Six quick steps to fill out an IRS Form W-9 in your browser and export a printable PDF.",
    totalTime: "PT5M",
    step: HOW_TO_STEPS.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.body,
    })),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
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
        item: pageUrl.replace(/\/[^/]*$/, "/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "W-9 Form",
        item: pageUrl,
      },
    ],
  };

  return { howTo, faqLd, breadcrumb };
}
