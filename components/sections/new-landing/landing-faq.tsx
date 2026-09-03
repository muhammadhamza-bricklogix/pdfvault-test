"use client";

import Link from "next/link";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";

// Content mirrors public/PDFVault - FAQs.pdf. When copy changes, update
// both here and the PDF so the site + the client-shared source of truth
// stay in sync.
type FaqItem = { q: string; a: React.ReactNode };
type FaqGroup = { heading: string; items: FaqItem[] };

const GROUPS: FaqGroup[] = [
  {
    heading: "Getting Started",
    items: [
      {
        q: "What is PDFVault?",
        a: (
          <>
            PDFVault is an all-in-one website for everyday document work —
            converting, editing, signing, compressing, merging, splitting, and
            more. Core tools are free to use, with no account required.
          </>
        ),
      },
      {
        q: "Do I need an account to use PDFVault?",
        a: (
          <>
            No. Core tools are available without an account. Creating an account
            lets you save files to your vault and access premium features like
            downloading edited or converted files.
          </>
        ),
      },
      {
        q: "What file types does PDFVault support?",
        a: (
          <>
            {/* Excel + PowerPoint hidden 2026-08-28 pending pipeline work. */}
            PDFVault works with PDF files as well as common formats like Word
            and images (JPG, PNG), which can be converted to and from PDF.
          </>
        ),
      },
    ],
  },
  {
    heading: "Pricing & Billing",
    items: [
      {
        q: "How much does PDFVault cost?",
        a: (
          <>
            You can start with a 7-day trial for $0.99, which gives you full
            access to premium features including file downloads. If you
            don&apos;t cancel before the trial ends, it automatically continues
            as a monthly subscription at $25 per month.
          </>
        ),
      },
      {
        q: "When will I be charged?",
        a: (
          <>
            You&apos;re charged $0.99 when you start your trial, and then $25
            every month after your trial ends, unless you cancel before your
            trial expires or before the next renewal date.
          </>
        ),
      },
      {
        q: "Can I use PDFVault without paying?",
        a: (
          <>
            Yes — our core tools (merge, split, compress, convert, rotate,
            unlock, watermark) are free to use. A subscription is only required
            for downloading certain premium outputs and accessing additional
            features.
          </>
        ),
      },
      {
        q: "Will prices ever change?",
        a: (
          <>
            We may update pricing from time to time. If we do, we&apos;ll give
            you advance notice by email or on the Service before the change
            applies to you, and you can cancel if you don&apos;t agree to the
            new price.
          </>
        ),
      },
      {
        q: "What payment methods do you accept?",
        a: (
          <>
            We accept major credit and debit cards through our payment
            processor. We do not store your full card details.
          </>
        ),
      },
    ],
  },
  {
    heading: "Cancellations & Refunds",
    items: [
      {
        q: "How do I cancel my subscription?",
        a: (
          <>
            You can cancel anytime in your account settings, or by emailing{" "}
            <a
              className="text-[#5c5c5c] underline underline-offset-2 hover:text-[#1a1c21]"
              href="mailto:support@pdfvault.ai"
            >
              support@pdfvault.ai
            </a>{" "}
            before your next renewal date. Cancelling stops future charges — you
            keep access for the rest of your current paid period.
          </>
        ),
      },
      {
        q: "If I cancel, do I get a refund for the current period?",
        a: (
          <>
            No. Cancelling stops future renewals, but we don&apos;t refund the
            unused portion of a period you&apos;ve already paid for, except
            where required by law.
          </>
        ),
      },
      {
        q: "Can I get a refund on the $0.99 trial charge or a $25 renewal?",
        a: (
          <>
            Purchases are generally non-refundable, but we&apos;ll review
            requests involving technical issues, duplicate charges, or
            unauthorized charges. EU, EEA, and UK residents also have a 14-day
            right of withdrawal. See our{" "}
            <Link
              className="text-[#5c5c5c] underline underline-offset-2 hover:text-[#1a1c21]"
              href={ROUTES.LEGAL.REFUND}
            >
              Refund Policy
            </Link>{" "}
            for full details.
          </>
        ),
      },
      {
        q: "I'm in the EU — what are my rights?",
        a: (
          <>
            You have 14 days from the date you subscribe to withdraw from the
            contract without giving a reason, by emailing{" "}
            <a
              className="text-[#5c5c5c] underline underline-offset-2 hover:text-[#1a1c21]"
              href="mailto:support@pdfvault.ai"
            >
              support@pdfvault.ai
            </a>
            . If you asked us to start the service immediately and acknowledged
            you&apos;d lose this right upon full delivery of digital content,
            that withdrawal right may no longer apply once the content has been
            delivered. See our Subscription Terms and Refund Policy for details.
          </>
        ),
      },
    ],
  },
  {
    heading: "Privacy & Security",
    items: [
      {
        q: "Do you store the files I upload?",
        a: (
          <>
            No. The contents of your uploaded files are not collected. Files are
            processed in memory and are not retained beyond your session unless
            you choose to save them to your account.
          </>
        ),
      },
      {
        q: "Do you sell my personal data?",
        a: (
          <>
            No. We do not sell your personal data. See our{" "}
            <Link
              className="text-[#5c5c5c] underline underline-offset-2 hover:text-[#1a1c21]"
              href={ROUTES.LEGAL.PRIVACY}
            >
              Privacy Policy
            </Link>{" "}
            for details on what we collect and how it&apos;s used.
          </>
        ),
      },
      {
        q: "Is my data secure?",
        a: (
          <>
            We use industry-standard security measures, including TLS encryption
            in transit and hashed passwords. No system is completely secure, but
            protecting your data is a priority in how we build the Service.
          </>
        ),
      },
      {
        q: "How do I delete my account and data?",
        a: (
          <>
            Contact us at{" "}
            <a
              className="text-[#5c5c5c] underline underline-offset-2 hover:text-[#1a1c21]"
              href="mailto:support@pdfvault.ai"
            >
              support@pdfvault.ai
            </a>{" "}
            to request deletion of your account and associated data. See our{" "}
            <Link
              className="text-[#5c5c5c] underline underline-offset-2 hover:text-[#1a1c21]"
              href={ROUTES.LEGAL.PRIVACY}
            >
              Privacy Policy
            </Link>{" "}
            for more on your rights.
          </>
        ),
      },
    ],
  },
  {
    heading: "Tools & Features",
    items: [
      {
        q: "What tools are included?",
        a: (
          <>
            Edit &amp; Sign, Convert to PDF, Convert from PDF, Compress, Merge,
            Split, Rotate, Unlock, and Watermark, with new tools added
            regularly.
          </>
        ),
      },
      {
        q: "Can I import files from Google Drive or OneDrive?",
        a: (
          <>
            Yes. You can upload from your device or import directly from Google
            Drive or Microsoft OneDrive.
          </>
        ),
      },
    ],
  },
];

