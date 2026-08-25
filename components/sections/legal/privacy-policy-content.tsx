import type { LegalTocEntry } from "@/components/sections/legal/legal-toc";

import Link from "next/link";
import {
  Clock01Icon,
  Database01Icon,
  FingerPrintCheckIcon,
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
  { id: "p-3-1", label: "Personal Data Controller" },
  { id: "p-3-2", label: "Categories of Personal Data We Collect" },
  {
    id: "p-3-3",
    label: "For What Purposes We Process Your Personal Data",
  },
  {
    id: "p-3-4",
    label: "Legal Bases for Processing (Applies Only to EEA and UK Users)",
  },
  { id: "p-3-5", label: "With Whom We Share Your Personal Data" },
  { id: "p-3-6", label: "How You Can Exercise Your Privacy Rights" },
  { id: "p-3-7", label: "Age Limitation" },
  { id: "p-3-8", label: "International Data Transfers" },
  { id: "p-3-9", label: "Changes to This Privacy Policy" },
  { id: "p-3-10", label: "US State Privacy Notice" },
  { id: "p-3-11", label: "Data Retention" },
  {
    id: "p-3-12",
    label: "How “Do Not Track” Requests Are Handled",
  },
  { id: "p-3-13", label: "Security" },
  { id: "p-3-14", label: "Contact" },
];

