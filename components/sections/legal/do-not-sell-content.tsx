import type { LegalTocEntry } from "@/components/sections/legal/legal-toc";

import Link from "next/link";
import {
  Clock01Icon,
  Globe02Icon,
  JudgeIcon,
  Mail01Icon,
  SecurityCheckIcon,
  Share01Icon,
  Shield01Icon,
  SparklesIcon,
  UserCircleIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";

import { LegalSectionCard } from "@/components/sections/legal/legal-section-card";
import { ROUTES } from "@/lib/shared/constants/routes";

export const doNotSellTocEntries: LegalTocEntry[] = [
  { id: "d-6-0", label: "Overview" },
  { id: "d-6-1", label: "Your Rights Under CCPA/CPRA" },
  { id: "d-6-2", label: "Our Current Practices" },
  { id: "d-6-3", label: "Categories of Information That May Be Shared" },
  { id: "d-6-4", label: "How to Opt Out" },
  { id: "d-6-5", label: "Other California Privacy Rights" },
  { id: "d-6-6", label: "Sensitive Personal Information" },
  { id: "d-6-7", label: "Authorized Agents" },
  { id: "d-6-8", label: "Response Time" },
  { id: "d-6-9", label: "Rights for Residents of Other States" },
  { id: "d-6-10", label: "Changes to This Policy" },
  { id: "d-6-11", label: "Contact" },
];

export function DoNotSellContent() {
  return (
    <>
      <div className="mb-6" id="d-meta">
        <p>
          <strong>Updated date:</strong> 22 July 2026.
        </p>
        <p className="mt-2">
          <strong>Address:</strong> Dimostheni Severi 12, 6th floor, Flat/Office
          601, 1080, Nicosia, Cyprus.
        </p>
      </div>

      <LegalSectionCard icon={SparklesIcon} id="d-6-0" title="Overview">
        <p>
          This page explains your right to opt out of the &ldquo;sale&rdquo; or
          &ldquo;sharing&rdquo; of your personal information under the
          California Consumer Privacy Act, as amended by the California Privacy
          Rights Act (CCPA / CPRA), and under similar laws in other US states.
          It is issued by FLUTTWINGS INVESTMENTS LIMITED (&ldquo;Company,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), the
          operator of pdfvault.ai (the &ldquo;Service&rdquo;), and should be
          read together with our{" "}
          <Link href={ROUTES.LEGAL.PRIVACY}>Privacy Policy</Link> and{" "}
          <Link href={ROUTES.LEGAL.COOKIES}>Cookie Policy</Link>.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={JudgeIcon}
        id="d-6-1"
        title="Your Rights Under CCPA/CPRA"
      >
        <p>
          If you are a California resident, the CCPA, as amended by the CPRA,
          gives you the right to opt out of the &ldquo;sale&rdquo; or
          &ldquo;sharing&rdquo; of your personal information, as those terms are
          defined under California law.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Shield01Icon}
        id="d-6-2"
        title="Our Current Practices"
      >
        <p>
          We do not sell your personal information to third parties in exchange
          for money. However, under the broad definitions used by the CCPA /
          CPRA, certain data practices; such as sharing information with
          analytics providers or advertising networks; may be considered
          &ldquo;sharing&rdquo; of personal information for cross-context
          behavioral advertising purposes. We want to be transparent about this.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Share01Icon}
        id="d-6-3"
        title="Categories of Information That May Be Shared"
      >
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Identifiers (for example, IP address and cookie identifiers).</li>
          <li>
            Internet or network activity (for example, pages visited, features
            used, and session data).
          </li>
          <li>
            Geolocation data (country-level only, derived from IP address).
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={SecurityCheckIcon}
        id="d-6-4"
        title="How to Opt Out"
      >
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Cookie Settings:</strong> use the &ldquo;Cookie
            Settings&rdquo; link in the footer, or visit our{" "}
            <Link href={ROUTES.LEGAL.COOKIES}>Cookie Policy</Link>, to disable
            analytics and advertising cookies.
          </li>
          <li>
            <strong>Email:</strong> write to{" "}
            <a href="mailto:dpo@pdfvault.ai">dpo@pdfvault.ai </a> with the
            subject line &ldquo;CCPA Opt-Out Request&rdquo; and the email
            address associated with your account.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={UserCircleIcon}
        id="d-6-5"
        title="Other California Privacy Rights"
      >
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Know what personal information we collect, use, share, or sell.
          </li>
          <li>
            Delete personal information we have collected about you, subject to
            certain exceptions.
          </li>
          <li>Correct inaccurate personal information.</li>
          <li>
            Limit the use and disclosure of sensitive personal information.
          </li>
          <li>
            Non-discrimination: we will not discriminate against you for
            exercising your privacy rights.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Shield01Icon}
        id="d-6-6"
        title="Sensitive Personal Information"
      >
        <p>
          California law defines &ldquo;sensitive personal information&rdquo; to
          include government identification numbers (such as Social Security,
          driver&rsquo;s license, and passport numbers), precise geolocation,
          and other protected categories. The Service allows users to upload
          files that may incidentally contain sensitive personal information of
          this kind; for example, a scanned ID or a document referencing a
          Social Security number.
        </p>
        <p className="mt-3">
          Under California regulations (11 CCR § 7027(m)), a business is not
          required to offer a separate &ldquo;Limit the Use of My Sensitive
          Personal Information&rdquo; mechanism if it uses and discloses
          sensitive personal information only as reasonably necessary and
          proportionate to perform the service the consumer requested. Because
          we process uploaded file content solely to deliver the specific tool a
          user invokes (for example, converting, compressing, or editing that
          file), and do not infer characteristics about users or share it for
          advertising, this exception applies and a separate limitation
          mechanism is not currently required.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={UserMultiple02Icon}
        id="d-6-7"
        title="Authorized Agents"
      >
        <p>
          You may designate an authorized agent to submit a request on your
          behalf. We may require written proof of the agent&rsquo;s
          authorization and may independently verify your identity before
          processing the request.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Clock01Icon} id="d-6-8" title="Response Time">
        <p>
          We will acknowledge your opt-out request within 10 business days and
          will process it as soon as feasible, but no later than 15 business
          days from the date we receive it, in accordance with California
          regulations (11 CCR § 7026(f)). We will confirm with you once the
          opt-out is effective.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={JudgeIcon}
        id="d-6-9"
        title="Rights for Residents of Other States"
      >
        <p>
          Residents of Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA),
          Utah (UCPA), and other US states with comparable privacy laws have
          similar rights to opt out of the sale or sharing of personal
          information, and to know, delete, and correct their personal
          information. We honor opt-out, deletion, and correction requests from
          users in all such jurisdictions. Contact us at{" "}
          <a href="mailto:dpo@pdfvault.ai">dpo@pdfvault.ai </a> to exercise
          these rights.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Globe02Icon}
        id="d-6-10"
        title="Changes to This Policy"
      >
        <p>
          We may update this page periodically. Material changes will be
          announced via a notice on the Service, and the &ldquo;Effective
          date&rdquo; above will be updated.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Mail01Icon} id="d-6-11" title="Contact">
        <p>
          FLUTTWINGS INVESTMENTS LIMITED
          <br />
          Dimostheni Severi 12, 6th floor, Flat/Office 601, 1080, Nicosia,
          Cyprus.
          <br />
          For privacy rights requests or questions:{" "}
          <a href="mailto:dpo@pdfvault.ai">dpo@pdfvault.ai</a>.
        </p>
      </LegalSectionCard>
    </>
  );
}
