import Link from "next/link";

import { LegalSectionCard } from "@/components/sections/legal/legal-section-card";
import type { LegalTocEntry } from "@/components/sections/legal/legal-toc";

import { ROUTES } from "@/lib/shared/constants/routes";

import {
  Clock01Icon,
  JudgeIcon,
  Mail01Icon,
  SecurityCheckIcon,
  Share01Icon,
  Shield01Icon,
  SparklesIcon,
  UserCircleIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";

export const doNotSellTocEntries: LegalTocEntry[] = [
  { id: "d-6-1", label: "6.1 Your Rights Under CCPA/CPRA" },
  { id: "d-6-2", label: "6.2 Our Current Practices" },
  { id: "d-6-3", label: "6.3 Categories Shared" },
  { id: "d-6-4", label: "6.4 How to Opt Out" },
  { id: "d-6-5", label: "6.5 Other California Privacy Rights" },
  { id: "d-6-6", label: "6.6 Authorized Agents" },
  { id: "d-6-7", label: "6.7 Response Time" },
  { id: "d-6-8", label: "6.8 Contact" },
  { id: "d-6-9", label: "6.9 Rights for Other States" },
];

export function DoNotSellContent() {
  return (
    <>
      <LegalSectionCard icon={JudgeIcon} id="d-6-1" title="6.1 Your Rights Under CCPA/CPRA">
        <p>
          If you are a California resident, the California Consumer Privacy Act
          (CCPA), as amended by the California Privacy Rights Act (CPRA), gives
          you the right to opt out of the &quot;sale&quot; or
          &quot;sharing&quot; of your personal information as those terms are
          defined under California law.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Shield01Icon} id="d-6-2" title="6.2 Our Current Practices">
        <p>
          PDF Viewer App does not sell your personal information to third
          parties for monetary compensation.
        </p>
        <p className="mt-3">
          However, under the broad definitions of the CCPA/CPRA, certain data
          practices — such as sharing information with analytics providers or
          advertising networks — may be considered &quot;sharing&quot; personal
          information for cross-context behavioral advertising purposes. We want
          to be transparent about this.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Share01Icon}
        id="d-6-3"
        title="6.3 Categories of Information That May Be Shared"
      >
        <p>
          The following categories of personal information may be shared for
          analytics or service improvement purposes:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Identifiers (IP address, cookie identifiers).</li>
          <li>
            Internet or network activity (pages visited, features used, session
            data).
          </li>
          <li>Geolocation data (country-level only, derived from IP address).</li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={SecurityCheckIcon}
        id="d-6-4"
        title="6.4 How to Opt Out"
      >
        <p>You may exercise this right by:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Using the &quot;Cookie Settings&quot; link in the footer (
            <Link href={`${ROUTES.LEGAL.COOKIES}#managing-cookies`}>
              manage cookies
            </Link>
            ) to disable analytics and advertising cookies.
          </li>
          <li>
            Emailing us at{" "}
            <a href="mailto:support@pdfeditsapp.com?subject=CCPA%20Opt-Out%20Request">
              support@pdfeditsapp.com
            </a>{" "}
            with subject line &quot;CCPA Opt-Out Request&quot; and your account
            email address.
          </li>
          <li>
            Using a Global Privacy Control (GPC) signal in your browser — we
            honor GPC signals automatically.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard icon={SparklesIcon} id="d-6-5" title="6.5 Other California Privacy Rights">
        <p>As a California resident, you also have the right to:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Know what personal information we collect, use, share, or sell.
          </li>
          <li>
            Delete personal information we have collected about you (subject to
            certain exceptions).
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
        icon={UserMultiple02Icon}
        id="d-6-6"
        title="6.6 Authorized Agents"
      >
        <p>
          You may designate an authorized agent to submit a request on your
          behalf. We may require written proof of authorization and may verify
          the identity of the requestor.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Clock01Icon} id="d-6-7" title="6.7 Response Time">
        <p>
          We will acknowledge your opt-out request within 10 business days and
          fulfill it within 15 business days. We will confirm once the opt-out is
          effective.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Mail01Icon} id="d-6-8" title="6.8 Contact">
        <p>
          For privacy rights requests or questions:{" "}
          <a href="mailto:support@pdfeditsapp.com">support@pdfeditsapp.com</a>
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={UserCircleIcon} id="d-6-9" title="6.9 Rights for Residents of Other States">
        <p>
          Residents of Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA),
          Utah (UCPA), and other states with privacy laws have similar rights.
          We honor opt-out and deletion requests from users in all such
          jurisdictions. Contact us at{" "}
          <a href="mailto:support@pdfeditsapp.com">support@pdfeditsapp.com</a> to
          exercise your rights.
        </p>
      </LegalSectionCard>
    </>
  );
}
