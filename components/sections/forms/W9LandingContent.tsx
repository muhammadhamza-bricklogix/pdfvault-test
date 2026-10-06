import type { FaqEntry } from "./w9-faq";

import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";

import { W9Faq } from "@/components/sections/forms/w9-faq";
import { W9PreviewScroller } from "@/components/sections/forms/W9PreviewScroller";
import { LocaleText } from "@/components/shared/i18n/locale-text";
import { ROUTES } from "@/lib/shared/constants/routes";

// ---------------------------------------------------------------------------
// Content — single source of truth for both /w9-form and /forms/w-9.
// Copy last refreshed 2026-08-31.
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear();
const CONTENT_LAST_UPDATED = "August 31, 2026";

const HERO_EYEBROW = "W-9 Form";
const HERO_TITLE = "Get a W-9 ready to send in minutes";
const HERO_SUB =
  "Whether you're a freelancer sending your Taxpayer Identification Number (TIN) to a new client or a company collecting one from a vendor, PDFVault gives you a ready-to-fill W-9 — no printing, scanning, or hunting for a template on the IRS site.";
const HERO_CTA_LABEL = "Open the W-9 Template";
const HERO_CTA_NOTE =
  "No account needed to start. Sign in only when you're ready to save or download.";

// QA F-55 / F-56 / F-57: previous copy mixed verb-first bullets
// ("Start freelance work…") with "Are onboarded…" and noun-phrase
// bullets ("A freelancer…"), which Weglot then translated
// inconsistently in German (verb-first infinitives + grammatically
// incomplete "Ein Freiberufler…, der …" clauses missing a verb).
// Rewriting every bullet as a full "You + verb" sentence gives Weglot
// a consistent template — each bullet becomes "Sie + verb …" in
// German. The lead-in paragraphs below have been reworded to match.
// Each item is `[english, german]`. Hand-authored German bypasses
// Weglot for QA F-55 / F-56 / F-57, which flagged bullets rendered
// with missing verbs ("Ein Freiberufler, der …") or awkward
// imperatives ("Werden als Anbieter aufgenommen"). The DE version
// keeps the "Sie + verb" structure that reads naturally.
type BulletPair = readonly [string, string];

const TYPICAL_REQUESTS: BulletPair[] = [
  [
    "You start freelance or contract work for a U.S. business",
    "Sie beginnen mit freiberuflicher oder vertraglicher Arbeit für ein US-Unternehmen",
  ],
  [
    "You open certain financial or investment accounts",
    "Sie eröffnen bestimmte Finanz- oder Anlagekonten",
  ],
  [
    "You receive rent, royalty, or other reportable payments",
    "Sie erhalten Miet-, Lizenz- oder andere meldepflichtige Zahlungen",
  ],
  [
    "You are onboarded as a vendor or supplier",
    "Sie werden als Anbieter oder Lieferant aufgenommen",
  ],
];

const NEEDS_ONE: BulletPair[] = [
  [
    "You are a freelancer or independent contractor invoicing a U.S. business",
    "Sie sind ein Freiberufler oder unabhängiger Auftragnehmer, der einem US-Unternehmen Rechnungen stellt",
  ],
  [
    "You are a sole proprietor, LLC, partnership, or corporation being paid by a client or platform",
    "Sie sind ein Einzelunternehmer, eine LLC, eine Personengesellschaft oder eine Kapitalgesellschaft, die von einem Kunden oder einer Plattform bezahlt wird",
  ],
  [
    "You are a landlord, vendor, or account holder that a company needs to report payments to",
    "Sie sind ein Vermieter, Anbieter oder Kontoinhaber, dessen Zahlungen ein Unternehmen melden muss",
  ],
];

const DOES_NOT_NEED: BulletPair[] = [
  [
    "You are a W-2 employee (your employer uses Form W-4 instead)",
    "Sie sind ein W-2-Angestellter (Ihr Arbeitgeber verwendet stattdessen Formular W-4)",
  ],
  [
    "You are a non-U.S. person with no U.S. tax reporting obligation — a W-8BEN or W-8BEN-E is usually the correct form instead",
    "Sie sind keine US-Person und haben keine US-Steuermeldepflicht — in der Regel ist stattdessen ein W-8BEN oder W-8BEN-E das richtige Formular",
  ],
  [
    "You are not currently paid by or contracted with the entity requesting it",
    "Derzeit weder von der anfragenden Stelle bezahlt werden noch mit dieser vertraglich verbunden sind",
  ],
];

