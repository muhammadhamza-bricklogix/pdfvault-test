import type { LegalTocEntry } from "@/components/sections/legal/legal-toc";

import Link from "next/link";
import {
  Clock01Icon,
  Database01Icon,
  Globe02Icon,
  JudgeIcon,
  Mail01Icon,
  SecurityPasswordIcon,
  Settings01Icon,
  Share01Icon,
  SparklesIcon,
  StarAward01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";

import { LegalSectionCard } from "@/components/sections/legal/legal-section-card";
import { ROUTES } from "@/lib/shared/constants/routes";

export const privacyTocEntries: LegalTocEntry[] = [
  { id: "p-3-1", label: "Introduction" },
  { id: "p-3-2", label: "Information We Collect" },
  { id: "p-3-3", label: "How We Use Your Information" },
  { id: "p-3-4", label: "Legal Bases for Processing (EEA and UK Users)" },
  { id: "p-3-5", label: "Data Sharing and Disclosure" },
  { id: "p-3-6", label: "Data Retention" },
  { id: "p-3-7", label: "International Data Transfers" },
  { id: "p-3-8", label: "Your Rights" },
  { id: "p-3-9", label: "Children’s Privacy" },
  { id: "p-3-10", label: "US State Privacy Notice" },
  { id: "p-3-11", label: "Security" },
  { id: "p-3-12", label: "Changes to This Policy" },
  { id: "p-3-13", label: "Contact" },
];

export function PrivacyPolicyContent() {
  return (
    <>
      <div className="mb-6" id="p-meta">
        <p>
          <strong>Updated date:</strong> 22 July 2026.
        </p>
        <p className="mt-2">
          <strong>Address:</strong> Shams Business Center, Sharjah Media City
          Free Zone, Al Messaned, Sharjah, UAE.
        </p>
      </div>

      <LegalSectionCard icon={SparklesIcon} id="p-3-1" title="Introduction">
        <p>
          Content Clicks LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;), with registered address at Shams Business Center,
          Sharjah Media City Free Zone, Al Messaned, Sharjah, UAE, is the data
          controller of your personal information and is committed to protecting
          your privacy. This Privacy Policy explains how we collect, use,
          disclose, and protect your personal information when you use our
          Service at pdfvault.ai.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Database01Icon}
        id="p-3-2"
        title="Information We Collect"
      >
        <p className="font-semibold text-[var(--legal-burgundy)]">
          Information you provide directly
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Account registration details (name, email address, password hash).
          </li>
          <li>
            Payment information (processed and stored by our payment processors;
            we do not store full card details).
          </li>
          <li>Communications you send us (support tickets, emails).</li>
        </ul>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          Information collected automatically
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Log data: IP address, browser type, pages visited, timestamps,
            referring URLs.
          </li>
          <li>
            Device information: operating system, screen resolution, language
            settings.
          </li>
          <li>
            Usage data: features used, file types processed (not file contents),
            session duration.
          </li>
          <li>
            Cookies and similar tracking technologies (see our{" "}
            <Link href={ROUTES.LEGAL.COOKIES}>Cookie Policy</Link>).
          </li>
        </ul>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          Your uploaded files
        </p>
        <p>
          Files you upload are processed to deliver the feature you request and
          are not retained beyond the processing session unless you explicitly
          save them to your account. If you save files to your account, we store
          them until you delete them or close your account. If you use AI
          features (such as the AI Summarizer), the content of the relevant file
          is processed; including, where applicable, by third-party AI providers
          under contractual confidentiality obligations; solely to generate the
          output you request. We do not use your files to train AI models.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Settings01Icon}
        id="p-3-3"
        title="How We Use Your Information"
      >
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Provide, maintain, and improve the Service.</li>
          <li>Process payments and manage subscriptions.</li>
          <li>
            Send transactional emails (receipts, renewal reminders, service
            updates).
          </li>
          <li>Respond to support requests.</li>
          <li>
            Analyze usage patterns to improve user experience (using anonymized
            / aggregated data).
          </li>
          <li>
            Send marketing communications where you have consented (you may
            unsubscribe at any time).
          </li>
          <li>
            Comply with legal obligations and detect and prevent fraud or abuse.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={JudgeIcon}
        id="p-3-4"
        title="Legal Bases for Processing (EEA and UK Users)"
      >
        <p>
          For users in the European Economic Area and the United Kingdom, we
          process personal data under the EU GDPR and UK GDPR on the following
          bases: performance of a contract (to provide the Service); legitimate
          interests (security, fraud prevention, service improvement); legal
          obligation (compliance with applicable laws); and consent (marketing
          communications and non-essential cookies, which you may withdraw at
          any time).
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Share01Icon}
        id="p-3-5"
        title="Data Sharing and Disclosure"
      >
        <p>
          We do not sell your personal data for monetary compensation. We may
          share data with:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Service providers: payment processors, hosting providers, email
            providers, and customer support tools, contractually bound to
            protect your data.
          </li>
          <li>AI service providers, where you use AI features.</li>
          <li>
            Analytics providers (e.g., Google Analytics), using pseudonymized
            data.
          </li>
          <li>
            Law enforcement or regulatory authorities when required by law.
          </li>
          <li>
            Successors in the event of a merger, acquisition, or sale of assets
            (with notice to you).
          </li>
        </ul>
        <p className="mt-3">
          <strong>Note:</strong> some sharing via cookies for analytics or
          advertising may qualify as a &ldquo;sale&rdquo; or
          &ldquo;sharing&rdquo; under certain US state laws even without
          payment; see Section 10.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Clock01Icon} id="p-3-6" title="Data Retention">
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Account data: retained while your account is active.</li>
          <li>
            Uploaded files: not retained beyond the processing session unless
            saved to your account.
          </li>
          <li>
            Payment records: retained as required by financial and tax
            regulations.
          </li>
          <li>Log data: retained for up to 90 days.</li>
        </ul>
        <p className="mt-3">
          You may request deletion of your account and associated data at any
          time (see Section 8).
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Globe02Icon}
        id="p-3-7"
        title="International Data Transfers"
      >
        <p>
          Your data may be processed in countries outside your own, including
          outside the EEA and the UK. Where we transfer data internationally, we
          implement appropriate safeguards, including the European
          Commission&rsquo;s Standard Contractual Clauses for EEA transfers and
          the UK International Data Transfer Addendum for UK transfers.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={StarAward01Icon} id="p-3-8" title="Your Rights">
        <p>
          Depending on your location, you may have the right to: access a copy
          of your personal data; rectify inaccurate data; request erasure
          (&ldquo;right to be forgotten&rdquo;); restrict processing; receive
          your data in a portable, machine-readable format; object to processing
          based on legitimate interests; withdraw consent at any time; and lodge
          a complaint with your local data protection authority.
        </p>
        <p className="mt-3">
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:dpo@pdfvault.ai">dpo@pdfvault.ai</a>. We will respond
          within the timeframe required by applicable law (one month under the
          GDPR / UK GDPR; up to 45 days under certain US state laws). We may
          need to verify your identity before acting on a request.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={UserCircleIcon}
        id="p-3-9"
        title="Children’s Privacy"
      >
        <p>
          The Service is not directed to children under 18, and users must be at
          least 18 to use the Service (see our{" "}
          <Link href={ROUTES.LEGAL.TERMS}>Terms and Conditions</Link>). We do
          not knowingly collect personal information from anyone under 18. If
          you believe we have inadvertently collected such information, contact
          us immediately at <a href="mailto:dpo@pdfvault.ai">dpo@pdfvault.ai</a>{" "}
          and we will delete it.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={JudgeIcon}
        id="p-3-10"
        title="US State Privacy Notice"
      >
        <p>
          This section applies to residents of US states with consumer privacy
          laws (including California, Colorado, Connecticut, Texas, Virginia,
          and others). In the preceding 12 months we have collected the
          categories of personal information described in Section 2:
          identifiers, commercial information, and internet activity
          information. We collect them for the purposes in Section 3 and share
          them with the categories of recipients in Section 5.
        </p>
        <p className="mt-3">
          You may have the right to: know and access the personal information we
          hold about you; delete it; correct it; receive it in a portable
          format; opt out of &ldquo;sales,&rdquo; &ldquo;sharing,&rdquo; and
          targeted advertising; limit use of sensitive personal information; and
          not be discriminated against for exercising these rights. We honor
          Global Privacy Control (GPC) signals as an opt-out of sale / sharing
          where required. To exercise any right, or to appeal a decision, email{" "}
          <a href="mailto:dpo@pdfvault.ai">dpo@pdfvault.ai</a>. Authorized
          agents may submit requests with proof of authorization.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={SecurityPasswordIcon}
        id="p-3-11"
        title="Security"
      >
        <p>
          We implement industry-standard security measures including TLS
          encryption in transit, encryption at rest, hashed passwords, access
          controls, and regular security reviews. No system is completely
          secure; we cannot guarantee absolute security. If a personal data
          breach occurs, we will notify affected users and regulators where
          required by law.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Globe02Icon}
        id="p-3-12"
        title="Changes to This Policy"
      >
        <p>
          We may update this Privacy Policy periodically. Material changes will
          be announced by email or prominent notice on the Service before they
          take effect. The &ldquo;updated date&rdquo; above shows when this
          Policy was last revised.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Mail01Icon} id="p-3-13" title="Contact">
        <p>
          Content Clicks LLC
          <br />
          Shams Business Center, Sharjah Media City Free Zone, Al Messaned,
          Sharjah, UAE.
          <br />
          Privacy contact: <a href="mailto:dpo@pdfvault.ai">dpo@pdfvault.ai</a>
        </p>
      </LegalSectionCard>
    </>
  );
}