function FaqRow({
  item,
  isOpen,
  onToggle,
  panelId,
  triggerId,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
  panelId: string;
  triggerId: string;
}) {
  return (
    <li className="border-b border-black/5 last:border-b-0">
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-[var(--pv-brand-red)]"
        id={triggerId}
        type="button"
        onClick={onToggle}
      >
        <span className="text-[16px] font-semibold text-[var(--pv-text-strong)] sm:text-[17px]">
          {item.q}
        </span>
        <span
          aria-hidden
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--pv-brand-red)]/10 text-[var(--pv-brand-red)] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
        </span>
      </button>
      <div
        aria-labelledby={triggerId}
        className={`grid overflow-hidden text-[15px] leading-relaxed text-[var(--pv-text-body)] transition-[grid-template-rows] duration-200 ${
          isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
        }`}
        id={panelId}
        role="region"
      >
        <div className="min-h-0">{item.a}</div>
      </div>
    </li>
  );
}

export function LandingFAQ() {
  // Active tab (index into GROUPS). Only one item open at a time keeps
  // scroll position predictable; switching tabs collapses everything.
  const [activeTab, setActiveTab] = useState(0);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const activeGroup = GROUPS[activeTab];
  const tablistId = "faq-tablist";

  return (
    <section
      aria-labelledby="faq-heading"
      className="bg-white pt-6 pb-16 sm:pt-8 sm:pb-24"
      id="faq"
    >
      <div className="pv-container">
        <div className="mx-auto max-w-[720px] text-center">
          <h2
            className="mt-2 text-[32px] font-bold leading-tight text-[var(--pv-text-strong)] sm:text-[40px]"
            id="faq-heading"
          >
            Frequently Asked Questions
          </h2>
        </div>

        {/* Tab strip — one tab per FAQ category. Horizontally scrolls on
            small screens so labels don't wrap or shrink. */}
        <div
          aria-label="FAQ categories"
          className="mx-auto mt-10 flex max-w-full gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center"
          id={tablistId}
          role="tablist"
        >
          {GROUPS.map((group, gIdx) => {
            const selected = activeTab === gIdx;

            return (
              <button
                key={group.heading}
                aria-controls={`faq-tabpanel-${gIdx}`}
                aria-selected={selected}
                className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors sm:px-5 sm:text-[14px] ${
                  selected
                    ? "bg-[var(--pv-brand-red,#f12c23)] text-white"
                    : "bg-black/5 text-[var(--pv-text-strong)] hover:bg-black/10"
                }`}
                id={`faq-tab-${gIdx}`}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
                onClick={() => {
                  setActiveTab(gIdx);
                  setOpenIdx(null);
                }}
              >
                {group.heading}
              </button>
            );
          })}
        </div>

        {/* Active tab panel */}
        <div
          aria-labelledby={`faq-tab-${activeTab}`}
          className="mx-auto mt-8 max-w-[820px]"
          id={`faq-tabpanel-${activeTab}`}
          role="tabpanel"
        >
          <ul>
            {activeGroup.items.map((item, iIdx) => (
              <FaqRow
                key={item.q}
                isOpen={openIdx === iIdx}
                item={item}
                panelId={`faq-panel-${activeTab}-${iIdx}`}
                triggerId={`faq-trigger-${activeTab}-${iIdx}`}
                onToggle={() =>
                  setOpenIdx((prev) => (prev === iIdx ? null : iIdx))
                }
              />
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-14 max-w-[720px] rounded-2xl bg-[var(--pv-brand-red)]/5 p-6 text-center sm:p-8">
          <h3 className="text-[18px] font-bold text-[var(--pv-text-strong)] sm:text-[20px]">
            Still have questions?
          </h3>
          <p className="mx-auto mt-2 max-w-[460px] text-[14px] text-[var(--pv-text-body)] sm:text-[15px]">
            Reach out any time at{" "}
            <a
              className="text-[#5c5c5c] underline underline-offset-2 hover:text-[#1a1c21]"
              href="mailto:support@pdfvault.ai"
            >
              support@pdfvault.ai
            </a>{" "}
            or visit our{" "}
            <Link
              className="text-[#5c5c5c] underline underline-offset-2 hover:text-[#1a1c21]"
              href={ROUTES.LEGAL.CONTACT}
            >
              Contact Us
            </Link>{" "}
            page.
          </p>
        </div>
      </div>
    </section>
  );
}