const BEFORE_YOU_START = [
  {
    label: "Identity",
    items: [
      "Your legal name, exactly as it appears on your tax return",
      "A business or “doing business as” (DBA) name, if you use one",
      "Your federal tax classification (Individual/Sole Proprietor, LLC, C Corp, S Corp, Partnership, or Trust/Estate)",
    ],
  },
  {
    label: "Address & Taxpayer ID",
    items: [
      "The mailing address where you'd like to receive tax documents like a 1099",
      // QA F-58: Weglot flipped between "Unternehmensidentifikationsnummer"
      // and "Arbeitgeberidentifikationsnummer" for EIN. Hand-DE locks
      // the term to "Arbeitgeberidentifikationsnummer (EIN)".
      <LocaleText
        key="ssn-or-ein"
        de={
          <>
            Ihre Sozialversicherungsnummer (SSN — Einzelpersonen) oder
            Arbeitgeberidentifikationsnummer (EIN — Unternehmen)
          </>
        }
      >
        Your Social Security Number (SSN — individuals) or Employer
        Identification Number (EIN — businesses)
      </LocaleText>,
    ],
  },
  {
    label: "Certification",
    items: [
      "Any applicable exemption codes (most individuals leave this blank)",
      "Your signature and the date, confirming everything above is accurate",
    ],
  },
];

const HOW_TO_STEPS = [
  {
    n: "1",
    title: "Load the template",
    body: "Open the W-9 straight from our editor — it's already formatted and field-ready.",
  },
  {
    n: "2",
    title: "Enter your identity details",
    body: "Type your legal name, business name (if any), and select your tax classification from the checklist.",
  },
  {
    n: "3",
    title: "Add your address and TIN",
    // Plain-text form used by the JSON-LD HowTo schema (step.text must
    // be a string). The React render uses the hand-DE override below
    // so visible copy says "Arbeitgeberidentifikationsnummer (EIN)".
    body: "Fill in your mailing address, then enter your SSN or EIN in the taxpayer ID section.",
    // QA F-58: hand-DE keeps the EIN term consistent with other mentions.
    bodyNode: (
      <LocaleText
        de={
          <>
            Geben Sie Ihre Postanschrift ein und tragen Sie dann Ihre SSN oder
            Arbeitgeberidentifikationsnummer (EIN) im Abschnitt zur
            Steueridentifikationsnummer ein.
          </>
        }
      >
        Fill in your mailing address, then enter your SSN or EIN in the taxpayer
        ID section.
      </LocaleText>
    ),
  },
  {
    n: "4",
    title: "Apply exemption codes, if they apply to you",
    body: "Most people can skip this section entirely.",
  },
  {
    n: "5",
    title: "Sign electronically",
    body: "Use PDFVault's signature tool to sign and date the certification section.",
  },
  {
    n: "6",
    title: "Download your PDF",
    body: "Export a clean, print-ready copy to send to whoever requested it.",
  },
];

const FAQ: FaqEntry[] = [
  {
    id: "same-as-tax-return",
    question: "Is a W-9 the same as a tax return?",
    answer:
      "No. A W-9 only shares your taxpayer ID with a payer — it doesn't report income or calculate anything you owe. You still file your own return separately.",
  },
  {
    id: "owe-taxes-right-away",
    question: "Does filling out a W-9 mean I owe taxes right away?",
    answer:
      "No. It simply gives the payer what they need to report your income later. Any tax owed is handled through your regular tax filing.",
  },
  {
    id: "does-w9-expire",
    question: "Does a W-9 expire?",
    answer:
      "No. It stays valid until something on it changes — your name, address, business structure, or TIN. Update it with a new form only when that happens.",
  },
  {
    id: "who-fills-it-out",
    question: "Who fills out the form — me or the company paying me?",
    answer:
      "You do. The payer sends you a blank request; you complete and return it to them.",
  },
  {
    id: "no-ein-yet",
    question: "What if I don't have an EIN yet?",
    // Plain-text form used by the FAQPage JSON-LD schema. The React
    // render uses answerNode below so the visible copy says
    // "Arbeitgeberidentifikationsnummer (EIN)" consistently (QA F-58).
    answer:
      "Individuals and sole proprietors can generally use their Social Security Number instead. If you need an EIN for a registered business, you can apply for one through the IRS before completing the form.",
    answerNode: (
      <LocaleText
        de={
          <>
            Einzelpersonen und Einzelunternehmer können in der Regel stattdessen
            ihre Sozialversicherungsnummer verwenden. Wenn Sie für ein
            eingetragenes Unternehmen eine Arbeitgeberidentifikationsnummer
            (EIN) benötigen, können Sie diese vor dem Ausfüllen des Formulars
            beim IRS beantragen.
          </>
        }
      >
        Individuals and sole proprietors can generally use their Social Security
        Number instead. If you need an EIN for a registered business, you can
        apply for one through the IRS before completing the form.
      </LocaleText>
    ),
  },
  {
    id: "fill-from-phone",
    question: "Can I fill out a W-9 from my phone?",
    answer:
      "Yes — PDFVault's editor works in any browser, so you can complete and sign the form from a phone, tablet, or computer.",
  },
  {
    id: "refuse-to-provide",
    question: "What happens if I refuse to provide a W-9?",
    answer:
      "The payer may be required to withhold a percentage of your payments (“backup withholding”) until they receive a valid TIN, so it's usually worth submitting promptly.",
  },
  {
    id: "update-sent-w9",
    question: "Can I update a W-9 I already sent?",
    answer:
      "Yes. Send a corrected, freshly signed version to the same requester — there's no formal way to “cancel” one already on file, but a new form supersedes the old details.",
  },
];

