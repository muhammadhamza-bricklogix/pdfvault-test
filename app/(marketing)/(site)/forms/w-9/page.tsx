import type { Metadata } from "next";

import {
  ArrowRight01Icon,
  File01Icon,
  LockKeyIcon,
  Shield01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { W9Faq } from "@/components/sections/forms/w9-faq";
import { ROUTES } from "@/lib/shared/constants/routes";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pdfedits.io"
).replace(/\/$/, "");
const PAGE_URL = `${SITE_URL}${ROUTES.FORMS.W9}`;

export const metadata: Metadata = {
  title: "Fill Out W-9 Form Online — Free IRS W-9 Editor & Download",
  description:
    "Fill out IRS Form W-9 online in your browser. Type, sign, and export a clean PDF — no install, no signup. Free downloadable blank W-9 included.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: "Fill Out W-9 Form Online — Free IRS W-9 Editor",
    description:
      "Complete the IRS W-9 right in your browser. Edit, sign, and export a clean, professional PDF in minutes.",
    siteName: "PDFedits",
    images: [{ url: "/logo.svg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fill Out W-9 Form Online — Free IRS W-9 Editor",
    description:
      "Complete the IRS W-9 right in your browser. Edit, sign, and export a clean PDF in minutes.",
    images: ["/logo.svg"],
  },
};

// ---------------------------------------------------------------------------
// Content (single source of truth for both rendering and JSON-LD)
// ---------------------------------------------------------------------------

type Step = { id: string; title: string; body: string };

const STEPS: Step[] = [
  {
    id: "line-1",
    title: "Line 1 — Your full legal name",
    body: "Enter exactly the name shown on your federal tax return. Sole proprietors use their personal name, not the DBA.",
  },
  {
    id: "line-2",
    title: "Line 2 — Business name / disregarded entity (optional)",
    body: "Add a business name, trade name, DBA, or disregarded entity name only if it differs from line 1.",
  },
  {
    id: "line-3a",
    title: "Line 3a — Federal tax classification",
    body: "Tick exactly one box: Individual / Sole proprietor, C corporation, S corporation, Partnership, Trust/estate, LLC (then enter C, S, or P), or Other.",
  },
  {
    id: "line-3b",
    title: "Line 3b — Partnership, trust, or LLC notice",
    body: "Check this box only if you are a partnership (including an LLC classified as a partnership), trust, or estate providing the W-9 to a partnership with foreign partners.",
  },
  {
    id: "line-4",
    title: "Line 4 — Exemption codes (most people leave blank)",
    body: "Most individuals skip this line. Corporations and certain entities may enter an Exempt payee code or a FATCA exemption code. See the IRS instructions for the code list.",
  },
  {
    id: "lines-5-6",
    title: "Lines 5 & 6 — Address",
    body: "Enter the address where the requester will mail your 1099 or other information return. Use a current address; this is how you receive tax forms.",
  },
  {
    id: "line-7",
    title: "Line 7 — Account number(s) (optional)",
    body: "Add the account number from the requester if they asked for one. Otherwise leave blank.",
  },
  {
    id: "part-1",
    title: "Part I — Taxpayer Identification Number (TIN)",
    body: "Enter your Social Security Number if you are an individual or sole proprietor without an EIN. Otherwise, use your Employer Identification Number. Use only one — not both.",
  },
  {
    id: "part-2",
    title: "Part II — Certification and signature",
    body: "Read the three certifications, then sign and date. Your signature confirms the TIN is correct and that you are not subject to backup withholding (unless line 2 of the certification was crossed out).",
  },
];

const WHEN_NEEDED = [
  "A new freelance or contracting client needs your TIN to issue Form 1099.",
  "A bank or brokerage opens an account that pays interest, dividends, or proceeds.",
  "A real estate transaction requires Form 1099-S reporting.",
  "A creditor cancels $600 or more of your debt (Form 1099-C).",
  "You receive royalties, rental payments, or prizes that need 1099 reporting.",
];

const WHEN_NOT_TO_FILE = [
  "An employer asks you to fill out a W-9 — use Form W-4 instead. W-9 is for contractors, not employees.",
  "An unsolicited email or message asks you to fill in a W-9 — verify the requester directly before sharing your SSN/EIN.",
  "A foreign person or business is requesting it — non-U.S. persons file the W-8 series, not W-9.",
  "A 'verify your identity' phishing site asks for one — the IRS itself never requests W-9 via email or SMS.",
];

const TIPS = [
  "Double-check that the name on line 1 matches your Social Security card or IRS records exactly — mismatches trigger B-notices.",
  "Use only one TIN in Part I: SSN for individuals and most sole proprietors, EIN for businesses.",
  "Single-member LLCs that did not elect to be taxed as a corporation use the owner's name on line 1 (not the LLC name).",
  "Keep a copy of every completed W-9 you send. Mailed paper copies should be sent in a sealed envelope or encrypted file.",
];

type FaqEntry = { id: string; question: string; answer: string };

const FAQ: FaqEntry[] = [
  {
    id: "faq-w9-vs-1099",
    question: "What is the difference between a W-9 and a 1099?",
    answer:
      "A W-9 is what you give to the person paying you so they have your taxpayer information. A 1099 is the form they later file with the IRS — and send you a copy of — to report what they paid you during the year. One is input, the other is output.",
  },
  {
    id: "faq-mail-to-irs",
    question: "Do I mail my W-9 to the IRS?",
    answer:
      "No. The W-9 is not sent to the IRS. You give the completed form directly to the person or business that requested it (your client, bank, broker, etc.). They keep it on file and use it to prepare 1099s.",
  },
  {
    id: "faq-validity-period",
    question: "How long is a W-9 valid?",
    answer:
      "There is no fixed expiration. A W-9 stays valid until something material changes — your name, business structure, address, or TIN. When any of those change, send the requester an updated W-9.",
  },
  {
    id: "faq-online-safety",
    question: "Is it safe to fill out a W-9 online?",
    answer:
      "Filling out a W-9 in your browser is safe when the tool runs entirely client-side and transmits over HTTPS. PDFedits keeps your edits in the browser until you choose to export; we don't store your SSN/EIN. Always verify who is asking before sending the completed form.",
  },
  {
    id: "faq-mistakes",
    question: "What if I make a mistake on a W-9?",
    answer:
      "If you haven't sent it yet, just re-edit and re-export. If the requester already has it, complete a new W-9 with the corrected information and send it again — mark or note it as a corrected copy so they update their records.",
  },
  {
    id: "faq-e-sign-legality",
    question: "Are electronic signatures legal on a W-9?",
    answer:
      "Yes. The IRS accepts electronic signatures on Form W-9 when the requester's system meets the requirements in the W-9 instructions (intent to sign, signer authentication, and a record of the signed form). For practical purposes, a typed or drawn signature you apply yourself and send to the requester is widely accepted.",
  },
  {
    id: "faq-llc-line-1",
    question: "What name does a single-member LLC put on line 1?",
    answer:
      "A single-member LLC that hasn't elected corporate tax treatment is a disregarded entity. Put the owner's name on line 1 and the LLC's name on line 2. For line 3a, check the box that corresponds to the owner (usually Individual/sole proprietor) — not LLC.",
  },
  {
    id: "faq-name-change",
    question: "What if my name has changed since my last W-9?",
    answer:
      "Use the name currently shown on your Social Security card or IRS records. If you've legally changed your name but haven't updated SSA/IRS records yet, file the change with them first (SSA Form SS-5) — otherwise your W-9 won't match IRS records and you may be subject to backup withholding.",
  },
  {
    id: "faq-backup-withholding",
    question: "What is backup withholding?",
    answer:
      "Backup withholding is a 24% federal tax that payers must withhold from certain payments when the IRS tells them the payee's TIN is missing or incorrect, or when the payee has under-reported interest or dividends. Signing Part II of the W-9 typically certifies you are NOT subject to backup withholding (unless you cross out the relevant line).",
  },
  {
    id: "faq-secure-sending",
    question: "How do I send my completed W-9 securely?",
    answer:
      "Treat it like any document containing your SSN. Best options: an encrypted email attachment with a password shared via a different channel, the requester's secure portal, or a sealed envelope via tracked mail. Avoid plain email, SMS, and unencrypted cloud links.",
  },
];

type RelatedForm = {
  id: string;
  title: string;
  description: string;
  href: string;
  comingSoon: boolean;
};

const RELATED_FORMS: RelatedForm[] = [
  {
    id: "w-4",
    title: "Form W-4",
    description:
      "Employee's withholding certificate — what employees give their employer.",
    href: ROUTES.FORMS.W4,
    comingSoon: true,
  },
  {
    id: "1099-nec",
    title: "Form 1099-NEC",
    description:
      "Non-employee compensation reporting — the form your client files using your W-9.",
    href: ROUTES.FORMS.NEC_1099,
    comingSoon: true,
  },
  {
    id: "w-7",
    title: "Form W-7",
    description:
      "ITIN application — for individuals who need a tax ID but aren't eligible for an SSN.",
    href: ROUTES.FORMS.W7,
    comingSoon: true,
  },
];

const TRUST_STRIP = [
  { icon: Shield01Icon, label: "SSL secure" },
  { icon: File01Icon, label: "No software install" },
  { icon: LockKeyIcon, label: "Editable in browser" },
];

// ---------------------------------------------------------------------------
// JSON-LD payloads (kept after content so they always stay in sync)
// ---------------------------------------------------------------------------

const HOW_TO_JSONLD = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to fill out IRS Form W-9 online",
  description:
    "Step-by-step instructions to complete IRS Form W-9 (Request for Taxpayer Identification Number and Certification) in your browser.",
  totalTime: "PT5M",
  step: STEPS.map((step, index) => ({
    "@type": "HowToStep",
    position: index + 1,
    name: step.title,
    text: step.body,
    url: `${PAGE_URL}#${step.id}`,
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
    {
      "@type": "ListItem",
      position: 2,
      name: "Forms",
      item: `${SITE_URL}/forms`,
    },
    { "@type": "ListItem", position: 3, name: "W-9", item: PAGE_URL },
  ],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function W9LandingPage() {
  return (
    <div className="w-full">
      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-4 pt-12 pb-10 text-center sm:pt-16 sm:pb-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
          IRS Form W-9
        </p>
        <h1 className="mx-auto mt-3 max-w-4xl text-4xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-5xl">
          Fill Out W-9 Form Online
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-default-600 sm:text-lg dark:text-default-400">
          Complete the IRS W-9 form right in your browser. Edit, sign, and
          export a clean, professional PDF in minutes.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.03]"
            href={ROUTES.FORMS.W9_EDIT}
          >
            Fill Out W-9 Now
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
          </Link>
          <a
            download
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-default-200 px-6 py-3 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-default-50 dark:border-default-700 dark:hover:bg-default-50/10"
            href={ROUTES.STATIC.W9_BLANK_PDF}
          >
            Download Blank W-9 (PDF)
          </a>
        </div>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-default-500 dark:text-default-400">
          {TRUST_STRIP.map((item) => (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              <HugeiconsIcon icon={item.icon} size={14} />
              {item.label}
            </li>
          ))}
        </ul>
      </section>

      {/* What is a W-9 */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
          What is a W-9?
        </h2>
        <div className="mt-4 space-y-4 text-base leading-7 text-default-700 dark:text-default-300">
          <p>
            IRS Form W-9, &ldquo;Request for Taxpayer Identification Number and
            Certification,&rdquo; is the form you give to a business or person
            who is going to pay you. It tells them your legal name, your
            address, the way you are taxed, and your taxpayer ID number (an SSN
            for most individuals, or an EIN for most businesses).
          </p>
          <p>
            The W-9 itself is never sent to the IRS. The requester keeps it on
            file and uses it to prepare information returns — typically a 1099 —
            that go to the IRS and to you at the end of the year. You only need
            a new W-9 when something about you changes, such as your name,
            address, business structure, or TIN.
          </p>
        </div>
      </section>

      {/* Step-by-step */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
          How to fill out a W-9, step by step
        </h2>
        <ol className="mt-6 space-y-4">
          {STEPS.map((step, index) => (
            <li
              key={step.id}
              className="flex gap-4 rounded-2xl border border-default-200 bg-[var(--color-background)] p-5 shadow-sm dark:border-default-700"
              id={step.id}
            >
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-accent)_15%,transparent)] text-sm font-bold text-[var(--color-accent)]"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-[var(--color-foreground)]">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-default-600 dark:text-default-400">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* When you need a W-9 */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
          When you need a W-9
        </h2>
        <ul className="mt-6 space-y-3">
          {WHEN_NEEDED.map((line) => (
            <li
              key={line}
              className="flex gap-3 rounded-xl border border-default-200 bg-[var(--color-background)] px-4 py-3 text-sm leading-6 text-default-700 dark:border-default-700 dark:text-default-300"
            >
              <span
                aria-hidden
                className="mt-1 inline-block size-2 shrink-0 rounded-full bg-[var(--color-accent)]"
              />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* When NOT to file (anti-phishing) */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
          When NOT to file a W-9
        </h2>
        <p className="mt-2 text-sm text-default-500">
          Watch for these phishing and misuse signals before sharing your SSN or
          EIN.
        </p>
        <ul className="mt-6 space-y-3">
          {WHEN_NOT_TO_FILE.map((warning) => (
            <li
              key={warning}
              className="flex gap-3 rounded-xl border border-yellow-300/60 bg-yellow-50/60 px-4 py-3 text-sm leading-6 text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-500/5 dark:text-yellow-200"
            >
              <span
                aria-hidden
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-bold text-yellow-950"
              >
                !
              </span>
              {warning}
            </li>
          ))}
        </ul>
      </section>

      {/* Tips for accuracy */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
          Tips for accuracy
        </h2>
        <ul className="mt-6 space-y-3">
          {TIPS.map((tip) => (
            <li
              key={tip}
              className="flex gap-3 rounded-xl border border-default-200 bg-default-50/60 px-4 py-3 text-sm leading-6 text-default-700 dark:border-default-700 dark:bg-default-50/5 dark:text-default-300"
            >
              <span
                aria-hidden
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-bold text-white"
              >
                ✓
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
          Frequently asked questions
        </h2>
        <div className="mt-6">
          <W9Faq items={FAQ} />
        </div>
      </section>

      {/* Related forms */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
          Related forms
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {RELATED_FORMS.map((form) => (
            <div
              key={form.id}
              aria-disabled={form.comingSoon}
              className="flex flex-col gap-3 rounded-2xl border border-default-200 bg-[var(--color-background)] p-5 shadow-sm dark:border-default-700"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[var(--color-foreground)]">
                  {form.title}
                </h3>
                {form.comingSoon ? (
                  <span className="rounded-full bg-default-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-default-600 dark:bg-default-50/10 dark:text-default-400">
                    Coming soon
                  </span>
                ) : null}
              </div>
              <p className="text-sm leading-6 text-default-600 dark:text-default-400">
                {form.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA strip */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-accent)] via-red-600 to-red-800 px-6 py-10 text-center shadow-xl shadow-red-500/20 sm:px-10 dark:shadow-red-900/30">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-8 -left-8 size-40 rounded-full bg-white/10 blur-2xl"
          />
          <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            Ready when you are
          </p>
          <p className="relative mt-2 text-xl font-semibold text-white sm:text-2xl">
            Fill out your W-9 in minutes — straight from your browser
          </p>
          <p className="relative mx-auto mt-2 max-w-lg text-sm text-white/80">
            No installs, no signups, no waiting. Export a polished PDF you can
            send right back to whoever asked.
          </p>
          <div className="relative mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[var(--color-accent)] shadow-md transition-transform hover:scale-[1.03]"
              href={ROUTES.FORMS.W9_EDIT}
            >
              Fill Out W-9 Now
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
            </Link>
            <a
              download
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              href={ROUTES.STATIC.W9_BLANK_PDF}
            >
              Download Blank W-9 (PDF)
            </a>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <div className="rounded-2xl border border-default-200 bg-default-50/60 px-5 py-6 text-xs leading-6 text-default-600 dark:border-default-700 dark:bg-default-50/5 dark:text-default-400">
          <p className="font-semibold text-default-700 dark:text-default-300">
            Disclaimer
          </p>
          <p className="mt-2">
            PDFedits is an independent platform and is not affiliated with,
            endorsed by, or approved by any government agency (including IRS,
            SSA, or USCIS). PDFedits is not a law firm, and its tools, forms,
            and templates do not constitute legal advice or replace an attorney.
            We do not guarantee that any forms or templates are accurate,
            complete, or up to date; users are responsible for verifying they
            are using the correct and current versions for their needs.
          </p>
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
