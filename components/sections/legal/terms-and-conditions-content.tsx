import Link from "next/link";

import { LegalSubsection } from "@/components/sections/legal/legal-subsection";

import { ROUTES } from "@/lib/shared/constants/routes";

export function TermsAndConditionsContent() {
  return (
    <>
      <LegalSubsection title="2.1 Agreement">
        <p>
          By accessing or using PDF Viewer App at pdfedits.io (&quot;Service&quot;),
          you agree to be bound by these Terms and Conditions. If you do not
          agree, do not use the Service.
        </p>
      </LegalSubsection>

      <LegalSubsection title="2.2 Eligibility">
        <p>
          You must be at least 18 years of age and capable of forming a binding
          contract to use this Service. By using the Service, you represent
          that you meet these requirements.
        </p>
      </LegalSubsection>

      <LegalSubsection title="2.3 Account Registration">
        <p>
          You may use certain features without an account, but premium features
          require registration.
        </p>
        <p>
          You are responsible for maintaining the confidentiality of your
          account credentials.
        </p>
        <p>
          You are responsible for all activity that occurs under your account.
        </p>
        <p>
          You must notify us immediately of any unauthorized use at{" "}
          <a
            className="font-medium text-[var(--color-accent)] underline underline-offset-2"
            href="mailto:support@pdfeditsapp.com"
          >
            support@pdfeditsapp.com
          </a>
          .
        </p>
      </LegalSubsection>

      <LegalSubsection title="2.4 Acceptable Use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
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
      </LegalSubsection>

      <LegalSubsection title="2.5 Intellectual Property">
        <p>
          The Service and its content (excluding your uploaded files) are owned
          by PDF Viewer App and protected by copyright, trademark, and other
          laws. You retain full ownership of all files you upload. By uploading
          files, you grant us a temporary, limited license solely to process them
          and return results to you. We do not claim ownership of your content.
        </p>
      </LegalSubsection>

      <LegalSubsection title="2.6 Privacy">
        <p>
          Your use of the Service is also governed by our{" "}
          <Link
            className="font-medium text-[var(--color-accent)] underline underline-offset-2 hover:opacity-90"
            href={ROUTES.LEGAL.PRIVACY}
          >
            Privacy Policy
          </Link>
          , which is incorporated into these Terms by reference.
        </p>
      </LegalSubsection>

      <LegalSubsection title="2.7 Disclaimers">
        <p className="font-medium uppercase tracking-wide text-default-700 dark:text-default-300">
          The service is provided &quot;as is&quot; and &quot;as available&quot;
          without warranties of any kind, express or implied, including
          warranties of merchantability, fitness for a particular purpose, or
          non-infringement.
        </p>
      </LegalSubsection>

      <LegalSubsection title="2.8 Limitation of Liability">
        <p className="font-medium uppercase tracking-wide text-default-700 dark:text-default-300">
          To the maximum extent permitted by law, PDF Viewer App shall not be
          liable for any indirect, incidental, special, consequential, or
          punitive damages, including loss of data or profits, arising from your
          use of the Service. Our total liability shall not exceed the amount
          you paid in the 12 months preceding the claim.
        </p>
      </LegalSubsection>

      <LegalSubsection title="2.9 Indemnification">
        <p>
          You agree to indemnify and hold harmless PDF Viewer App, its
          officers, directors, employees, and agents from any claims, damages,
          or expenses arising out of your use of the Service, your violation of
          these Terms, or your violation of any third-party rights.
        </p>
      </LegalSubsection>

      <LegalSubsection title="2.10 Termination">
        <p>
          We reserve the right to suspend or terminate your account for
          violation of these Terms. You may terminate your account at any time.
          Upon termination, these Terms cease to apply except for sections that
          by their nature survive termination (including Intellectual Property,
          Disclaimers, Limitation of Liability, and Governing Law).
        </p>
      </LegalSubsection>

      <LegalSubsection title="2.11 Governing Law and Disputes">
        <p>
          These Terms are governed by applicable law. Any disputes shall first
          be addressed through good-faith negotiation. Unresolved disputes may
          be submitted to binding arbitration. You agree to waive the right to
          participate in class-action lawsuits to the extent permitted by law.
        </p>
      </LegalSubsection>

      <LegalSubsection title="2.12 Changes to Terms">
        <p>
          We may update these Terms at any time. We will notify you of material
          changes by email or prominent notice on the Service. Continued use
          after the effective date of changes constitutes acceptance.
        </p>
      </LegalSubsection>
    </>
  );
}
