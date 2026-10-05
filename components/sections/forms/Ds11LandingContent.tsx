import type { Ds11FaqEntry } from "./ds11-faq";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { Ds11Faq } from "@/components/sections/forms/ds11-faq";
import { Ds11PreviewScroller } from "@/components/sections/forms/Ds11PreviewScroller";
import { ROUTES } from "@/lib/shared/constants/routes";

const CONTENT_LAST_UPDATED = "October 2, 2026";

const HERO_EYEBROW = "Form DS-11";
const HERO_TITLE = "Fill out Form DS-11 Online";
const HERO_SUB =
  "Complete your passport application fast — then download the PDF as soon as you're done.";
const HERO_CTA_LABEL = "Open the DS-11 Form";
const HERO_CTA_NOTE =
  "No account needed to start. Sign in only when you're ready to save or download.";

const OFFICIAL_FEES_URL =
  "https://travel.state.gov/content/travel/en/passports/how-apply/fees.html";
const OFFICIAL_TIMES_URL =
  "https://travel.state.gov/content/travel/en/passports/how-apply/processing-times.html";
const FACILITY_FINDER_URL = "https://iafdb.travel.state.gov/";

const HOW_TO_STEPS = [
  {
    n: "1",
    title: "Choose book, card, or both",
    body: "Tick the product you are paying for. The passport card is cheaper but is valid only for land and sea travel to Canada, Mexico, the Caribbean and Bermuda — it cannot be used for international air travel.",
  },
  {
    n: "2",
    title: "Enter your name, date of birth and place of birth",
    body: "Use your full legal name exactly as it appears on your citizenship evidence. Place of birth is city and state if you were born in the United States, or city and country as it is known today if you were born abroad.",
  },
  {
    n: "3",
    title: "Add your Social Security number and contact details",
    body: "Items 5 to 9 cover your Social Security number, USCIS A-Number if you have one, email, mailing address and phone. Add any other names you have used, such as a birth name or a previous married name.",
  },
  {
    n: "4",
    title: "Complete parental, marital and travel information",
    body: "Page 2 asks for both parents as named at their own birth, your marital history, occupation, height, hair and eye colour, and your travel plans. If you have no trip booked, write none.",
  },
  {
    n: "5",
    title: "Download the PDF and print it single-sided",
    body: "Print on plain white letter paper, single-sided. Do not sign it. Bring it unsigned to your appointment along with your citizenship evidence, photo ID and one passport photo.",
  },
];

const MUST_APPLY_IN_PERSON = [
  "You are applying for a U.S. passport for the first time",
  "You are under 16, or your most recent passport was issued when you were under 16",
  "Your previous passport was lost, stolen, or damaged",
  "Your previous passport was issued more than 15 years ago",
  "Your name has changed since your last passport and you cannot document the change",
];

const SHOULD_USE_DS82 = [
  "Your passport is undamaged and you can submit it with your application",
  "It was issued when you were 16 or older",
  "It was issued within the last 15 years",
  "It was issued in your current name, or you can document your name change",
];

const BRING_CHECKLIST = [
  "Your completed DS-11, printed single-sided and left unsigned",
  "Original proof of U.S. citizenship — certified birth certificate, Consular Report of Birth Abroad, Certificate of Naturalization, or Certificate of Citizenship",
  "A photocopy of that citizenship evidence, front and back, on plain white letter paper",
  "A valid photo ID such as a driver's license, plus a photocopy of it",
  "One 2x2 inch colour passport photo taken within the last six months",
  "Two separate payments: the application fee and the execution fee",
];

const PHOTO_RULES = [
  "2 x 2 inches (51 x 51 mm), with your head between 1 and 1 3/8 inches from chin to crown",
  "Taken within the last six months, in colour, on matte or glossy photo paper",
  "Plain white or off-white background, with no shadows",
  "Full face, front view, eyes open, neutral expression or a natural smile",
  "No glasses. Hats and head coverings only for religious or medical reasons, with a signed statement",
  "Everyday clothing — no uniforms, and nothing resembling one",
];

const FEE_ROWS = [
  { product: "Passport book", adult: "$130", child: "$100" },
  { product: "Passport card", adult: "$30", child: "$15" },
  { product: "Book and card together", adult: "$160", child: "$115" },
  {
    product: "Execution fee (paid to the facility)",
    adult: "$35",
    child: "$35",
  },
  { product: "Expedited service (optional)", adult: "$60", child: "$60" },
];

