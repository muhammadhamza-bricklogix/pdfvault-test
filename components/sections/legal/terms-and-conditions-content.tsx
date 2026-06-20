import type { LegalTocEntry } from "@/components/sections/legal/legal-toc";

import Link from "next/link";
import {
  Alert01Icon,
  ArrowReloadHorizontalIcon,
  BalanceScaleIcon,
  CancelCircleIcon,
  CopyrightIcon,
  Delete02Icon,
  File01Icon,
  MoneyRemove02Icon,
  SecurityCheckIcon,
  SecurityPasswordIcon,
  Shield01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";

import { LegalCallout } from "@/components/sections/legal/legal-callout";
import { LegalSectionCard } from "@/components/sections/legal/legal-section-card";
import { ROUTES } from "@/lib/shared/constants/routes";

export const termsTocEntries: LegalTocEntry[] = [
  { id: "t-2-1", label: "Agreement" },
  { id: "t-2-2", label: "Eligibility" },
  { id: "t-2-3", label: "Account Registration" },
  { id: "t-2-4", label: "Acceptable Use" },
  { id: "t-2-5", label: "Intellectual Property" },
  { id: "t-2-6", label: "Privacy" },
  { id: "t-2-7", label: "Disclaimers" },
  { id: "t-2-8", label: "Limitation of Liability" },
  { id: "t-2-9", label: "Indemnification" },
  { id: "t-2-10", label: "Termination" },
  { id: "t-2-11", label: "Governing Law and Disputes" },
  { id: "t-2-12", label: "Changes to Terms" },
];

export function TermsAndConditionsContent() {
  return (
    <>
      <LegalSectionCard icon={File01Icon} id="t-2-1" title="Agreement">
        <p>
          By accessing or using PDFedits.io (&quot;Service&quot;), you agree to
          be bound by these Terms and Conditions. If you do not agree, do not
          use the Service.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={UserCircleIcon} id="t-2-2" title="Eligibility">
        <p>
          You must be at least 18 years of age and capable of forming a binding
          contract to use this Service. By using the Service, you represent that
          you meet these requirements.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={SecurityPasswordIcon}
        id="t-2-3"
        title="Account Registration"
      >
        <ul className="list-disc space-y-2 pl-5">
          <li>
            You may use certain features without an account, but premium
            features require registration.
          </li>
          <li>
            You are responsible for maintaining the confidentiality of your
            account credentials.
          </li>
          <li>
            You are responsible for all activity that occurs under your account.
          </li>
          <li>
            You must notify us immediately of any unauthorized use at{" "}
            <a href="mailto:support@pdfedits.io">support@pdfedits.io</a>.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={CancelCircleIcon}
        id="t-2-4"
        title="Acceptable Use"
      >
        <p>You agree not to:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Upload files containing illegal content, malware, or content that
            infringes third-party intellectual property rights.
          </li>
          <li>
            Use the Service to process files on behalf of others for commercial
            resale without our written consent.
          </li>
          <li>
            Attempt to reverse-engineer, scrape, or otherwise circumvent
            technical measures.
          </li>
          <li>
            Use automated tools to access the Service in a manner that burdens
            our infrastructure.
          </li>
          <li>
            Upload or process content that is defamatory, obscene, or otherwise
            unlawful.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={CopyrightIcon}
        id="t-2-5"
        title="Intellectual Property"
      >
        <LegalCallout variant="emphasis">
          <p>
            The Service and its content (excluding your uploaded files) are
            owned by PDFedits.io and protected by copyright, trademark, and
            other laws. You retain full ownership of all files you upload. By
            uploading files, you grant us a temporary, limited license solely to
            process them and return results to you. We do not claim ownership of
            your content.
          </p>
        </LegalCallout>
      </LegalSectionCard>

      <LegalSectionCard icon={Shield01Icon} id="t-2-6" title="Privacy">
        <p>
          Your use of the Service is also governed by our{" "}
          <Link href={ROUTES.LEGAL.PRIVACY}>Privacy Policy</Link>, which is
          incorporated into these Terms by reference.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Alert01Icon} id="t-2-7" title="Disclaimers">
        <LegalCallout variant="emphasis">
          <p className="text-xs font-semibold uppercase leading-relaxed tracking-wide">
            The service is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind, express or implied,
            including warranties of merchantability, fitness for a particular
            purpose, or non-infringement.
          </p>
        </LegalCallout>
      </LegalSectionCard>

      <LegalSectionCard
        icon={MoneyRemove02Icon}
        id="t-2-8"
        title="Limitation of Liability"
      >
        <LegalCallout variant="emphasis">
          <p className="text-xs font-semibold uppercase leading-relaxed tracking-wide">
            To the maximum extent permitted by law, PDFedits.io shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages, including loss of data or profits, arising from
            your use of the Service. Our total liability shall not exceed the
            amount you paid in the 12 months preceding the claim.
          </p>
        </LegalCallout>
      </LegalSectionCard>

      <LegalSectionCard
        icon={SecurityCheckIcon}
        id="t-2-9"
        title="Indemnification"
      >
        <p>
          You agree to indemnify and hold harmless PDFedits.io, its officers,
          directors, employees, and agents from any claims, damages, or expenses
          arising out of your use of the Service, your violation of these Terms,
          or your violation of any third-party rights.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Delete02Icon} id="t-2-10" title="Termination">
        <p>
          We reserve the right to suspend or terminate your account for
          violation of these Terms. You may terminate your account at any time.
          Upon termination, these Terms cease to apply except for sections that
          by their nature survive termination (including Intellectual Property,
          Disclaimers, Limitation of Liability, and Governing Law).
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={BalanceScaleIcon}
        id="t-2-11"
        title="Governing Law and Disputes"
      >
        <LegalCallout variant="emphasis">
          <p>
            These Terms are governed by applicable law. Any disputes shall first
            be addressed through <strong>good-faith negotiation</strong>.
            Unresolved disputes may be submitted to binding arbitration. You
            agree to{" "}
            <strong>
              waive the right to participate in class-action lawsuits
            </strong>{" "}
            to the extent permitted by law.
          </p>
        </LegalCallout>
      </LegalSectionCard>

      <LegalSectionCard
        icon={ArrowReloadHorizontalIcon}
        id="t-2-12"
        title="Changes to Terms"
      >
        <p>
          We may update these Terms at any time. We will notify you of material
          changes by <strong>email</strong> or prominent notice on the Service.
          Continued use after the effective date of changes constitutes
          acceptance.
        </p>
      </LegalSectionCard>
    </>
  );
}
