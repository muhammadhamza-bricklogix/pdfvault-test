import type { Ds82FaqEntry } from "./ds82-faq";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { Ds82Faq } from "@/components/sections/forms/ds82-faq";
import { Ds82PreviewScroller } from "@/components/sections/forms/Ds82PreviewScroller";
import { ROUTES } from "@/lib/shared/constants/routes";

const CONTENT_LAST_UPDATED = "October 4, 2026";

const HERO_EYEBROW = "Form DS-82";
const HERO_TITLE = "Renew Your U.S. Passport Online";
const HERO_SUB =
  "Fill out Form DS-82 in your browser, then download a print-ready PDF to post with your current passport.";
const HERO_CTA_LABEL = "Open the DS-82 Form";
const HERO_CTA_NOTE =
  "No account needed to start. Sign in only when you're ready to save or download.";

const OFFICIAL_FEES_URL =
  "https://travel.state.gov/content/travel/en/passports/how-apply/fees.html";
const OFFICIAL_TIMES_URL =
  "https://travel.state.gov/content/travel/en/passports/how-apply/processing-times.html";
const OFFICIAL_RENEW_URL =
  "https://travel.state.gov/content/travel/en/passports/have-passport/renew.html";

/** All five must be true, or the applicant needs DS-11 instead. */
const ELIGIBILITY = [
  "You can submit your most recent U.S. passport with the application",
  "Your passport is undamaged, apart from normal wear",
  "You were at least 16 years old when it was issued",
  "It was issued within the last 15 years",
  "It was issued in your current name, or you can document your name change",
];

const MUST_USE_DS11 = [
  "Your most recent passport was lost, stolen or damaged",
  "You were under 16 when it was issued",
  "It was issued more than 15 years ago",
  "You have never held a U.S. passport",
  "You cannot submit the passport with your application",
];

const HOW_TO_STEPS = [
  {
    n: "1",
    title: "Check you are eligible",
    body: "DS-82 is the mail-in renewal form. If any one of the five eligibility statements is false, you need Form DS-11 and an in-person appointment instead.",
  },
  {
    n: "2",
    title: "Fill in your details",
    body: "Type directly onto the form — name, date and place of birth, contact details, your most recent passport's number and issue date, and your travel plans. The editor checks each answer fits the printed boxes as you go.",
  },
  {
    n: "3",
    title: "Download and print",
    body: "Download the completed PDF and print both application pages single-sided, on separate sheets. Black and white is fine; only the photo needs to be in colour.",
  },
  {
    n: "4",
    title: "Sign, attach and post",
    body: "Sign and date page 1 by hand, staple a new passport photo, and mail the form with your most recent passport and your fee payment.",
  },
];

const MAIL_CHECKLIST = [
  "Both printed application pages, signed and dated by hand on page 1",
  "Your most recent U.S. passport book and/or card",
  "One new colour passport photo, taken within the last six months",
  "A check or money order for the fee, payable to “U.S. Department of State”",
  "Certified proof of your name change, if your name differs from the passport",
];

const PHOTO_RULES = [
  "2 x 2 inches, in colour, taken within the last six months",
  "Plain white or off-white background, face square to the camera",
  "A neutral expression or a natural smile, with both eyes open",
  "Everyday clothing — no uniforms, and no hats or head coverings unless worn daily for religious reasons",
  "No glasses — they have not been allowed in passport photos since 2016",
];

const FEE_ROWS = [
  { product: "Passport book", fee: "$130" },
  { product: "Passport card", fee: "$30" },
  { product: "Book and card together", fee: "$160" },
  { product: "Expedited service (optional)", fee: "$60" },
];

const FAQ_ITEMS: Ds82FaqEntry[] = [
  {
    id: "ds-11-vs-ds-82",
    question: "What is the difference between Form DS-82 and Form DS-11?",
    answer:
      "DS-82 is the renewal form, completed by mail. DS-11 is for first-time applicants and for anyone who cannot renew by mail — for example if the previous passport was lost, stolen or damaged, was issued before the applicant turned 16, or is more than 15 years old. DS-11 has to be submitted in person.",
  },
  {
    id: "renewal-cost",
    question: "How much does it cost to renew a passport?",
    answer:
      "A passport book is $130, a passport card is $30, and both together are $160. Expedited processing is an extra $60. Fees are set by the Department of State and can change — check the official fee page before you post your application.",
  },
  {
    id: "black-and-white",
    question: "Can I print the form in black and white?",
    answer:
      "Yes. The form may be printed in black and white on ordinary white paper. Print the two application pages single-sided, on separate sheets. Only your photo needs to be in colour.",
  },
  {
    id: "signature",
    question: "Do I need to sign the form before printing?",
    answer:
      "No — and you cannot. The signature must be handwritten in ink after printing. Sign and date page 1 in the designated area; an application posted without a handwritten signature will be returned.",
  },
  {
    id: "old-passport",
    question: "Do I have to send my old passport?",
    answer:
      "Yes. Your most recent passport must be submitted with the application. It is returned to you, usually separately from your new one. If you cannot submit it, you cannot use DS-82.",
  },
  {
    id: "name-change",
    question: "Can I renew if my name has changed?",
    answer:
      "Yes, provided you can document the change. Complete the name change section on page 1 and include a certified copy of your marriage certificate or court order. Photocopies are not accepted.",
  },
];

