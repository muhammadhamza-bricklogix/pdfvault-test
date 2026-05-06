import Link from "next/link";

import { LegalCallout } from "@/components/sections/legal/legal-callout";
import { LegalRightsGrid } from "@/components/sections/legal/legal-rights-grid";
import { LegalSectionCard } from "@/components/sections/legal/legal-section-card";
import type { LegalTocEntry } from "@/components/sections/legal/legal-toc";

import { ROUTES } from "@/lib/shared/constants/routes";

import {
  Clock01Icon,
  Database01Icon,
  Globe02Icon,
  JudgeIcon,
  SecurityPasswordIcon,
  Settings01Icon,
  Share01Icon,
  SparklesIcon,
  StarAward01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";

export const privacyTocEntries: LegalTocEntry[] = [
  { id: "p-3-1", label: "3.1 Introduction" },
  { id: "p-3-2", label: "3.2 Information We Collect" },
  { id: "p-3-3", label: "3.3 How We Use Your Information" },
  { id: "p-3-4", label: "3.4 Legal Basis for Processing" },
  { id: "p-3-5", label: "3.5 Data Sharing and Disclosure" },
  { id: "p-3-6", label: "3.6 Data Retention" },
  { id: "p-3-7", label: "3.7 International Data Transfers" },
  { id: "p-3-8", label: "3.8 Your Rights" },
  { id: "p-3-9", label: "3.9 Children's Privacy" },
  { id: "p-3-10", label: "3.10 Security" },
];

export function PrivacyPolicyContent() {
  return (
    <>
      <LegalSectionCard icon={SparklesIcon} id="p-3-1" title="3.1 Introduction">
        <p>
          PDF Viewer App (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is
          committed to protecting your privacy. This Privacy Policy explains how
          we collect, use, disclose, and protect your personal information when
          you use our Service at pdfedits.io.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Database01Icon}
        id="p-3-2"
        title="3.2 Information We Collect"
      >
        <p className="font-semibold text-[var(--legal-burgundy)]">
          Information you provide directly:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Account registration details (name, email address, password hash).
          </li>
          <li>
            Payment information (processed and stored by our payment processor;
            we do not store full card details).
          </li>
          <li>Communications you send us (support tickets, emails).</li>
        </ul>
        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          Information collected automatically:
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
            Cookies and similar tracking technologies (see{" "}
            <Link href={ROUTES.LEGAL.COOKIES}>Cookie Policy</Link>).
          </li>
        </ul>
        <div className="mt-6">
          <LegalCallout title="What we do NOT collect:" variant="success">
            <p>
              The contents of your uploaded files. Files are processed in
              memory and not permanently stored beyond the session unless you
              explicitly save them to your account.
            </p>
          </LegalCallout>
        </div>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Settings01Icon}
        id="p-3-3"
        title="3.3 How We Use Your Information"
      >
        <p>We use your information to:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Provide, maintain, and improve the Service.</li>
          <li>Process payments and manage subscriptions.</li>
          <li>
            Send transactional emails (receipts, renewal reminders, service
            updates).
          </li>
          <li>Respond to support requests.</li>
          <li>
            Analyze usage patterns to improve user experience (using
            anonymized/aggregated data).
          </li>
          <li>Comply with legal obligations.</li>
          <li>Detect and prevent fraud or abuse.</li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={JudgeIcon}
        id="p-3-4"
        title="3.4 Legal Basis for Processing (GDPR)"
      >
        <p>For users in the European Economic Area, our legal bases are:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Performance of a contract: to provide you with the Service.</li>
          <li>
            Legitimate interests: for security, fraud prevention, and service
            improvement.
          </li>
          <li>Legal obligation: to comply with applicable laws.</li>
          <li>
            Consent: for marketing communications and non-essential cookies
            (which you may withdraw at any time).
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Share01Icon}
        id="p-3-5"
        title="3.5 Data Sharing and Disclosure"
      >
        <LegalCallout variant="success">
          <p className="font-semibold">We do not sell your personal data.</p>
        </LegalCallout>
        <p className="mt-4">We may share data with:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Service providers (payment processors, email providers, hosting
            providers) who are contractually bound to protect your data.
          </li>
          <li>Analytics providers (using anonymized data only).</li>
          <li>Law enforcement or regulatory authorities when required by law.</li>
          <li>
            Successors in the event of a merger, acquisition, or sale of assets
            (with advance notice to you).
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard icon={Clock01Icon} id="p-3-6" title="3.6 Data Retention">
        <ul className="list-disc space-y-2 pl-5">
          <li>Account data is retained for as long as your account is active.</li>
          <li>
            Uploaded file data is not retained beyond the processing session
            (unless explicitly saved to your account).
          </li>
          <li>
            Payment records are retained as required by financial and tax
            regulations.
          </li>
          <li>Log data is retained for up to 90 days.</li>
        </ul>
        <p className="mt-4">
          You may request deletion of your account and associated data at any
          time (see Your Rights).
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Globe02Icon}
        id="p-3-7"
        title="3.7 International Data Transfers"
      >
        <p>
          Your data may be processed in countries outside your own. Where we
          transfer data internationally, we ensure appropriate safeguards (e.g.,{" "}
          <strong>Standard Contractual Clauses</strong> for EEA transfers) are
          in place.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={StarAward01Icon}
        id="p-3-8"
        title="3.8 Your Rights"
      >
        <p className="font-medium">
          Depending on your location, you may have the right to:
        </p>
        <div className="mt-4">
          <LegalRightsGrid />
        </div>
        <div className="mt-6">
          <LegalCallout variant="emphasis">
            <p>
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:support@pdfeditsapp.com">support@pdfeditsapp.com</a>.
              We will respond within <strong>30 days</strong>.
            </p>
          </LegalCallout>
        </div>
      </LegalSectionCard>

      <LegalSectionCard
        icon={UserCircleIcon}
        id="p-3-9"
        title="3.9 Children's Privacy"
      >
        <p>
          The Service is not directed to children under <strong>16</strong>. We
          do not knowingly collect personal information from children under 16.
          If you believe we have inadvertently collected such information,
          please contact us immediately at{" "}
          <a href="mailto:support@pdfeditsapp.com">support@pdfeditsapp.com</a>.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={SecurityPasswordIcon}
        id="p-3-10"
        title="3.10 Security"
      >
        <p>
          We implement industry-standard security measures including TLS
          encryption in transit, hashed passwords, access controls, and regular
          security audits. No system is completely secure; we cannot guarantee
          absolute security.
        </p>
      </LegalSectionCard>
    </>
  );
}