const FAQ_ITEMS: Ds11FaqEntry[] = [
  {
    id: "can-i-mail-it",
    question: "Can I mail Form DS-11 instead of applying in person?",
    answer:
      "No. Form DS-11 must be submitted in person at a passport acceptance facility or a passport agency. There is no mail-in or online submission route for this form. If you are eligible to renew by mail, you need Form DS-82 instead, not DS-11.",
  },
  {
    id: "when-to-sign",
    question: "When do I sign Form DS-11?",
    answer:
      "Only when the acceptance agent tells you to, and in front of them. The agent has to witness your signature. A DS-11 that arrives already signed is normally rejected and you will have to complete a new form.",
  },
  {
    id: "renewal",
    question: "Do I need DS-11 to renew my passport?",
    answer:
      "Usually not. If your passport is undamaged, was issued when you were 16 or older, was issued within the last 15 years, and is in your current name, you can renew by mail with Form DS-82. You need DS-11 if any one of those is not true — for example if the passport was lost, stolen, damaged, or issued when you were a child.",
  },
  {
    id: "child-application",
    question: "What is different when applying for a child under 16?",
    answer:
      "Children under 16 must appear in person, and both parents or legal guardians normally need to attend and consent. You will also need evidence of the parental relationship, such as the child's certified birth certificate listing both parents. The child cannot sign the form themselves if they are unable to.",
  },
  {
    id: "two-payments",
    question: "Why are there two separate fees?",
    answer:
      "The application fee goes to the U.S. Department of State and is normally paid by check or money order. The execution fee goes to the facility that accepts and witnesses your application. They cannot usually be combined into one payment, so bring them separately.",
  },
  {
    id: "no-ssn",
    question: "What if I do not have a Social Security number?",
    answer:
      "The form still has to be submitted. You will be asked to provide a signed statement explaining that you have never been issued a Social Security number. Do not leave the question blank without that statement.",
  },
  {
    id: "no-travel-plans",
    question: "What do I put for travel plans if I have none?",
    answer:
      "Write none. Item 18 explicitly allows this — you do not need a booked trip to apply for a passport.",
  },
  {
    id: "print-double-sided",
    question: "Can I print the form double-sided?",
    answer:
      "No. Print each page on its own sheet of plain white letter paper. Double-sided printing is a common reason applications get handed back at the counter.",
  },
];

function GetFormCta({ label = HERO_CTA_LABEL }: { label?: string }) {
  return (
    <Link
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-7 py-3 text-sm font-bold text-white shadow-md shadow-red-500/25 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 sm:text-base"
      // ?new=1 — arriving from the landing always starts a blank form.
      // Returning to a saved one goes through My PDFs, which links with
      // ?resumeDocId instead.
      href={`${ROUTES.FORMS.DS11_EDIT}?new=1`}
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

function TocLink({ href, children }: { href: string; children: string }) {
  return (
    <li>
      <a
        className="transition-colors hover:text-[var(--color-accent)]"
        href={href}
      >
        {children}
      </a>
    </li>
  );
}

export function buildDs11JsonLd(pageUrl: string) {
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Fill Out Form DS-11 Online",
    description:
      "A step-by-step guide to completing Form DS-11, the U.S. passport application that must be submitted in person.",
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
        name: "Forms",
        item: "https://pdfvault.ai/all-tools",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Form DS-11",
        item: pageUrl,
      },
    ],
  };

  return { howTo, faqLd, breadcrumb };
}