function GetFormCta({ label = HERO_CTA_LABEL }: { label?: string }) {
  return (
    <Link
      className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      // ?new=1 — arriving from the landing always starts a blank form.
      // Returning to a saved one goes through My PDFs, which links with
      // ?resumeDocId instead.
      href={`${ROUTES.FORMS.DS82_EDIT}?new=1`}
    >
      {label}
      <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
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
    <div className="mt-4 space-y-4 text-sm leading-7 text-default-700 dark:text-default-300">
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2 text-sm leading-7 text-default-700 dark:text-default-300">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            aria-hidden
            className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TocLink({ href, children }: { href: string; children: string }) {
  return (
    <li>
      <a className="hover:text-[var(--color-accent)]" href={href}>
        {children}
      </a>
    </li>
  );
}

export function buildDs82JsonLd(pageUrl: string) {
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to fill out Form DS-82",
    description:
      "Complete the U.S. passport renewal application (Form DS-82) online, then print, sign and post it.",
    totalTime: "PT15M",
    step: HOW_TO_STEPS.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.body,
      url: `${pageUrl}#how-to-fill`,
    })),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Forms",
        item: `${pageUrl.replace(/\/forms\/ds-82$/, "")}/all-tools`,
      },
      { "@type": "ListItem", position: 2, name: "Form DS-82", item: pageUrl },
    ],
  };

  return { howTo, faqLd, breadcrumb };
}

