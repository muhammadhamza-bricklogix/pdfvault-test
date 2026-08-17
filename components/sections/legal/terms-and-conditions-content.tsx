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
  Mail01Icon,
  MoneyRemove02Icon,
  SecurityCheckIcon,
  SecurityPasswordIcon,
  Shield01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";

import { LegalSectionCard } from "@/components/sections/legal/legal-section-card";
import { ROUTES } from "@/lib/shared/constants/routes";

export const termsTocEntries: LegalTocEntry[] = [
  { id: "t-2-1", label: "Acceptance of These Terms" },
  { id: "t-2-2", label: "Eligibility" },
  { id: "t-2-3", label: "Account Registration" },
  { id: "t-2-4", label: "Subscriptions, Fees, and Payment" },
  { id: "t-2-5", label: "Acceptable Use" },
  { id: "t-2-6", label: "Your Content and License to Us" },
  { id: "t-2-8", label: "Intellectual Property of the Company" },
  { id: "t-2-9", label: "Copyright Complaints" },
  { id: "t-2-10", label: "Third-Party Services and Links" },
  { id: "t-2-11", label: "Disclaimers" },
  { id: "t-2-12", label: "Limitation of Liability" },
  { id: "t-2-13", label: "Indemnification" },
  { id: "t-2-14", label: "Term and Termination" },
  { id: "t-2-14a", label: "International Use" },
  { id: "t-2-15", label: "Governing Law and Dispute Resolution" },
  { id: "t-2-15a", label: "Limitation on Claims Period" },
  { id: "t-2-16", label: "Changes to the Service and to These Terms" },
  { id: "t-2-17", label: "Miscellaneous" },
  { id: "t-2-18", label: "Contact" },
];

