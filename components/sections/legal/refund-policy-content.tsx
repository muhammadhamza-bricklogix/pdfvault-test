import type { LegalTocEntry } from "@/components/sections/legal/legal-toc";

import Link from "next/link";
import {
  Alert01Icon,
  CancelCircleIcon,
  CreditCardIcon,
  Globe02Icon,
  Mail01Icon,
  MoneyReceive02Icon,
  RefreshIcon,
  SparklesIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import { LegalSectionCard } from "@/components/sections/legal/legal-section-card";
import { ROUTES } from "@/lib/shared/constants/routes";

export const refundTocEntries: LegalTocEntry[] = [
  { id: "r-5-1", label: "Overview" },
  { id: "r-5-2", label: "14-Day Money-Back Guarantee" },
  { id: "r-5-3", label: "Renewals" },
  { id: "r-5-4", label: "Credits and Add-ons" },
  { id: "r-5-5", label: "Exceptional Circumstances" },
  { id: "r-5-6", label: "EU and UK Consumers — Right of Withdrawal" },
  { id: "r-5-7", label: "How to Request a Refund" },
  { id: "r-5-8", label: "Exclusions" },
  { id: "r-5-9", label: "Chargebacks" },
  { id: "r-5-10", label: "Contact" },
];

export function RefundPolicyContent() {
  return (
    <>
      <div className="mb-6" id="r-meta">
        <p>
          <strong>Updated date:</strong> 24 August 2026.
        </p>
        <p className="mt-2">
          <strong>Address:</strong> Dimostheni Severi 12, 6th floor, Flat/Office
          601, 1080, Nicosia, Cyprus.
        </p>
      </div>

      <LegalSectionCard icon={SparklesIcon} id="r-5-1" title="Overview">
        <p>
          This Refund Policy applies to purchases of PDFVault subscriptions,
          plans, and paid features made on pdfvault.ai (the
          &ldquo;Service&rdquo;) and forms an integral part of our{" "}
          <Link href={ROUTES.LEGAL.TERMS}>Terms and Conditions</Link> and
          Subscription Terms. Capitalised terms not defined here have the
          meaning given in the{" "}
          <Link href={ROUTES.LEGAL.TERMS}>Terms and Conditions</Link>. Nothing
          in this Policy limits or excludes any non-waivable statutory rights
          you have under the laws of your country of residence, including the
          rights described in Section 6 below.
        </p>
        <p className="mt-3">
          The version of this Policy in force on the date of a charge applies to
          that charge. We may update this Policy from time to time; material
          changes will be notified by email or prominent notice on the Service
          before they take effect.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Tick02Icon}
        id="r-5-2"
        title="14-Day Money-Back Guarantee"
      >
        <p>
          We offer a full refund, no questions asked, on your first monthly
          subscription charge, provided your refund request is received within
          14 days of the date of that charge. This includes the first monthly
          charge applied when a trial converts to a paid subscription. If we
          refund your first monthly charge under this guarantee, we will also
          refund the associated trial fee.
        </p>
        <p className="mt-3">
          The guarantee does not apply to: subscription renewal charges (your
          second monthly charge onward), which are addressed in Section 3; or
          accounts suspended or terminated for violation of the Terms and
          conditions. The guarantee applies once per customer.
        </p>
        <p className="mt-3">
          If a refund is issued under this Section, your subscription is
          cancelled and your access to paid features ends when the refund is
          processed. Any credits granted with the refunded purchase are
          cancelled at the same time.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={RefreshIcon} id="r-5-3" title="Renewals">
        <p>
          Subscriptions renew automatically as described in the{" "}
          <Link href={ROUTES.LEGAL.TERMS}>Terms and Conditions</Link> and the
          Subscription Terms, and where required by applicable law we will send
          you a reminder before a renewal charge. We do not offer automatic
          refunds for renewal charges. However, if you cancel within 48 hours of
          a renewal charge and have not made material use of paid features since
          that charge, contact us and we will consider a refund on a
          case-by-case basis.
        </p>
        <p className="mt-3">
          To avoid a renewal charge altogether, cancel before the renewal date
          via your account settings or by contacting{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>.
          Cancellation takes effect at the end of the current billing period,
          and you retain access to paid features until then; we do not prorate
          or refund the unused portion of a billing period on cancellation,
          except as set out in this Policy or required by law.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={MoneyReceive02Icon}
        id="r-5-4"
        title="Credits and Add-ons"
      >
        <p>
          Credits that have been used or consumed are non-refundable.
          Promotional or bonus credits have no monetary value and are
          non-refundable in all circumstances, as set out in the Terms and
          conditions. Unused purchased credits are refunded only where the
          purchase that included them is refunded under this Policy.
        </p>
        <p className="mt-3">
          One-time add-on purchases are refundable within 14 days of the charge
          if the add-on has not been used. Recurring add-ons are treated as
          renewals under Section 3 and are cancelled automatically when the main
          subscription is cancelled.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Alert01Icon}
        id="r-5-5"
        title="Exceptional Circumstances"
      >
        <p>
          We may issue refunds, pro-rata credits, or subscription extensions
          outside this Policy at our discretion in circumstances such as:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            A technical fault on our end that prevented you from using a paid
            feature for more than 72 consecutive hours.
          </li>
          <li>Duplicate charges caused by a billing error.</li>
          <li>
            Documented unauthorised or fraudulent charges to your payment
            method.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Globe02Icon}
        id="r-5-6"
        title="EU and UK Consumers — Right of Withdrawal"
      >
        <p>
          If you are a consumer in the European Union, European Economic Area,
          or the United Kingdom, you have a statutory right to withdraw from a
          contract for digital content or digital services within 14 days of
          purchase, without giving any reason, as described in the{" "}
          <Link href={ROUTES.LEGAL.TERMS}>Terms and Conditions</Link> (which
          include a model withdrawal form). This right applies to the trial fee
          and to subscription charges alike.
        </p>
        <p className="mt-3">
          If you expressly consented to immediate performance of the Service
          during the withdrawal period and acknowledged the consequences for
          your withdrawal right, then: for digital services, if you withdraw
          within the 14-day period, we may deduct a proportionate amount for the
          service already provided up to the time you informed us of your
          withdrawal; and for digital content that has been fully delivered, the
          right of withdrawal is lost.
        </p>
        <p className="mt-3">
          Where you validly exercise the right of withdrawal, we will refund the
          amounts due without undue delay and no later than 14 days from the
          date we receive your withdrawal notice, using the same payment method
          as the original transaction, at no cost to you.
        </p>
        <p className="mt-3">
          Our 14-Day Money-Back Guarantee in Section 2 is more generous than the
          statutory right (a full refund with no deduction) and operates in
          addition to, not instead of, your statutory rights.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Mail01Icon}
        id="r-5-7"
        title="How to Request a Refund"
      >
        <p>
          Email <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>{" "}
          with the subject line &ldquo;Refund Request,&rdquo; the email address
          associated with your account, the date and amount of the charge, and,
          optionally, your reason for the request. We may ask you to verify your
          identity or ownership of the account before processing a refund.
        </p>
        <p className="mt-3">
          Approved refunds are processed within 5&ndash;10 business days to the
          original payment method, in the original transaction currency. We are
          not responsible for exchange-rate differences or fees applied by your
          bank or card issuer, and your bank or card issuer may take additional
          time to post the credit.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={CancelCircleIcon} id="r-5-8" title="Exclusions">
        <p>
          Except where required by applicable law, refunds are not available
          for:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Charges older than the applicable refund window in this Policy.
          </li>
          <li>
            Subscription renewal charges outside the window described in Section
            3.
          </li>
          <li>
            Credits that have been used, and promotional or bonus credits.
          </li>
          <li>
            Accounts suspended or terminated for violation of the{" "}
            <Link href={ROUTES.LEGAL.TERMS}>Terms and Conditions</Link>.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard icon={CreditCardIcon} id="r-5-9" title="Chargebacks">
        <p>
          Please contact us at{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a> before
          initiating a chargeback with your bank or card provider: chargebacks
          carry significant fees and administrative burden and are usually
          slower to resolve than contacting us directly. If a chargeback is
          filed against a valid charge, we may suspend your account pending
          resolution. Fraudulent or improper chargebacks may result in
          termination of your account and, where appropriate, legal action, as
          set out in the{" "}
          <Link href={ROUTES.LEGAL.TERMS}>Terms and Conditions</Link>.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Mail01Icon} id="r-5-10" title="Contact">
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