export function Ds82LandingContent() {
  return (
    <div className="w-full pb-16">
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
          <Ds82PreviewScroller />
        </div>
        <p className="mt-4 text-center text-xs italic text-default-500">
          This website is not affiliated with the U.S. Department of State or
          any government agency
        </p>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <nav
            aria-label="Table of contents"
            className="sticky top-20 rounded-2xl border border-default-200 bg-[var(--color-background)] p-5 text-sm shadow-sm dark:border-default-700"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-default-500">
              On this page
            </p>
            <ul className="mt-4 space-y-2.5 text-default-600 dark:text-default-400">
              <TocLink href="#what-is-ds-82">What is Form DS-82?</TocLink>
              <TocLink href="#eligibility">Can you use DS-82?</TocLink>
              <TocLink href="#ds-11-instead">
                When you need DS-11 instead
              </TocLink>
              <TocLink href="#how-to-fill">How to fill out Form DS-82</TocLink>
              <TocLink href="#do-not-sign">
                Do not sign it before printing
              </TocLink>
              <TocLink href="#what-to-mail">What to post</TocLink>
              <TocLink href="#fees">Fees</TocLink>
              <TocLink href="#processing-times">Processing times</TocLink>
              <TocLink href="#photo">Photo requirements</TocLink>
              <TocLink href="#faq">Frequently asked questions</TocLink>
            </ul>
          </nav>
        </aside>

        <article className="space-y-12">
          <section>
            <SectionHeading id="what-is-ds-82">
              What is Form DS-82?
            </SectionHeading>
            <Prose>
              <p>
                <strong>Form DS-82</strong> is the U.S. Department of State
                renewal application for a passport book, a passport card, or
                both. It is the only passport form that can be submitted
                entirely by mail — there is no appointment and no acceptance
                agent.
              </p>
              <p>
                The form is six pages: four pages of instructions and two pages
                you actually fill in. This editor opens straight to the first
                application page, so you are not scrolling through instructions
                looking for somewhere to type.
              </p>
              <p>
                One thing to understand before you start:{" "}
                <strong>
                  the signature has to be handwritten after printing.
                </strong>{" "}
                That is a rule of the form, not a limitation of this editor.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="eligibility">Can you use DS-82?</SectionHeading>
            <Prose>
              <p>
                You can renew by mail only if <strong>all five</strong> of the
                following are true:
              </p>
            </Prose>
            <BulletList items={ELIGIBILITY} />
            <Prose>
              <p>
                If even one is false, your application will be returned. Check
                the{" "}
                <a
                  className="font-medium text-[var(--color-accent)] underline"
                  href={OFFICIAL_RENEW_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  official renewal guidance
                </a>{" "}
                if you are unsure.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="ds-11-instead">
              When you need DS-11 instead
            </SectionHeading>
            <Prose>
              <p>
                You must apply in person using Form DS-11 if any one of the
                following is true:
              </p>
            </Prose>
            <BulletList items={MUST_USE_DS11} />
            <Prose>
              <p className="mt-6">
                <Link
                  className="font-medium text-[var(--color-accent)] underline"
                  href={ROUTES.FORMS.DS11}
                >
                  Fill out Form DS-11 instead
                </Link>
                .
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="how-to-fill">
              How to fill out Form DS-82
            </SectionHeading>
            <div className="mt-6 space-y-5">
              {HOW_TO_STEPS.map((step) => (
                <div key={step.n} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-bold text-white">
                    {step.n}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[var(--color-foreground)]">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-7 text-default-700 dark:text-default-300">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionHeading id="do-not-sign">
              Do not sign it before printing
            </SectionHeading>
            <Prose>
              <p>
                The signature on a passport application must be handwritten in
                ink. Fill the form in, print it, and only then sign and date
                page 1 in the designated area.
              </p>
              <p>
                An application posted without a handwritten signature is
                returned unprocessed, which costs you the full mailing time in
                both directions.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="what-to-mail">What to post</SectionHeading>
            <BulletList items={MAIL_CHECKLIST} />
            <Prose>
              <p>
                Post everything together to the address for your state and
                service level, listed on instruction page 3 of the form. Your
                old passport is returned to you, usually separately from the new
                one.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="fees">Fees</SectionHeading>
            <Prose>
              <p>
                Renewing by mail has a single application fee — there is no
                execution fee, because no acceptance agent is involved. Pay by
                check or money order; cash is not accepted by post.
              </p>
            </Prose>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-default-200 dark:border-default-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-default-50 text-left dark:bg-default-50/10">
                    <th className="px-4 py-3 font-semibold">
                      What you are renewing
                    </th>
                    <th className="px-4 py-3 font-semibold">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {FEE_ROWS.map((row) => (
                    <tr
                      key={row.product}
                      className="border-t border-default-200 dark:border-default-700"
                    >
                      <td className="px-4 py-3 text-default-700 dark:text-default-300">
                        {row.product}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{row.fee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Prose>
              <p>
                Fees change. Confirm the current amounts on the{" "}
                <a
                  className="font-medium text-[var(--color-accent)] underline"
                  href={OFFICIAL_FEES_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  official fee page
                </a>{" "}
                before you post your application.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="processing-times">
              Processing times
            </SectionHeading>
            <Prose>
              <p>
                Routine service typically takes several weeks, and expedited
                service shortens it for an extra fee. Processing time is counted
                from when your application is received, not from the day you
                post it, and mailing adds time at both ends.
              </p>
              <p>
                Published times move around a lot depending on demand, so treat
                any figure you read on a third-party site — including this one —
                as out of date. Check the{" "}
                <a
                  className="font-medium text-[var(--color-accent)] underline"
                  href={OFFICIAL_TIMES_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  current processing times
                </a>{" "}
                before you book travel, and do not book non-refundable travel
                until your new passport is in your hand.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="photo">Photo requirements</SectionHeading>
            <BulletList items={PHOTO_RULES} />
            <Prose>
              <p>
                A rejected photo is one of the most common reasons an
                application is delayed. If you are unsure, most pharmacies and
                shipping stores take compliant passport photos for a few
                dollars.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="faq">Frequently Asked Questions</SectionHeading>
            <div className="mt-6">
              <Ds82Faq items={FAQ_ITEMS} />
            </div>
          </section>

          <section className="rounded-2xl border border-default-200 bg-gradient-to-br from-default-50 to-default-100 p-8 text-center dark:border-default-700 dark:from-default-50/10 dark:to-default-100/10">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
              Ready to renew your passport?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-default-600 dark:text-default-400">
              Type straight onto the official form, check it reads correctly,
              and download a print-ready PDF.
            </p>
            <div className="mt-6 flex justify-center">
              <GetFormCta />
            </div>
          </section>

          <p className="text-xs italic leading-6 text-default-500">
            Disclaimer: This page is provided for general informational purposes
            only and is not legal or immigration advice. We are not affiliated
            with the U.S. Department of State or any government agency. Passport
            requirements, fees and processing times change — always confirm
            details with travel.state.gov before submitting your application.
          </p>
        </article>
      </div>
    </div>
  );
}