export function TermsAndConditionsContent() {
  return (
    <>
      <div className="mb-6" id="t-meta">
        <p>
          <strong>Updated date:</strong> 22 July 2026.
        </p>
        <p className="mt-2">
          <strong>Address:</strong> Dimostheni Severi 12, 6th floor, Flat/Office
          601, 1080, Nicosia, Cyprus.
        </p>
      </div>

      <LegalSectionCard
        icon={File01Icon}
        id="t-2-1"
        title="Acceptance of These Terms"
      >
        <p>
          These Terms and Conditions (&ldquo;Terms&rdquo;) are a binding
          agreement between you and FLUTTWINGS INVESTMENTS LIMITED
          (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;), the operator of the website pdfvault.ai and the
          services and products provided through it (together, the
          &ldquo;Service&rdquo;). By accessing or using the Service, you agree
          to be bound by these Terms and by our{" "}
          <Link href={ROUTES.LEGAL.PRIVACY}>Privacy Policy</Link>,{" "}
          <Link href={ROUTES.LEGAL.COOKIES}>Cookie Policy</Link>, Subscription
          Terms, and <Link href={ROUTES.LEGAL.REFUND}>Refund Policy</Link>, each
          of which is incorporated by reference. If you do not agree, do not use
          the Service.
        </p>
        <p className="mt-3">
          Company registered address: Dimostheni Severi 12, 6th floor,
          Flat/Office 601, 1080, Nicosia, Cyprus.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={UserCircleIcon} id="t-2-2" title="Eligibility">
        <p>
          You must be at least 18 years of age and capable of forming a binding
          contract to use the Service. By using the Service, you represent and
          warrant that you meet these requirements. If you are under 18, you may
          not use the Service.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={SecurityCheckIcon}
        id="t-2-3"
        title="Account Registration"
      >
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            You may use certain features without an account, but premium
            features require registration.
          </li>
          <li>
            You must provide accurate and complete registration information and
            keep it up to date.
          </li>
          <li>
            You are responsible for maintaining the confidentiality of your
            account credentials and for all activity that occurs under your
            account.
          </li>
          <li>
            You must notify us immediately of any unauthorized use of your
            account at{" "}
            <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={MoneyRemove02Icon}
        id="t-2-4"
        title="Subscriptions, Fees, and Payment"
      >
        <p>
          Certain features of the Service are provided on a paid subscription
          basis. Subscription plans, billing cycles, automatic renewal, free
          trials, price changes, and cancellation are governed by our
          Subscription Terms. Refunds are governed by our{" "}
          <Link href={ROUTES.LEGAL.REFUND}>Refund Policy</Link>. By purchasing a
          subscription, you authorize us and our payment processors to charge
          the applicable fees to your chosen payment method, including on a
          recurring basis until you cancel.
        </p>
        <p className="mt-3">
          Unless stated otherwise, fees are exclusive of applicable taxes, which
          will be added where required by law. We do not store full payment card
          details; payments are processed by our third-party payment processor
          [Adyen].
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Shield01Icon} id="t-2-5" title="Acceptable Use">
        <p>You agree not to:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Upload files containing illegal content, malware, or content that
            infringes third-party intellectual property or privacy rights.
          </li>
          <li>
            Use the Service to process files on behalf of others for commercial
            resale without our written consent.
          </li>
          <li>
            Attempt to reverse-engineer, scrape, or otherwise circumvent
            technical or security measures.
          </li>
          <li>
            Use automated tools to access the Service in a manner that burdens
            or disrupts our infrastructure.
          </li>
          <li>
            Upload or process content that is defamatory, obscene, or otherwise
            unlawful.
          </li>
          <li>
            Resell, sublicense, or make the Service available to third parties
            except as expressly permitted.
          </li>
        </ul>
        <p className="mt-3">
          We may suspend or terminate access for violation of this section.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={CopyrightIcon}
        id="t-2-6"
        title="Your Content and License to Us"
      >
        <p>
          You retain full ownership of all files and content you upload
          (&ldquo;User Content&rdquo;). By uploading User Content, you grant us
          a temporary, limited, non-exclusive license solely to host, process,
          and transform it as necessary to provide the Service and return
          results to you. We do not claim ownership of your content and do not
          use your files to train artificial intelligence models.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={CopyrightIcon}
        id="t-2-8"
        title="Intellectual Property of the Company"
      >
        <p>
          The Service and its content (excluding User Content) are owned by
          FLUTTWINGS INVESTMENTS LIMITED and its licensors and are protected by
          copyright, trademark, and other laws. Except as expressly permitted,
          you may not copy, modify, distribute, or create derivative works of
          any part of the Service.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={BalanceScaleIcon}
        id="t-2-9"
        title="Copyright Complaints"
      >
        <p>
          If you believe content processed or made available through the Service
          infringes your copyright, notify us at{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a> with: (a)
          identification of the copyrighted work; (b) identification of the
          allegedly infringing material; (c) your contact details; (d) a
          statement of good-faith belief that the use is unauthorized; and (e) a
          statement, under penalty of perjury, that the information is accurate
          and you are authorized to act for the owner. We will remove or disable
          access to infringing material where appropriate and may terminate
          repeat infringers.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={ArrowReloadHorizontalIcon}
        id="t-2-10"
        title="Third-Party Services and Links"
      >
        <p>
          The Service may contain links to, or integrate with, third-party
          websites and services (including payment processors [Adyen], hosting
          and email providers [GoDaddy], customer support tools [Zendesk],
          authentication [Clerk], and file conversion providers [CloudConvert]).
          We are not responsible for third-party services, and your use of them
          is governed by their own terms and privacy policies.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Alert01Icon} id="t-2-11" title="Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL
          BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT FILES WILL BE
          PRESERVED. YOU ARE RESPONSIBLE FOR MAINTAINING BACKUP COPIES OF YOUR
          FILES.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={SecurityPasswordIcon}
        id="t-2-12"
        title="Limitation of Liability"
      >
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE COMPANY SHALL NOT BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          PUNITIVE DAMAGES, INCLUDING LOSS OF DATA OR PROFITS, ARISING FROM YOUR
          USE OF THE SERVICE. OUR TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE
          AMOUNT YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM. NOTHING IN
          THESE TERMS EXCLUDES LIABILITY THAT CANNOT BE EXCLUDED UNDER
          APPLICABLE LAW.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Shield01Icon} id="t-2-13" title="Indemnification">
        <p>
          You agree to indemnify and hold harmless the Company, its officers,
          directors, employees, and agents from any claims, damages, or expenses
          (including reasonable legal fees) arising out of your use of the
          Service, your User Content, your violation of these Terms, or your
          violation of any third-party rights.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={CancelCircleIcon}
        id="t-2-14"
        title="Term and Termination"
      >
        <p>
          We may suspend or terminate your account for violation of these Terms,
          with or without notice depending on severity. You may terminate your
          account at any time via account settings or by contacting{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>. Upon
          termination, sections that by their nature survive (including Sections
          6, 8, 11, 12, 13, 15, and 17) continue to apply. Termination does not
          by itself entitle you to a refund except as set out in the{" "}
          <Link href={ROUTES.LEGAL.REFUND}>Refund Policy</Link> or required by
          law.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Delete02Icon}
        id="t-2-14a"
        title="International Use"
      >
        <p>
          The Company makes no representation that the Service is appropriate,
          accessible, or legally available for use in every jurisdiction. If you
          access the Service from outside Cyprus, you do so on your own
          initiative and are responsible for compliance with the laws applicable
          in your location, including any restrictions on the export, import, or
          use of the Service. You may not use the Service if you are located in,
          or ordinarily resident in, a country or region subject to
          comprehensive trade sanctions, or if you are a person or entity
          subject to applicable sanctions or restricted-party lists.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={BalanceScaleIcon}
        id="t-2-15"
        title="Governing Law and Dispute Resolution"
      >
        <p>These terms are governed by the laws of Cyprus.</p>
        <p className="mt-3">
          The courts of Cyprus shall have exclusive jurisdiction over all
          matters arising under these Terms.
        </p>
        <p className="mt-3">
          Any dispute shall first be addressed through good-faith negotiation:
          contact us at{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>{" "}
          describing the dispute, and the parties will attempt to resolve it
          within 60 days. Nothing in this section limits any non-waivable
          consumer rights in your country of residence.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={ArrowReloadHorizontalIcon}
        id="t-2-15a"
        title="Limitation on Claims Period"
      >
        <p>
          Regardless of any statute or law to the contrary, or any applicable
          dispute resolution process, any claim or cause of action arising from
          or relating to your use of the Service or these Terms must be filed
          within one (1) year of the date the claim or cause of action first
          arose. Failure to file within this period will result in the claim
          being permanently barred, except where applicable law requires a
          longer period, in which case the minimum period required by law shall
          apply.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={ArrowReloadHorizontalIcon}
        id="t-2-16"
        title="Changes to the Service and to These Terms"
      >
        <p>
          We may modify or discontinue features of the Service at any time. We
          may update these Terms; material changes will be notified by email or
          prominent notice on the Service at least 14 days before they take
          effect. Continued use after the effective date constitutes acceptance.
          If you do not agree to updated Terms, you must stop using the Service
          and may cancel your subscription.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={File01Icon} id="t-2-17" title="Miscellaneous">
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Entire agreement:</strong> These Terms and the incorporated
            policies are the entire agreement between you and the Company
            regarding the Service.
          </li>
          <li>
            <strong>Severability:</strong> If any provision is held
            unenforceable, the remaining provisions remain in full force.
          </li>
          <li>
            <strong>No waiver:</strong> Failure to enforce any provision is not
            a waiver of it.
          </li>
          <li>
            <strong>Assignment:</strong> You may not assign these Terms; we may
            assign them in connection with a merger, acquisition, or sale of
            assets.
          </li>
          <li>
            <strong>Force majeure:</strong> We are not liable for delay or
            failure caused by events beyond our reasonable control.
          </li>
          <li>
            <strong>Language:</strong> The English version of these Terms
            prevails over any translation.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard icon={Mail01Icon} id="t-2-18" title="Contact">
        <p>
          FLUTTWINGS INVESTMENTS LIMITED
          <br />
          Dimostheni Severi 12, 6th floor, Flat/Office 601, 1080, Nicosia,
          Cyprus.
          <br />
          Email: <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>.
        </p>
      </LegalSectionCard>
    </>
  );
}
