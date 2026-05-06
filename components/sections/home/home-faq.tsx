"use client";

import type { Key } from "react";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Accordion, Tabs } from "@heroui/react";
import Link from "next/link";
import { useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";

type FaqEntry = {
  answer: string;
  id: string;
  question: string;
};

const ABOUT_FAQ: FaqEntry[] = [
  {
    answer:
      "PDFedits is an online workspace to view, edit, annotate, merge, compress, and convert PDFs in your browser — without installing desktop software.",
    id: "about-1",
    question: "What is PDFedits?",
  },
  {
    answer:
      "No. Open pdfedits.io in a modern browser, upload a file, and start working. We keep tightening editor tools over time, but there’s nothing to install for the web app itself.",
    id: "about-2",
    question: "Do I need to download or install anything to use PDFedits?",
  },
  {
    answer:
      "We treat your files seriously. Sessions run over HTTPS; documents you open locally stay in your browser until you choose to save or upload. Always sign out on shared devices.",
    id: "about-3",
    question: "Is PDFedits safe to use?",
  },
  {
    answer:
      "Yes. You can combine PDFs and organize pages from the editor — merge multiple files into one document and reorder thumbnails before exporting.",
    id: "about-4",
    question: "Can I merge PDF files with PDFedits?",
  },
  {
    answer:
      "When Word and other Office conversions are fully wired, you’ll upload from the home or tool flows and download a PDF. Today, the PDF editor accepts PDFs directly; check our conversion tools for formats we support today.",
    id: "about-5",
    question: "Can I convert a Word document into a PDF?",
  },
  {
    answer:
      "Use the page sidebar thumbnails: drag to reorder, rotate from the page tools, and insert blanks where supported. Exact controls evolve with each release.",
    id: "about-6",
    question: "How do I add, move and rotate pages?",
  },
  {
    answer:
      "Open your PDF in the editor and use the protect / encryption options in the menu when available, set a password, then save or export. We’ll guide sign-in if your workflow requires an account to persist the protected file.",
    id: "about-7",
    question: "How do I Password Protect a PDF?",
  },
];

const BILLING_FAQ: FaqEntry[] = [
  {
    answer:
      "The product is under active development. Many flows are free during early access; when we introduce paid tiers, we’ll list plans clearly before any charge.",
    id: "bill-1",
    question: "Is PDFedits free?",
  },
  {
    answer:
      "When billing is enabled, you’ll manage plans from your account or dashboard. Until then, there’s nothing to cancel for standard browser use.",
    id: "bill-2",
    question: "How do I cancel or change my subscription?",
  },
  {
    answer:
      "Refund rules will match the published refund policy at checkout. See our Refund Policy for the latest terms.",
    id: "bill-3",
    question: "Can I get a refund?",
  },
  {
    answer:
      "If we invoice by card, receipts appear in your account billing history or email. Contact support if you need a formal invoice for a business purchase.",
    id: "bill-4",
    question: "Where can I find my invoice or receipt?",
  },
];

const SECURITY_FAQ: FaqEntry[] = [
  {
    answer:
      "Use a strong password, enable two-factor authentication in your identity provider (e.g. Clerk) when available, and avoid sharing your session on public computers.",
    id: "sec-1",
    question: "How do I keep my account secure?",
  },
  {
    answer:
      "Contact us from the Contact page and we’ll verify your request under our Privacy Policy, including deletion where applicable.",
    id: "sec-2",
    question: "How do I delete my account or export my data?",
  },
  {
    answer:
      "Sessions use encrypted transport (HTTPS). File handling depends on the feature: local-only editing stays in-browser until you save; cloud saves follow our privacy and terms.",
    id: "sec-3",
    question: "How is my data encrypted?",
  },
  {
    answer:
      "Cookies help auth, preferences, and analytics. You control non-essential cookies via our cookie notice and Cookie Policy.",
    id: "sec-4",
    question: "What cookies does PDFedits use?",
  },
];

const TAB_CONFIG = [
  { id: "about", items: ABOUT_FAQ, label: "About PDFedits" },
  {
    id: "billing",
    items: BILLING_FAQ,
    label: "Subscription & Billing",
  },
  {
    id: "security",
    items: SECURITY_FAQ,
    label: "Security & Account",
  },
] as const;

function FaqAccordion({ items }: { items: FaqEntry[] }) {
  return (
    <Accordion
      hideSeparator
      className="flex w-full flex-col gap-3"
      variant="default"
    >
      {items.map((item) => (
        <Accordion.Item
          key={item.id}
          className="overflow-hidden rounded-2xl border border-default-200 bg-[var(--color-background)] shadow-sm dark:border-default-700"
          id={item.id}
        >
          <Accordion.Heading>
            <Accordion.Trigger className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start hover:bg-default-50 dark:hover:bg-default-50/10">
              <span className="text-base font-semibold text-[var(--color-foreground)]">
                {item.question}
              </span>
              <Accordion.Indicator className="shrink-0 text-default-400 transition-transform duration-200 data-[expanded=true]:rotate-90">
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="px-5 pb-4 pt-0 text-sm leading-relaxed text-default-600 dark:text-default-400">
              {item.answer}
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

export function HomeFaq() {
  const [tab, setTab] = useState<(typeof TAB_CONFIG)[number]["id"]>("about");

  const handleTabChange = (key: Key) => {
    if (typeof key === "string" && key) {
      setTab(key as (typeof TAB_CONFIG)[number]["id"]);
    }
  };

  return (
    <section className="relative w-full scroll-mt-24 py-16 sm:py-20" id="faq">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-sky-100/50 via-[var(--color-background)] to-[var(--color-background)] dark:from-sky-950/30"
      />
      <div className="relative mx-auto max-w-3xl px-2 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-4xl">
          Frequently Asked Questions
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-default-600 sm:text-lg dark:text-default-400">
          Got questions? Here are the answers to the most common ones about
          PDFedits.
        </p>
      </div>

      <div className="relative mx-auto mt-10 w-full max-w-3xl px-2">
        <Tabs
          className="w-full flex-col gap-8"
          selectedKey={tab}
          onSelectionChange={handleTabChange}
        >
          <Tabs.ListContainer className="w-full">
            <Tabs.List
              aria-label="FAQ categories"
              className="flex w-full flex-col gap-2 rounded-2xl border border-default-200 bg-[var(--color-background)]/90 p-1.5 shadow-sm sm:flex-row sm:gap-1 dark:border-default-700"
            >
              {TAB_CONFIG.map((t) => (
                <Tabs.Tab
                  key={t.id}
                  className="min-h-11 flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-[var(--color-foreground)] outline-none transition-colors data-[selected=true]:bg-[var(--color-foreground)] data-[selected=true]:text-[var(--color-background)] data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-[var(--color-foreground)] data-[hovered=true]:bg-default-100 data-[selected=true]:data-[hovered=true]:bg-[var(--color-foreground)] dark:data-[hovered=true]:bg-default-50/10"
                  id={t.id}
                >
                  {t.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>

          {TAB_CONFIG.map((t) => (
            <Tabs.Panel key={t.id} className="w-full outline-none" id={t.id}>
              <FaqAccordion items={[...t.items]} />
            </Tabs.Panel>
          ))}
        </Tabs>
      </div>

      <div className="relative mx-auto mt-16 w-full max-w-5xl overflow-hidden rounded-2xl bg-[#0b2a5c] px-6 py-10 text-center sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
          PDF editing made easy
        </p>
        <p className="mt-2 text-xl font-semibold text-white sm:text-2xl">
          All the PDF tools you need
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-white/80">
          Upload, edit, and export from one place — built for teams and everyday
          document work.
        </p>
        <Link
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#0b2a5c] transition-opacity hover:opacity-90"
          href={ROUTES.TOOLS.PDF_EDITOR}
        >
          Get started
        </Link>
      </div>
    </section>
  );
}