export function PrivacyPolicyContent() {
  return (
    <>
      <div className="mb-6" id="p-meta">
        <p>
          <strong>Updated date:</strong> 24 August 2026.
        </p>
        <p className="mt-2">
          <strong>Address:</strong> Dimostheni Severi 12, 6th floor, Flat/Office
          601, 1080, Nicosia, Cyprus.
        </p>
      </div>

      <LegalSectionCard
        icon={SparklesIcon}
        id="p-intro"
        title="Important Privacy Information"
      >
        <p>
          To use our Service, we ask you to create an account by providing your
          email. When you access our website, we automatically collect cookies
          from your device, language settings, time zone, device type,
          operating system, and information about your interactions with the
          website. We use this data to provide our Service, analyse how
          customers use the website, and serve and measure ads.
        </p>
        <p className="mt-3">
          This Privacy Policy explains what personal data is collected when you
          use the website located at pdfvault.ai (the &ldquo;Website&rdquo;),
          and the services and products provided through it (together with the
          Website, the &ldquo;Service&rdquo;), and how such personal data is
          processed.
        </p>
        <p className="mt-3 font-semibold uppercase">
          By using the Service, you confirm that (i) you have read, understand,
          and agree to this Privacy Policy, and (ii) you are at least 18 years
          of age, or are using the Service with the involvement and approval of
          a parent or legal guardian as described in our Terms and Conditions.
        </p>
        <p className="mt-3">
          If you do not meet this requirement, or are unable to make this
          confirmation, you must not use the Service — contact us to request
          deletion of your data, stop using the Website, and cancel any active
          subscriptions or trials.
        </p>
        <p className="mt-3">
          Any translation from the English version is provided for convenience
          only. In the event of any difference in meaning between the
          English-language version of this Privacy Policy and a translation,
          the English-language version prevails.
        </p>
        <p className="mt-3">
          &ldquo;GDPR&rdquo; means the General Data Protection Regulation (EU)
          2016/679. &ldquo;EEA&rdquo; includes all current EU and European Free
          Trade Association member states, and for the purposes of this Policy
          also includes the United Kingdom. &ldquo;Process,&rdquo; in respect
          of personal data, includes to collect, store, and disclose to others.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={UserCircleIcon}
        id="p-3-1"
        title="Personal Data Controller"
      >
        <p>
          FLUTTWINGS INVESTMENTS LIMITED, a company registered under the laws
          of the Republic of Cyprus, having its registered office at Dimostheni
          Severi 12, 6th floor, Flat/Office 601, 1080, Nicosia, Cyprus, is the
          controller of your personal data.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Database01Icon}
        id="p-3-2"
        title="Categories of Personal Data We Collect"
      >
        <p>
          We collect data you give us voluntarily (for example, your email
          address) and data we collect automatically (for example, cookies and
          technical information about your device).
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          2.1 Data we receive directly from you
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Identifiers:</strong> your name and email address when you
            create an account, make a purchase, or contact us.
          </li>
          <li>
            <strong>Account Data:</strong> your login information (email and
            password hash) and user ID.
          </li>
          <li>
            <strong>Purchase Data:</strong> billing data you provide to our
            payment processor, Adyen. We do not collect or store full card
            numbers, though we may receive limited data such as a secure
            payment token, transaction amount, date, and time.
          </li>
          <li>
            <strong>Content:</strong> files and documents you upload to deliver
            the feature you request. Content is not retained beyond the
            processing session unless you explicitly save it to your account.
          </li>
          <li>
            <strong>Signing and validation metadata:</strong> when you use
            signing or validation features, technical metadata such as your IP
            address and a timestamp may be recorded in the document&rsquo;s
            audit record (see Section 3.1).
          </li>
          <li>
            <strong>Feedback/Communications:</strong> your email and other
            information provided through customer support and other
            communications.
          </li>
        </ul>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          2.2 Data we collect automatically
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Log data:</strong> IP address, browser type, pages visited,
            timestamps, referring URLs.
          </li>
          <li>
            <strong>Device information:</strong> operating system, screen
            resolution, language settings.
          </li>
          <li>
            <strong>Usage data:</strong> features used, file types processed
            (not file contents), session duration.
          </li>
          <li>
            Advertising identifiers, where applicable to your device, in
            connection with the advertising described in Section 3.6 below.
          </li>
          <li>
            Cookies and similar tracking technologies (see our{" "}
            <Link href={ROUTES.LEGAL.COOKIES}>Cookie Policy</Link>).
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Settings01Icon}
        id="p-3-3"
        title="For What Purposes We Process Your Personal Data"
      >
        <p className="font-semibold text-[var(--legal-burgundy)]">
          3.1 To provide our Service
        </p>
        <p>
          This includes enabling you to use the Service&rsquo;s functions,
          storing content you choose to save to your account, and preventing or
          addressing technical issues. Where you use signing or validation
          features, technical metadata — including your IP address and a
          timestamp — may be recorded in the document&rsquo;s audit record to
          support the authenticity and verification of the signed or validated
          document; this audit record forms part of the document and will be
          visible to anyone you share the document with.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.2 To provide customer support
        </p>
        <p>
          We process your data to respond to support requests, using Zendesk as
          our ticketing system, and Clerk to manage account authentication.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.3 To communicate with you regarding your use of the Service
        </p>
        <p>
          We may email you about the performance of the Service, security, or
          payment transactions. We use Customer.io to manage transactional and
          lifecycle email communications.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.4 To research and analyse use of the Service
        </p>
        <p>
          We use Google Analytics to understand how customers use the Service,
          and Sentry to monitor and diagnose technical errors. This helps us
          maintain, improve, and develop the Service.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.5 To send marketing communications
        </p>
        <p>
          Where you have consented, we process your data to send marketing
          communications about our products, such as special offers or new
          features. We use Customer.io to deliver these communications. You may
          unsubscribe at any time via the link in the footer of marketing
          emails.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.6 To personalise our ads
        </p>
        <p>
          We advertise PDFVault through Google Ads to reach potential
          customers. In connection with this, Google advertising cookies and
          pixels on the Website collect technical information, including
          advertising and click identifiers, to measure the performance of our
          campaigns (conversion tracking) and, where enabled, to build
          audiences for remarketing. Details of the specific cookies used are
          set out in our{" "}
          <Link href={ROUTES.LEGAL.COOKIES}>Cookie Policy</Link>.
        </p>
        <p className="mt-3">
          <strong>
            How to opt out or influence personalized advertising.
          </strong>{" "}
          Google allows its users to opt out of Google&rsquo;s personalized ads
          and to prevent their data from being used by Google Analytics via
          Google&rsquo;s Ads Settings. You may also opt out of interest-based
          advertising generally through the Digital Advertising Alliance (
          <a
            href="https://optout.aboutads.info/"
            rel="noopener noreferrer"
            target="_blank"
          >
            https://optout.aboutads.info/
          </a>
          ) and the Network Advertising Initiative (
          <a
            href="https://optout.networkadvertising.org/"
            rel="noopener noreferrer"
            target="_blank"
          >
            https://optout.networkadvertising.org/
          </a>
          ).
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.7 To process your payments
        </p>
        <p>
          We use Adyen to process payments. We do not store or collect full
          payment card details ourselves; this information is provided directly
          to Adyen.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.8 To enforce our Terms and to prevent and combat fraud
        </p>
        <p>
          We use personal data to enforce our agreements and to detect,
          prevent, and combat fraud, which may involve sharing information with
          law enforcement in connection with a dispute.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.9 To comply with legal obligations
        </p>
        <p>
          We may process, use, or share your data where the law requires it,
          including in response to legal requests from law enforcement or
          regulatory authorities.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={JudgeIcon}
        id="p-3-4"
        title="Legal Bases for Processing (Applies Only to EEA and UK Users)"
      >
        <p>We process your personal data under the following legal bases:</p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          4.1 Performance of a contract
        </p>
        <p>
          To provide the Service, provide customer support, communicate with
          you about your use of the Service, and process your payments.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          4.2 Legitimate interests
        </p>
        <p>
          To communicate with you about your use of the Service, to research
          and improve the Service, to enforce our Terms and prevent fraud, and
          in connection with a merger, acquisition, or legal claim. Where we
          rely on legitimate interests, you may object to this processing at
          any time (see Section 6).
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          4.3 Consent
        </p>
        <p>
          For marketing communications and personalized advertising, including
          cookies and similar tracking technologies. You may withdraw consent
          at any time via our cookie preferences or by contacting us.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          4.4 Legal obligation
        </p>
        <p>
          To comply with legal obligations, including responding to lawful
          requests from government or law enforcement authorities.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Share01Icon}
        id="p-3-5"
        title="With Whom We Share Your Personal Data"
      >
        <p className="font-semibold text-[var(--legal-burgundy)]">
          5.1 Service providers
        </p>
        <p>
          We share personal data with third parties that provide services on
          our behalf, based on our instructions, including:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Authentication:</strong> Clerk, Google (Google Auth).
          </li>
          <li>
            <strong>Payment processing:</strong> Adyen.
          </li>
          <li>
            <strong>Hosting and infrastructure:</strong> Amazon Web Services
            (AWS), including CloudFront (content delivery) and Route 53 (DNS).
          </li>
          <li>
            <strong>Customer support:</strong> Zendesk.
          </li>
          <li>
            <strong>Error monitoring:</strong> Sentry.
          </li>
          <li>
            <strong>Translation/localization:</strong> Weglot.
          </li>
          <li>
            <strong>Reviews:</strong> Trustpilot.
          </li>
          <li>
            <strong>Email and lifecycle marketing:</strong> Customer.io.
          </li>
          <li>
            <strong>Analytics:</strong> Google Analytics.
          </li>
          <li>
            <strong>Advertising:</strong> Google Ads.
          </li>
          <li>
            <strong>File conversion:</strong> CloudConvert.
          </li>
        </ul>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.2 Law enforcement and public authorities
        </p>
        <p>
          We may disclose personal data to enforce our Terms, protect our
          rights or the rights of others, and to respond to lawful requests
          from courts, law enforcement, or regulatory authorities.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.3 Merger or acquisition
        </p>
        <p>
          If we are involved in a merger, acquisition, divestiture, or asset
          sale, customer information is typically one of the transferred
          assets, with notice to you.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.4 Affiliates
        </p>
        <p>
          We may share your personal information with companies that are part
          of our corporate group, who will handle it consistently with this
          Privacy Policy.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={StarAward01Icon}
        id="p-3-6"
        title="How You Can Exercise Your Privacy Rights"
      >
        <p>
          You have the right to: access, review, or correct your personal data;
          request erasure of your personal data, subject to legal retention
          requirements; and object to or restrict our use of your personal
          data.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          6.1 Additional rights for EEA and UK-based users
        </p>
        <p>
          You have the right to lodge a complaint with your local data
          protection supervisory authority, and the right to receive your
          personal data in a machine-readable format (data portability).
        </p>
        <p className="mt-3">
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:dpo@pdfvault.ai">dpo@pdfvault.ai</a>. We will respond
          within the timeframe required by applicable law (one month under the
          GDPR / UK GDPR; up to 45 days under certain US state laws).
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={UserCircleIcon}
        id="p-3-7"
        title="Age Limitation"
      >
        <p>
          The Service is intended for use by individuals aged 18 and older. If
          you are under 18, you may only use the Service with the involvement
          and approval of a parent or legal guardian, as described in our{" "}
          <Link href={ROUTES.LEGAL.TERMS}>Terms and Conditions</Link>. We do
          not knowingly collect personal information directly from a minor
          without appropriate parental or guardian involvement. If you believe
          we have collected personal information from a minor without
          appropriate parental or guardian involvement, contact us immediately
          at <a href="mailto:dpo@pdfvault.ai">dpo@pdfvault.ai</a> and we will
          take appropriate action, which may include deleting that information.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Globe02Icon}
        id="p-3-8"
        title="International Data Transfers"
      >
        <p>
          We may transfer personal data to countries other than the one in
          which it was originally collected, in order to provide the Service.
          Where we transfer personal data originating from the EEA or UK to
          countries without an adequate level of data protection, we rely on
          the European Commission&rsquo;s Standard Contractual Clauses and the
          UK International Data Transfer Addendum, as applicable.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Globe02Icon}
        id="p-3-9"
        title="Changes to This Privacy Policy"
      >
        <p>
          We may update this Privacy Policy periodically. Material changes will
          be announced by email or prominent notice on the Service before they
          take effect. The &ldquo;Updated date&rdquo; above shows when this
          Policy was last revised.
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
          and others). In the preceding 12 months, we have collected the
          categories of personal information described in Section 2
          (identifiers, commercial information, and internet activity
          information) for the purposes described in Section 3, and shared
          them with the categories of recipients described in Section 5.
        </p>
        <p className="mt-3">
          You may have the right to: know and access the personal information
          we hold about you; delete it; correct it; receive it in a portable
          format; opt out of &ldquo;sales,&rdquo; &ldquo;sharing,&rdquo; and
          targeted advertising; limit use of sensitive personal information;
          and not be discriminated against for exercising these rights. We
          honor Global Privacy Control (GPC) signals as an opt-out of
          sale/sharing where required. To exercise any right, or to appeal a
          decision, email{" "}
          <a href="mailto:dpo@pdfvault.ai">dpo@pdfvault.ai</a>. Authorized
          agents may submit requests with proof of authorization.
        </p>
        <p className="mt-3">
          Privacy laws in some US states define &ldquo;sale&rdquo; broadly
          enough to include sharing via cookies or similar tracking
          technologies for certain advertising activities, including the Google
          Ads integration described in Section 3.6. We do not sell personal
          information for monetary compensation; however, this cookie-based
          advertising activity may qualify as a &ldquo;sale&rdquo; or
          &ldquo;share&rdquo; under such laws even without payment, and the
          opt-out rights above apply to it.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Clock01Icon} id="p-3-11" title="Data Retention">
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Account data:</strong> retained while your account is
            active.
          </li>
          <li>
            <strong>Uploaded files:</strong> not retained beyond the processing
            session unless saved to your account.
          </li>
          <li>
            <strong>Payment records:</strong> retained as required by financial
            and tax regulations.
          </li>
          <li>
            <strong>Log data:</strong> retained for up to 90 days.
          </li>
        </ul>
        <p className="mt-3">
          We will store personal data for as long as reasonably necessary to
          fulfil the purposes in this Policy, including complying with legal
          obligations and enforcing our agreements. You may request deletion
          of your account and associated data at any time (see Section 6).
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={FingerPrintCheckIcon}
        id="p-3-12"
        title={"How “Do Not Track” Requests Are Handled"}
      >
        <p>
          Some browsers offer a &ldquo;Do Not Track&rdquo; (DNT) signal. There
          is currently no accepted industry standard for how websites should
          respond to DNT signals, and we do not currently respond to them. We
          do, however, honor Global Privacy Control (GPC) signals as described
          in Section 10 above.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={SecurityPasswordIcon}
        id="p-3-13"
        title="Security"
      >
        <p>
          We implement industry-standard security measures, including TLS
          encryption in transit, encryption at rest, hashed passwords, access
          controls, and regular security reviews. No system is completely
          secure; we cannot guarantee absolute security. If a personal data
          breach occurs, we will notify affected users and regulators where
          required by law.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Mail01Icon} id="p-3-14" title="Contact">
        <p>
          FLUTTWINGS INVESTMENTS LIMITED
          <br />
          Dimostheni Severi 12, 6th floor, Flat/Office 601, 1080, Nicosia,
          Cyprus.
          <br />
          Email: <a href="mailto:dpo@pdfvault.ai">dpo@pdfvault.ai</a>
        </p>
      </LegalSectionCard>
    </>
  );
}