// ---------------------------------------------------------------------------
// UI bits
// ---------------------------------------------------------------------------

function GetFormCta({ label = "Open the W-9 Template" }: { label?: string }) {
  return (
    <Link
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-7 py-3 text-sm font-bold text-white shadow-md shadow-red-500/25 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 sm:text-base"
      // ?new=1 — arriving from the landing always starts a blank form.
      // Returning to a saved one goes through My PDFs, which links with
      // ?resumeDocId instead.
      href={`${ROUTES.FORMS.W9_SHORT}?new=1`}
    >
      {label}
      <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
    </Link>
  );
}

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
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

function BulletList({ items }: { items: readonly BulletPair[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-6 text-sm leading-7 text-default-700 dark:text-default-300">
      {items.map(([en, de]) => (
        <li key={en}>
          <LocaleText de={de}>{en}</LocaleText>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Page content — shared between /w9-form and /forms/w-9
// ---------------------------------------------------------------------------

export function W9LandingContent() {
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
          <W9PreviewScroller />
        </div>
        <p className="mt-4 text-center text-xs italic text-default-500">
          This website is not affiliated with the IRS
        </p>
      </section>

      {/* Content — sections with sticky TOC */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <nav
            aria-label="On this page"
            className="sticky top-24 flex flex-col gap-2 border-l border-default-200 pl-4 text-base dark:border-default-700"
          >
            {(
              [
                ["What is Form W-9?", "what-is-w9"],
                ["Do you need to fill one out?", "need-one"],
                ["What you'll need before you start", "before-start"],
                ["How to fill out a W-9 in PDFVault", "how-to-fill"],
                // QA F-DE: pair this with the matching hand-DE on the
                // section heading below so TOC + heading always render
                // the same German string.
                [
                  "Signing and sending your completed form",
                  "signing",
                  "Formular unterschreiben und senden",
                ],
                ["FAQ", "faq"],
              ] as const
            ).map(([label, id, de]) => (
              <Link
                key={id}
                className="rounded px-2 py-1.5 font-medium leading-6 text-default-700 transition-colors hover:bg-default-100 hover:text-[var(--color-accent)] dark:text-default-300 dark:hover:bg-default-800"
                href={`#${id}`}
              >
                {de ? <LocaleText de={de}>{label}</LocaleText> : label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex flex-col gap-10">
          <section>
            <SectionHeading id="what-is-w9">What is Form W-9?</SectionHeading>
            <Prose>
              <p>
                Form W-9, Request for TIN and Certification, is a short IRS form
                that lets a U.S. taxpayer share their TIN with a business or
                individual that pays them. The company or person requesting it —
                the &ldquo;payer&rdquo; — uses that information to prepare
                year-end reporting forms like the 1099-NEC.
              </p>
              <p>You&apos;ll typically be asked for a W-9 in these cases:</p>
              <BulletList items={TYPICAL_REQUESTS} />
              <p>
                Unlike a tax return, a W-9 isn&apos;t sent to the IRS. It stays
                with the person who requested it, as a record they&apos;ll use
                when filing their own paperwork.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="need-one">
              Do you need to fill one out?
            </SectionHeading>
            <Prose>
              <p className="font-semibold text-[var(--color-foreground)]">
                You probably need to fill one out if:
              </p>
              <BulletList items={NEEDS_ONE} />
              <p className="font-semibold text-[var(--color-foreground)]">
                You likely don&apos;t need to fill one out if:
              </p>
              <BulletList items={DOES_NOT_NEED} />
              <p>
                There&apos;s no fixed filing deadline for a W-9 — you complete
                it whenever a payer asks for it, ideally before your first
                payment so nothing holds up their reporting.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="before-start">
              What you&apos;ll need before you start
            </SectionHeading>
            <p className="mt-3 text-sm leading-7 text-default-700 dark:text-default-300">
              Gather these details ahead of time so you can fill out the form in
              one pass:
            </p>
            <div className="mt-4 space-y-4">
              {BEFORE_YOU_START.map((group) => (
                <div
                  key={group.label}
                  className="rounded-xl border border-default-200 bg-[var(--color-background)] px-4 py-4 dark:border-default-700"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
                    <HugeiconsIcon
                      className="text-[var(--color-accent)]"
                      icon={CheckmarkCircle02Icon}
                      size={16}
                    />
                    {group.label}
                  </p>
                  <ul className="mt-2 list-disc space-y-2 pl-6 text-sm leading-6 text-default-600 dark:text-default-400">
                    {group.items.map((item, idx) => (
                      <li key={typeof item === "string" ? item : `item-${idx}`}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionHeading id="how-to-fill">
              How to fill out a W-9 in PDFVault
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
                      Step {step.n}. {step.title}.
                    </p>
                    <p className="mt-1 text-sm leading-6 text-default-600 dark:text-default-400">
                      {"bodyNode" in step ? step.bodyNode : step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex justify-center">
              <GetFormCta label="Fill Out My W-9" />
            </div>
          </section>

          <section>
            <SectionHeading id="signing">
              <LocaleText de="Formular unterschreiben und senden">
                Signing and sending your completed form
              </LocaleText>
            </SectionHeading>
            <Prose>
              <p>
                Once your details are filled in, add your signature using
                PDFVault&apos;s built-in signing tool — just draw, type, or
                upload one, then drop it into place. There&apos;s no need to
                print the form just to sign it.
              </p>
              <p>
                When you&apos;re done, send the PDF directly to the person or
                business that asked for it (a client, HR contact, or accounts
                payable team, for example). You don&apos;t file a W-9 with the
                IRS yourself — the payer keeps it on file for their own
                reporting.
              </p>
              <p>
                Double-check every field before sending. An incorrect TIN or
                name mismatch can delay payments or trigger backup withholding.
              </p>
            </Prose>
          </section>

          <section id="faq">
            <SectionHeading id="faq-heading">
              Frequently Asked Questions
            </SectionHeading>
            <div className="mt-6">
              <W9Faq items={FAQ} />
            </div>
          </section>

          {/* Closing CTA */}
          <section
            aria-label="Call to action"
            className="rounded-2xl bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] px-6 py-8 text-center"
          >
            <p className="text-lg font-semibold text-[var(--color-foreground)] sm:text-xl">
              Fill out your W-9 now
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-default-600 dark:text-default-400">
              Your W-9 template is preloaded, editable, and ready to sign — no
              downloads or extra software required.
            </p>
            <div className="mt-4 flex justify-center">
              {/* QA F-59 + F-60: previous copy was "Ready when you are" /
                  "Start My W-9". Weglot rendered both informally on /de/
                  ("Ich bin bereit, wenn du es bist" / left "Start My W-9"
                  untranslated). Formal, action-oriented English gives
                  Weglot a template that translates cleanly to formal
                  German ("Füllen Sie jetzt Ihr W-9-Formular aus" /
                  "Mein W-9-Formular ausfüllen"). Full next-intl migration
                  of the W-9 landing page is pending — see de.json →
                  toolPages for the pattern to follow. */}
              <GetFormCta label="Fill Out My W-9" />
            </div>
          </section>

          <p className="text-xs italic leading-6 text-default-500">
            Disclaimer: This page is provided for general informational purposes
            only and does not constitute tax, legal, or accounting advice. Tax
            rules can change and may vary based on your individual circumstances
            — consult a qualified tax professional or the IRS for guidance
            specific to your situation.
          </p>
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