export function Ds11LandingContent() {
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
          <Ds11PreviewScroller />
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
              <TocLink href="#what-is-ds-11">What is Form DS-11?</TocLink>
              <TocLink href="#who-needs-it">Who needs to use DS-11</TocLink>
              <TocLink href="#how-to-fill">How to fill out Form DS-11</TocLink>
              <TocLink href="#do-not-sign">Do not sign it yet</TocLink>
              <TocLink href="#fees">Fees</TocLink>
              <TocLink href="#processing-times">Processing times</TocLink>
              <TocLink href="#what-to-bring">What to bring</TocLink>
              <TocLink href="#photo">Photo requirements</TocLink>
              <TocLink href="#faq">Frequently asked questions</TocLink>
            </ul>
          </nav>
        </aside>

        <article className="space-y-12">
          <section>
            <SectionHeading id="what-is-ds-11">
              What is Form DS-11?
            </SectionHeading>
            <Prose>
              <p>
                <strong>Form DS-11</strong> is the U.S. Department of State
                application for a passport book, a passport card, or both. It is
                the form used by first-time applicants and by anyone who cannot
                renew by mail.
              </p>
              <p>
                The form itself is six pages: four pages of instructions and two
                pages you actually fill in. The State Department estimates it
                takes about 85 minutes. Filling it in here takes a few minutes,
                because the editor types directly onto the official PDF and
                checks your answers fit the printed boxes before you download.
              </p>
              <p>
                One thing to understand before you start:{" "}
                <strong>DS-11 cannot be mailed or filed online.</strong> You
                fill it in, print it, and hand it over in person. That is a rule
                of the form, not a limitation of this editor.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="who-needs-it">
              Who needs to use DS-11
            </SectionHeading>
            <Prose>
              <p>
                You must apply in person using Form DS-11 if any one of the
                following is true:
              </p>
            </Prose>
            <BulletList items={MUST_APPLY_IN_PERSON} />
            <Prose>
              <p className="mt-6">
                <strong>If all four of these are true instead</strong>, you do
                not need DS-11 — you can renew by mail using Form DS-82, which
                is faster and does not require an appointment:
              </p>
            </Prose>
            <BulletList items={SHOULD_USE_DS82} />
            <Prose>
              <p>
                <Link
                  className="font-medium text-[var(--color-accent)] underline underline-offset-2"
                  href={ROUTES.FORMS.DS82}
                >
                  Fill out Form DS-82 instead
                </Link>
                .
              </p>
              <p>
                Some sites claim renewals never need DS-11. That is wrong, and
                it sends people to the wrong form. A renewal needs DS-11
                whenever the previous passport was issued under age 16, is lost,
                stolen or damaged, or is more than 15 years old.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="how-to-fill">
              How to fill out Form DS-11
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
            <SectionHeading id="do-not-sign">Do not sign it yet</SectionHeading>
            <div className="mt-4 rounded-2xl border-2 border-[var(--color-accent)] bg-[var(--color-accent)]/5 p-6">
              <p className="text-base font-bold text-[var(--color-foreground)]">
                Do not sign Form DS-11 until the acceptance agent tells you to.
              </p>
              <p className="mt-2 text-sm leading-7 text-default-700 dark:text-default-300">
                Your signature has to be witnessed. If you sign the form at home
                and bring it in, the agent will normally refuse it and you will
                have to fill in a new one at the counter. The form says the same
                thing across the middle of page 1, in capitals.
              </p>
              <p className="mt-3 text-sm leading-7 text-default-700 dark:text-default-300">
                Our editor does include a signing tool, because it is part of
                the PDF editor these forms are built on. Do not use it on this
                form.
              </p>
            </div>
            <Prose>
              <p className="mt-6">
                You submit the form at a passport acceptance facility — often a
                post office, a clerk of court, or a public library — or at a
                passport agency if you are travelling urgently. Many require an
                appointment. You can{" "}
                <a
                  className="font-medium text-[var(--color-accent)] underline"
                  href={FACILITY_FINDER_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  find your nearest facility on the State Department site
                </a>
                .
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="fees">Fees</SectionHeading>
            <Prose>
              <p>
                There are always two payments: an application fee that goes to
                the Department of State, and a separate execution fee that goes
                to the facility accepting your application. They usually cannot
                be combined, so bring them separately.
              </p>
            </Prose>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-default-200 dark:border-default-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-default-50 text-left dark:bg-default-50/10">
                    <th className="px-4 py-3 font-semibold">Fee</th>
                    <th className="px-4 py-3 font-semibold">Age 16 and over</th>
                    <th className="px-4 py-3 font-semibold">Under 16</th>
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
                      <td className="px-4 py-3 tabular-nums">{row.adult}</td>
                      <td className="px-4 py-3 tabular-nums">{row.child}</td>
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
                  State Department fee page
                </a>{" "}
                before you write a check.
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
                hand it in, and mailing adds time at both ends.
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
                until your passport is in your hand.
              </p>
            </Prose>
          </section>

          <section>
            <SectionHeading id="what-to-bring">
              What to bring to your appointment
            </SectionHeading>
            <BulletList items={BRING_CHECKLIST} />
            <Prose>
              <p>
                Bring originals of your citizenship evidence. Photocopies alone
                are not accepted, and your original document is returned to you
                separately after processing.
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
              <Ds11Faq items={FAQ_ITEMS} />
            </div>
          </section>

          <section className="rounded-2xl border border-default-200 bg-gradient-to-br from-default-50 to-default-100 p-8 text-center dark:border-default-700 dark:from-default-50/10 dark:to-default-100/10">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
              Ready to fill out your DS-11?
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
