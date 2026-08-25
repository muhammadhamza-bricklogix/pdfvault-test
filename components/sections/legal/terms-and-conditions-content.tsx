import type { LegalTocEntry } from "@/components/sections/legal/legal-toc";

import Link from "next/link";
import {
  Alert01Icon,
  ArrowReloadHorizontalIcon,
  BalanceScaleIcon,
  CancelCircleIcon,
  File01Icon,
  Globe02Icon,
  JudgeIcon,
  Mail01Icon,
  MoneyRemove02Icon,
  SecurityCheckIcon,
  SecurityPasswordIcon,
  Shield01Icon,
  SparklesIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";

import { LegalSectionCard } from "@/components/sections/legal/legal-section-card";
import { ROUTES } from "@/lib/shared/constants/routes";

export const termsTocEntries: LegalTocEntry[] = [
  { id: "t-2-1", label: "Acceptance of Terms" },
  { id: "t-2-2", label: "Account Registration" },
  { id: "t-2-3", label: "Use of the Service" },
  {
    id: "t-2-4",
    label: "Third-Party Services, Materials, and Advertising",
  },
  { id: "t-2-5", label: "Subscription Fees and Payment" },
  { id: "t-2-6", label: "User Representation and Restrictions" },
  { id: "t-2-7", label: "Disclaimer of Warranties" },
  { id: "t-2-8", label: "Limitation of Liability" },
  { id: "t-2-9", label: "Indemnification" },
  { id: "t-2-10", label: "International Use" },
  {
    id: "t-2-11",
    label: "Informal Dispute Resolution Procedures and Arbitration",
  },
  {
    id: "t-2-12",
    label: "Opting Out of This Arbitration Agreement",
  },
  { id: "t-2-13", label: "Governing Law" },
  { id: "t-2-14", label: "Limitation on Claims Period" },
  { id: "t-2-15", label: "Miscellaneous Provisions" },
  { id: "t-2-16", label: "Contact" },
];

export function TermsAndConditionsContent() {
  return (
    <>
      <div className="mb-6" id="t-meta">
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
        id="t-intro-renewal"
        title="Important Notice Regarding Automatic Renewals"
      >
        <p>
          This Service includes subscriptions that automatically renew. Please
          read these Terms carefully (in particular, Section 5) before
          starting a trial or completing a purchase. To avoid being charged,
          you must cancel your subscription before the end of your trial or
          current billing cycle. By purchasing a subscription that
          automatically renews, you agree to its auto-renewing nature and
          acknowledge that you must affirmatively cancel to avoid future
          charges. If you do not cancel in time, your subscription will
          automatically renew, and the applicable charges will apply. More
          detail is in Section 5 below.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={JudgeIcon}
        id="t-intro-arbitration"
        title="Binding Arbitration & Dispute Resolution"
      >
        <p>
          Section 11 of these Terms governs how disputes between you and the
          Company are resolved and includes a binding arbitration agreement,
          seated in Nicosia, Cyprus: you agree to resolve disputes through
          final and binding arbitration rather than in court, except for
          certain limited exceptions, and you waive your right to file or
          participate in a class action lawsuit against us. You may opt out
          of the arbitration agreement as described in Section 12. Please
          read Section 11 carefully, as it affects your legal rights.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={File01Icon}
        id="t-2-1"
        title="1. Acceptance of Terms"
      >
        <p>
          These Terms and Conditions (&ldquo;Terms&rdquo;) govern the
          relationship between you and FLUTTWINGS INVESTMENTS LIMITED, a
          company incorporated under the laws of Cyprus, with its registered
          address at Dimostheni Severi 12, 6th floor, Flat/Office 601, 1080,
          Nicosia, Cyprus (&ldquo;we,&rdquo; &ldquo;us,&rdquo;
          &ldquo;our,&rdquo; or the &ldquo;Company&rdquo;), regarding your use
          of the Company&rsquo;s website pdfvault.ai and related services (the
          &ldquo;Service&rdquo;), including all information, text, graphics,
          software, and services available for your use (the
          &ldquo;Content&rdquo;). By accessing or using any part of the
          Service, you acknowledge that you have read, understood, and agree
          to be bound by these Terms, forming a legally binding agreement
          between you and the Company. If you do not agree to these Terms, you
          must immediately stop using the Service, delete your account, and
          cancel any active subscriptions.
        </p>
        <p className="mt-3">
          These Terms were originally drafted in English. If there is any
          conflict between the English-language version of these Terms and a
          version translated into another language, the English-language
          version will prevail.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          1.1 Additional Terms and Policies
        </p>
        <p>
          Our <Link href={ROUTES.LEGAL.PRIVACY}>Privacy Policy</Link>, our
          Subscription Terms, and our{" "}
          <Link href={ROUTES.LEGAL.REFUND}>Refund Policy</Link> form an
          integral part of these Terms. The Privacy Policy describes how we
          collect, use, and protect your personal data; the Subscription Terms
          set out trial and subscription pricing, billing, and cancellation;
          and the Refund Policy describes when refunds are available. We may
          also post additional policies, supplemental terms, or notices on
          the Service from time to time. Such terms are incorporated by
          reference and apply to your use of the Service.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          1.2 Changes to these Terms
        </p>
        <p>
          We may update, modify, or remove portions of these Terms at our
          discretion, to the extent permitted by applicable law; for example,
          when we introduce or discontinue features, to comply with legal or
          regulatory requirements, or in response to unforeseen circumstances.
          Where required by law, we will notify you of such changes. Unless
          stated otherwise, updates take effect once posted, indicated by the
          &ldquo;Updated date&rdquo; above. Continued use after that date
          constitutes acceptance. If you do not agree, you must stop using
          the Service, delete your account, and cancel your subscription.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          1.3 Changes to the Service
        </p>
        <p>
          We may update, change, suspend, or discontinue the Service (or any
          part, content, or feature) at any time, without notice and without
          liability; for example, to test new features, improve or further
          develop the Service, comply with legal requirements, or respond to
          unforeseen circumstances. Some features may not be available in all
          countries, languages, or operating systems.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={SecurityCheckIcon}
        id="t-2-2"
        title="2. Account Registration"
      >
        <p className="font-semibold text-[var(--legal-burgundy)]">
          2.1 Creating an Account
        </p>
        <p>
          To access certain features of the Service, you may be required to
          register an account (&ldquo;Account&rdquo;) and provide accurate and
          complete information during registration.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          2.2 Your Responsibilities
        </p>
        <p>
          By creating an Account, you represent and warrant that: (1) the
          information you provide is truthful, accurate, and up to date; (2)
          you will update your Account information as needed; and (3) your use
          of the Service complies with all applicable laws and these Terms.
          Failure to maintain accurate information may impact the
          functionality of the Service and our ability to notify you of
          important updates.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          2.3 Age Restriction
        </p>
        <p>
          The Service is intended for users aged 18 and older. By creating an
          Account, you confirm that you are at least 18 years old and have the
          legal authority to enter into and comply with these Terms. If you
          are under the age of 18, you may only access or use the Service
          with the involvement, supervision, and approval of a parent or
          legal guardian who is at least 18 years old. By permitting a minor
          to use the Service, the parent or legal guardian agrees to these
          Terms on the minor&rsquo;s behalf and accepts responsibility for the
          minor&rsquo;s use of the Service.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          2.4 Account Suspension or Termination
        </p>
        <p>
          We may suspend or terminate your Account and restrict your access to
          the Service at our discretion, with or without prior notice, if we
          determine you have violated these Terms or any applicable law,
          including providing false or misleading information or engaging in
          fraudulent or unauthorized activity. Termination may result in loss
          of access to your data or content, and we are not responsible for
          any consequences resulting from such actions.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          2.5 Account Security
        </p>
        <p>
          You are responsible for maintaining the confidentiality of your
          Account credentials and for all activity conducted under your
          Account. If you suspect unauthorized access or a security breach,
          notify us immediately at{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>. We
          are not liable for any loss or damage resulting from your failure
          to protect your credentials.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Shield01Icon}
        id="t-2-3"
        title="3. Use of the Service"
      >
        <p className="font-semibold text-[var(--legal-burgundy)]">
          3.1 Service Description
        </p>
        <p>
          The Service provides a browser-based platform for working with PDF
          documents; including editing, signing, merging, splitting,
          compressing, and converting files between formats such as Word,
          Excel, PowerPoint, JPG, and PNG. The Company may update, modify, or
          discontinue specific tools or features from time to time to
          maintain technical reliability, comply with applicable law, and
          improve user experience.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.2 Ownership and Intellectual Property
        </p>
        <p>
          The Service, including its software, content, logos, trademarks,
          and associated materials, remains the exclusive property of the
          Company or its licensors. Accessing or using the Service does not
          grant you ownership of any intellectual property beyond what is
          explicitly stated in these Terms. You may not copy, modify,
          distribute, sell, or reverse-engineer any portion of the Service
          unless expressly permitted.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.3 License to Use the Service
        </p>
        <p>
          You are granted a limited, non-exclusive, non-transferable,
          revocable license to access and use the Service for personal or
          your own internal business purposes. This license does not permit
          sublicensing, resale, modification, or unauthorised use. Any breach
          of these Terms may result in immediate suspension or termination of
          your access.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.4 Content Ownership
        </p>
        <p>
          As between you and the Company, you retain all rights and ownership
          of your Content. We do not claim ownership of your Content and do
          not use your files to train artificial intelligence models.
          &ldquo;Content&rdquo; means any text, document, image, or file that
          you upload, import into, or create using the Service. You are
          solely responsible for ensuring your use of the Service in relation
          to your Content complies with applicable law and third-party rights,
          including features that remove password or access restrictions from
          files you upload — you may only use such features on Content you
          own or are legally authorized to modify. We do not permit
          unauthorized decryption or alteration of third-party files, and
          disclaim all liability arising from misuse of such features.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.5 License to Operate the Service on Your Behalf
        </p>
        <p>
          Solely to operate the Service on your behalf, you grant us a
          non-exclusive, worldwide, royalty-free license to reproduce, store,
          and process your Content as necessary to provide the
          Service&rsquo;s functionality, including hosting, displaying, and
          enabling you to edit your Content.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.6 Content Access After Termination
        </p>
        <p>
          Once your subscription or account is terminated, your Content may
          become inaccessible. We will make reasonable efforts to give you
          advance notice before suspending or closing your account (unless
          legally prohibited), so you have a chance to retrieve your Content.
        </p>
        <p className="mt-3 font-semibold uppercase">
          You acknowledge that if you do not download your Content prior to
          termination of your account, your Content may be deleted
          permanently.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.7 Sensitive Personal Information
        </p>
        <p>
          You agree not to transmit or disclose any Sensitive Personal
          Information using the Service. You shall not process through or
          upload to the Service any documents or files containing Sensitive
          Personal Information. &ldquo;Sensitive Personal Information&rdquo;
          means an individual&rsquo;s financial information, data concerning
          sexual behavior or orientation, medical or health information,
          biometric data, personal information of children protected under
          applicable child data protection laws, and any similar category
          defined under applicable data protection or privacy law.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.8 Service Availability and Modifications
        </p>
        <p>
          We may modify, suspend, or discontinue any aspect of the Service at
          any time without liability. Certain features may not be available
          in all regions or on all devices. If a modification affects your
          use of the Service, you may cancel your subscription or delete your
          account. Please use an up-to-date web browser to help prevent
          security issues and ensure all features work correctly.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.9 User Reviews and Testimonials
        </p>
        <p>
          By submitting, posting, or otherwise providing any review, rating,
          comment, or testimonial (&ldquo;Review&rdquo;) about the Service on
          any platform, you grant the Company a non-exclusive, worldwide,
          perpetual, irrevocable, royalty-free, sublicensable, and
          transferable right to use, reproduce, modify, publish, translate,
          distribute, and create derivative works from such Reviews for any
          lawful purpose, including marketing and product development,
          without further notice, attribution, or compensation. The Company
          is not obligated to use or maintain any Review and may remove or
          edit Reviews at its discretion and is not responsible for the
          content of Reviews or the opinions expressed in them. To request
          removal of a Review you submitted, contact{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          3.10 Customer Support
        </p>
        <p>
          Customer support is provided at the Company&rsquo;s discretion.
          While we aim to assist users, there is no obligation to provide
          support or respond to inquiries. Contact{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>, and
          we will respond as soon as reasonably possible. We expect all users
          to interact with our support team respectfully; abusive,
          threatening, or harassing communication may result in immediate
          account termination.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={ArrowReloadHorizontalIcon}
        id="t-2-4"
        title="4. Third-Party Services, Materials, and Advertising"
      >
        <p>
          The Service may integrate, provide access to, or display content
          from third-party services, websites, or materials
          (&ldquo;Third-Party Services&rdquo; and &ldquo;Third-Party
          Materials&rdquo;), including payment processors, hosting providers,
          customer support tools, file conversion providers, and advertising
          networks such as Google Ads. The Company does not control or assume
          responsibility for the content, functionality, or policies of any
          Third-Party Services.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          4.1 No Endorsement or Responsibility
        </p>
        <p>
          The Company does not endorse, verify, or assume responsibility for
          the accuracy, legality, or reliability of any Third-Party Services
          or Materials. Any interactions or transactions you have with third
          parties through the Service are solely between you and that third
          party.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          4.2 Third-Party Links and Advertising
        </p>
        <p>
          The Service may include advertisements, sponsored content, or links
          to third-party websites not owned or controlled by the Company.
          Clicking on third-party links does not establish any endorsement or
          affiliation between the Company and the third party. It is your
          responsibility to review the terms and privacy practices of
          third-party services before using them.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          4.3 Use of Third-Party Services at Your Own Risk
        </p>
        <p>
          Accessing Third-Party Services through the Service is voluntary and
          at your own risk, including potential exposure to malware,
          phishing, or deceptive practices. The Company is not responsible
          for any disputes, losses, or damages arising from your engagement
          with Third-Party Services.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={MoneyRemove02Icon}
        id="t-2-5"
        title="5. Subscription Fees and Payment"
      >
        <p className="font-semibold text-[var(--legal-burgundy)]">
          5.1 Subscription Options and Purchases
        </p>
        <p>
          The Service offers subscription-based access to its features,
          purchasable through the website. Applicable fees, billing terms,
          and durations will be displayed at checkout before payment
          authorization. Pricing may vary by region, plan, and subscription
          duration. Some limited features may be available free of charge;
          full access requires a paid subscription.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.2 Purchases and Payment Processing
        </p>
        <p>
          By selecting a subscription and authorising payment, you instruct
          our payment processor, Adyen, to charge your selected payment
          method. Once payment is validated, you will receive access to the
          Service. You consent to the use of a payment retry mechanism in
          connection with subscription renewals: if a renewal payment fails
          due to insufficient funds, expired card details, or other
          processing issues, we may make several attempts to process the
          renewal using the same payment method. If all attempts fail, your
          subscription will be automatically cancelled and access suspended
          until a valid payment method is provided.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.3 Credits
        </p>
        <p>
          The Service may employ a credit-based system to enable access to
          certain features or actions. Credits are a virtual unit of access
          and do not represent currency or any financial instrument; they can
          only be used within the Service and have no monetary value outside
          of it. Credits are not your property and may not be sold,
          transferred, or exchanged. Any promotional or bonus credits
          granted are non-transferable and non-refundable.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.4 Auto-Renewal and Subscription Continuity
        </p>
        <p>
          All subscriptions automatically renew unless cancelled. The renewal
          period matches the initial subscription term unless otherwise
          disclosed at purchase. To avoid renewal, you must cancel before the
          renewal date. By purchasing a subscription, you acknowledge and
          agree that you are entering into a recurring subscription for the
          Service and that charges will be applied periodically based on the
          selected billing cycle. The renewal rate will be no more than the
          rate for the immediately prior period, excluding promotional or
          discount pricing, unless we notify you of a rate change beforehand.
          Cancellation must be completed through account settings or by
          contacting{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>;
          cancellation takes effect at the end of the current billing period,
          and you retain access to paid features until then.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.5 Add-On Items and Additional Services
        </p>
        <p>
          You may have the option to purchase add-on items or supplementary
          features, as one-time or recurring charges. Cancelling your main
          subscription also cancels any associated recurring add-ons;
          cancelling an add-on alone does not affect your primary
          subscription.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.6 Refunds
        </p>
        <p>
          You acknowledge and agree that purchases are generally
          non-refundable, except that we will provide refunds to the extent
          required by mandatory provisions of applicable law and as set out
          in our published{" "}
          <Link href={ROUTES.LEGAL.REFUND}>Refund Policy</Link>, which
          includes a 14-day money-back guarantee on qualifying first
          payments.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.7 Right of Withdrawal for EU and UK Residents
        </p>
        <p>
          If you are a resident of the European Union or the United Kingdom,
          you have the legal right to withdraw from a contract for the
          purchase of digital content or digital services within 14 days of
          your purchase, without providing any reason. To exercise this
          right, notify us by email at{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>{" "}
          stating your decision to withdraw. You may use the model
          withdrawal form below, though it is not mandatory.
        </p>
        <p className="mt-3">
          If you exercise your right of withdrawal, we will refund all
          payments received from you without undue delay, and in any event
          no later than 14 days from the date we receive your withdrawal
          notice, using the same payment method as the original transaction,
          at no extra cost to you.
        </p>
        <p className="mt-3">
          If you have expressly consented to immediate supply of the Service
          before the withdrawal period expires and acknowledged that you will
          lose your right to withdraw, you will not be eligible for a refund
          for any digital content already delivered. For digital services,
          you may be eligible for a proportional refund based on the portion
          of the Service provided before your withdrawal request. Full detail
          is set out in our <Link href={ROUTES.LEGAL.REFUND}>Refund Policy</Link>.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.8 Model Withdrawal Form
        </p>
        <div className="mt-2 rounded-lg border border-[var(--legal-border-subtle)] bg-[var(--pv-surface-subtle,#f8f8f8)] p-4 text-[14px]">
          <p>
            <strong>To:</strong> FLUTTWINGS INVESTMENTS LIMITED, email:{" "}
            <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>
          </p>
          <p className="mt-2">
            <strong>Subject:</strong> Exercise of Right of Withdrawal
          </p>
          <p className="mt-2">
            I hereby notify you of my withdrawal from the contract for the
            purchase of the following service:
          </p>
          <ul className="mt-2 list-none space-y-1">
            <li>
              <strong>Service Name:</strong> PDFVault
            </li>
            <li>
              <strong>Date of Purchase / Free Trial Start:</strong> _____
            </li>
            <li>
              <strong>Full Name:</strong> _____
            </li>
            <li>
              <strong>Email Address:</strong> _____
            </li>
            <li>
              <strong>Payment Method Used:</strong> _____
            </li>
            <li>
              <strong>Date of Request:</strong> _____
            </li>
          </ul>
          <p className="mt-2 italic">
            (Signature required if submitted by mail.)
          </p>
        </div>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.9 Chargebacks and Payment Disputes
        </p>
        <p>
          If you wish to request a refund, we encourage you to contact us
          first at{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a> before
          initiating a chargeback with your payment provider, so we can
          review and attempt to resolve your request directly. Refunds are
          not processed in real time; please allow a reasonable number of
          business days for a confirmed refund to reflect in your account.
          Initiating a chargeback against a valid charge may result in
          suspension of your account pending resolution. Fraudulent or
          improper chargebacks may result in termination of your account, a
          permanent ban, and potential legal action.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.10 Trials and Promotional Offers
        </p>
        <p>
          We may offer free or discounted trials providing temporary access
          to the Service. Trial duration and terms will be displayed at
          sign-up. If you do not cancel before the trial ends, your
          subscription automatically converts into a paid subscription and
          the applicable fee is charged. It is your responsibility to track
          the trial period and cancel if you do not wish to continue. We
          reserve the right to modify, revoke, or restrict trial or
          promotional eligibility at any time.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.11 Promotional Codes
        </p>
        <p>
          We may provide gift cards or promotional codes redeemable for
          features or services within the Service for a limited period,
          subject to eligibility. Promotional Codes have no cash value, are
          personal and non-transferable, and we are under no obligation to
          provide compensation in connection with them.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.12 Changes to Subscription Fees
        </p>
        <p>
          We may modify subscription fees at any time, to the extent
          permitted by applicable law. Where notice is required by law, we
          will provide it in the manner and timeframe mandated; otherwise,
          we will notify you by email or other prominent means before the
          change takes effect. If you do not agree to updated fees, you may
          cancel your subscription before the new pricing takes effect.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          5.13 Failure to Pay and Service Termination
        </p>
        <p>
          If a payment is declined or not received when due, we may notify
          you to update your payment method. If unresolved, we reserve the
          right to suspend or terminate your access without further notice;
          any associated content or settings may be lost, and we are not
          responsible for restoring them.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={UserCircleIcon}
        id="t-2-6"
        title="6. User Representation and Restrictions"
      >
        <p>
          By accessing or using the Service, you confirm that: you have the
          legal capacity to enter into and comply with these Terms; you are
          at least 18 years old; you will not access the Service through
          automated or non-human means; you will not use the Service for any
          unlawful or unauthorized purpose; you are not located in a country
          subject to comprehensive trade sanctions or designated as a
          terrorist-supporting nation; you are not listed on any government
          list of prohibited or restricted persons; and your use of the
          Service complies with all applicable laws.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          6.1 Prohibited Conduct
        </p>
        <p>You agree not to:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Collect, scrape, or systematically retrieve data or content from
            the Service to create a database, compilation, or directory
            without our express permission.
          </li>
          <li>
            Use the Service for any unauthorized purpose, including
            modifying, adapting, or creating derivative works from it.
          </li>
          <li>
            Use the Service for commercial or revenue-generating purposes
            unless expressly approved by us.
          </li>
          <li>
            Make the Service accessible over a network that allows multiple
            devices or users to access it simultaneously, unless permitted.
          </li>
          <li>
            Develop, launch, or use the Service to create a competing product
            or service.
          </li>
          <li>
            Circumvent, disable, or interfere with security features of the
            Service.
          </li>
          <li>Frame, embed, or link to the Service without authorization.</li>
          <li>
            Interfere with or disrupt the Service, or place undue burden on
            our infrastructure.
          </li>
          <li>
            Decompile, disassemble, reverse-engineer, or otherwise attempt to
            access the source code of the Service.
          </li>
          <li>Bypass or attempt to bypass access restrictions or security measures.</li>
          <li>
            Upload, transmit, or distribute malware, viruses, or other
            harmful software.
          </li>
          <li>
            Use or distribute any automated system (bots, spiders, scrapers)
            to access or interact with the Service.
          </li>
          <li>Send unsolicited commercial emails or engage in spam-related activity.</li>
          <li>
            Engage in any activity that may harm or damage the reputation of
            the Company or the Service.
          </li>
          <li>
            Upload files containing illegal content or content that infringes
            third-party intellectual property or privacy rights.
          </li>
          <li>
            Use the Service to process files on behalf of others for
            commercial resale without our written consent.
          </li>
          <li>
            Resell, sublicense, or make the Service available to third
            parties except as expressly permitted.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Alert01Icon}
        id="t-2-7"
        title="7. Disclaimer of Warranties"
      >
        <p className="uppercase">
          Except to the extent prohibited by law, you expressly acknowledge
          and agree that your use of the Service is at your own risk. The
          Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available,&rdquo; without warranties of any kind, express or
          implied, including warranties of merchantability, fitness for a
          particular purpose, non-infringement, accuracy, or reliability. We
          do not warrant that the Service will meet your requirements, be
          uninterrupted, secure, or error-free, or that results obtained
          will be accurate or reliable.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          7.1 No Professional Advice
        </p>
        <p className="uppercase">
          Any information or statements available through the Service are
          for general informational purposes only and do not replace
          professional financial, medical, legal, or other specialized
          advice. You are solely responsible for decisions made based on
          information provided through the Service.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          7.2 Consumer Protection and Non-Waivable Rights
        </p>
        <p>
          Nothing in these Terms excludes or limits any consumer rights that
          cannot be waived under applicable law. If you are entitled to
          statutory rights under the laws of your country of residence,
          those rights remain unaffected by these disclaimers.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={SecurityPasswordIcon}
        id="t-2-8"
        title="8. Limitation of Liability"
      >
        <p className="uppercase">
          To the maximum extent permitted by law, the Company (including its
          affiliates, officers, employees, agents, and licensors) shall not
          be liable for any indirect, incidental, consequential, exemplary,
          special, or punitive damages, including lost profits or lost data,
          arising from your use of the Service, even if advised of the
          possibility of such damages.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          8.1 Limitation of Aggregate Liability
        </p>
        <p className="uppercase">
          Our total liability to you for any claim arising out of or related
          to your use of the Service shall be limited to the total amount
          you paid to us during the twelve (12) months immediately preceding
          the event giving rise to the claim, or, if greater, one hundred
          euros (&euro;100).
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          8.2 Waiver of Unknown Claims (California Residents)
        </p>
        <p className="uppercase">
          If you are a resident of California, you expressly waive
          California Civil Code Section 1542, which states: &ldquo;A general
          release does not extend to claims that the creditor or releasing
          party does not know or suspect to exist in his or her favor at the
          time of executing the release, and that, if known by him or her,
          would have materially affected his or her settlement with the
          debtor or released party.&rdquo;
        </p>
        <p className="mt-3">
          By accepting these Terms, you recognize you may be waiving rights
          with respect to claims currently unknown or unsuspected.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          8.3 Jurisdiction-Specific Exceptions
        </p>
        <p>
          Some jurisdictions do not allow certain limitations or exclusions
          of liability. To the extent any part of these limitations is
          found unenforceable, the remaining limitations shall still apply
          to the maximum extent permitted.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Shield01Icon}
        id="t-2-9"
        title="9. Indemnification"
      >
        <p>
          You agree to defend, indemnify, and hold harmless the Company and
          its affiliates, officers, employees, agents, and licensors from
          any losses, damages, liabilities, claims, and expenses (including
          reasonable attorneys&rsquo; fees) arising from: your Content,
          including claims that it infringes third-party rights; your
          breach of these Terms; your access to or use of the Service; and
          your violation of any applicable law or third-party rights. The
          Company reserves the right to assume control of the defence of any
          claim subject to indemnification, and you agree to cooperate with
          our defence.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Globe02Icon}
        id="t-2-10"
        title="10. International Use"
      >
        <p>
          The Company makes no representation that the Service is
          accessible, appropriate, or legally available in your
          jurisdiction, and use of the Service is prohibited where doing so
          would be illegal. You access the Service at your own initiative
          and are responsible for compliance with local laws.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={BalanceScaleIcon}
        id="t-2-11"
        title="11. Informal Dispute Resolution Procedures and Arbitration"
      >
        <p className="uppercase">
          Please read this provision carefully. By agreeing to it, you are
          waiving your right to participate in a class action lawsuit and
          your right to a jury trial, and you are agreeing to resolve
          disputes through binding arbitration seated in Nicosia, Cyprus,
          unless you opt out as described in Section 12.
        </p>
        <p className="mt-3">
          You and the Company agree to resolve all Disputes through binding
          arbitration as described below, except for: (i) claims within the
          jurisdiction of a small claims court, provided they are not
          class-action disputes; and (ii) disputes related to intellectual
          property rights. A &ldquo;Dispute&rdquo; means any claim or
          controversy between you and the Company regarding the Service or
          this agreement, including disputes about the interpretation or
          enforceability of this Arbitration Agreement. Nothing in this
          Arbitration Agreement limits any non-waivable consumer rights
          available to you under the mandatory laws of your country of
          residence.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          11.1 Mandatory Pre-Filing Notice Procedure
        </p>
        <p>
          Before commencing arbitration or a small claims action, you must
          send the Company a written notice of the Dispute
          (&ldquo;Notice&rdquo;) to the address below, including your name,
          address, and email; a description of the Dispute and relevant
          facts; the relief sought, including any damages calculation; and
          a personally signed statement verifying the accuracy of the
          Notice. After Notice is received, both parties agree to engage in
          good-faith negotiation for 60 days, including at least one
          individualised video conference. If the Dispute is not resolved
          within that period, either party may commence arbitration or a
          small claims action. Compliance with this procedure is a
          condition precedent to arbitration.
        </p>
        <p className="mt-3">
          Notices should be sent to: FLUTTWINGS INVESTMENTS LIMITED,
          Dimostheni Severi 12, 6th floor, Flat/Office 601, 1080, Nicosia,
          Cyprus, Attention: Legal.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          11.2 Small Claims Court
        </p>
        <p>
          Subject to the Mandatory Pre-Filing Notice requirement, either
          party may elect to pursue an individual Dispute in a local small
          claims court instead of arbitration, so long as the matter
          remains in small claims court and proceeds only on an individual
          basis.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          11.3 Class Action and Jury Trial Waiver
        </p>
        <p className="uppercase">
          To the fullest extent allowable by law, you and the Company waive
          the right to a jury trial and to litigate disputes in court in
          favor of arbitration (except for small claims court). You and the
          Company each waive the right to file or participate in a class,
          collective, or representative action against the other. The
          arbitrator may only award relief to the individual party seeking
          it, and not on a class or representative basis.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          11.4 Arbitration Procedure
        </p>
        <p>
          The arbitration will be administered under the Arbitration Rules
          of the International Chamber of Commerce (&ldquo;ICC
          Rules&rdquo;), as modified by this Arbitration Agreement. The seat
          of arbitration shall be Nicosia, Cyprus, and the arbitration will
          be conducted in English by a single arbitrator appointed in
          accordance with the ICC Rules. Proceedings will be conducted
          primarily through written submissions or online conferencing where
          practicable, without requiring in-person appearance unless the
          arbitrator determines a hearing is necessary. The arbitrator will
          apply the laws of Cyprus and will issue a written, reasoned
          award, ordinarily within 120 days of appointment. The Company
          will pay arbitration fees that the arbitrator finds would
          otherwise be cost-prohibitive for you, absent a finding that your
          claim was frivolous or brought in bad faith. This arbitration
          provision survives termination of these Terms and of your
          account.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          11.5 Mass Arbitration Filings
        </p>
        <p>
          If ten or more similar claims are asserted against the Company by
          the same or coordinated attorneys, the parties agree to cooperate
          in good faith to adopt efficient procedures for resolving them in
          a coordinated manner (for example, proceeding with a limited
          number of representative claims first), consistent with the
          applicable rules of the administering institution, before the
          remaining claims are filed and administered individually.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={CancelCircleIcon}
        id="t-2-12"
        title="12. Opting Out of This Arbitration Agreement"
      >
        <p>
          You may opt out of this Arbitration Agreement by sending written
          notice to{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>{" "}
          within 31 days of the later of: (1) the date you first use the
          Service, or (2) the date this Arbitration Agreement became
          effective. Your notice must include your name, the email address
          associated with your account, and an unequivocal statement that
          you wish to opt out. If you opt out, all other parts of these
          Terms continue to apply. This Arbitration Agreement survives
          termination of your relationship with the Company. If any part of
          it is found unenforceable, the remainder continues to apply.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={JudgeIcon}
        id="t-2-13"
        title="13. Governing Law"
      >
        <p>
          These Terms are governed by the laws of Cyprus. The courts of
          Cyprus shall have exclusive jurisdiction over any matter not
          subject to the arbitration agreement in Section 11. Nothing in
          these Terms deprives you of the consumer protection rights
          granted by the mandatory laws of your country of residence.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          13.1 For California Residents
        </p>
        <p>
          If you are a California resident, in accordance with Cal. Civ.
          Code &sect; 1789.3, you may report complaints to the Complaint
          Assistance Unit of the Division of Consumer Services of the
          California Department of Consumer Affairs, 1625 North Market
          Blvd., Suite N 112, Sacramento, CA 95834, or by telephone at
          (800) 952-5210.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={ArrowReloadHorizontalIcon}
        id="t-2-14"
        title="14. Limitation on Claims Period"
      >
        <p>
          Regardless of any statute or law to the contrary, any claim or
          cause of action arising from or related to your use of the
          Service or these Terms must be filed within one (1) year from
          the date the claim first arose. Failure to do so will result in
          the claim being permanently barred, except where applicable law
          requires a longer period.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={File01Icon}
        id="t-2-15"
        title="15. Miscellaneous Provisions"
      >
        <p>
          No failure or delay by the Company in exercising any right under
          these Terms constitutes a waiver of that right. If any provision
          is found invalid or unenforceable, the remainder of these Terms
          remains in full force, and the invalid provision will be modified
          to the extent necessary to make it enforceable while preserving
          its intent.
        </p>
        <p className="mt-3">
          These Terms constitute the entire agreement between you and the
          Company regarding their subject matter and supersede all prior
          agreements or understandings. The Company may assign or transfer
          its rights and obligations under these Terms in connection with a
          merger, acquisition, or asset sale; by continuing to use the
          Service, you consent to such transfer.
        </p>
        <p className="mt-3">
          All communications between you and the Company may be conducted
          electronically and hold the same legal weight as written
          documents. By clicking buttons such as &ldquo;Submit,&rdquo;
          &ldquo;Continue,&rdquo; &ldquo;Register,&rdquo; or &ldquo;I
          Agree,&rdquo; you affirm your intent to be legally bound by these
          Terms.
        </p>
        <p className="mt-3">
          The Company is not liable for any failure or delay in complying
          with these Terms arising from circumstances beyond its reasonable
          control, including force majeure events, legal or regulatory
          changes, or cyberattacks.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Mail01Icon} id="t-2-16" title="16. Contact">
        <p>
          FLUTTWINGS INVESTMENTS LIMITED
          <br />
          Dimostheni Severi 12, 6th floor, Flat/Office 601, 1080, Nicosia,
          Cyprus.
          <br />
          Email: <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>
        </p>
      </LegalSectionCard>
    </>
  );
}
