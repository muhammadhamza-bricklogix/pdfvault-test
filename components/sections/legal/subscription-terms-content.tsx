import type { LegalTocEntry } from "@/components/sections/legal/legal-toc";

import Link from "next/link";
import {
  AlertCircleIcon,
  CalendarSetting01Icon,
  Cancel01Icon,
  CreditCardIcon,
  Mail01Icon,
  MoneyReceive02Icon,
  ShoppingBag01Icon,
  SparklesIcon,
  Tag01Icon,
  Timer01Icon,
} from "@hugeicons/core-free-icons";

import { LegalSectionCard } from "@/components/sections/legal/legal-section-card";
import { ROUTES } from "@/lib/shared/constants/routes";

export const subscriptionTermsTocEntries: LegalTocEntry[] = [
  { id: "st-1", label: "Trial" },
  { id: "st-2", label: "Subscription and Automatic Renewal" },
  { id: "st-3", label: "Payment Method" },
  { id: "st-4", label: "Cancellation" },
  { id: "st-5", label: "Price Changes" },
  { id: "st-6", label: "Refunds" },
  { id: "st-7", label: "Failed Payments" },
  { id: "st-8", label: "Right of Withdrawal (EU, EEA and UK Residents)" },
  { id: "st-9", label: "Contact" },
];

export function SubscriptionTermsContent() {
  return (
    <>
      <div className="mb-6" id="st-meta">
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
        id="st-intro"
        title="Important"
      >
        <p>
          These Subscription Terms govern your PDFVault trial and monthly
          subscription, including automatic renewal. They form an integral
          part of our{" "}
          <Link href={ROUTES.LEGAL.TERMS}>Terms and Conditions</Link>;
          capitalised terms not defined here have the meaning given in the
          Terms and Conditions. In the event of a conflict between these
          Subscription Terms and the Terms and Conditions in relation to
          trial and subscription billing, these Subscription Terms prevail.
          Charges are also subject to our{" "}
          <Link href={ROUTES.LEGAL.REFUND}>Refund Policy</Link>.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Timer01Icon} id="st-1" title="1. Trial">
        <p>
          Certain features of the Service — including downloading a completed
          file — require a paid trial. When you start a trial, you will be
          charged <strong>US$0.99 for 7 days</strong> of full access to
          premium download and editing features. Unless you cancel before the
          end of the 7-day trial period, your trial will automatically convert
          into a recurring monthly subscription and you will be charged the
          subscription price shown at checkout. Where required by applicable
          law, we will send you a reminder before your trial converts.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={CalendarSetting01Icon}
        id="st-2"
        title="2. Subscription and Automatic Renewal"
      >
        <p>
          After your trial, your subscription renews automatically at{" "}
          <strong>US$25 per month</strong> until you cancel. Each renewal
          charges your payment method for another 30-day period. You will
          continue to have access to all subscription features for as long as
          your subscription remains active. The renewal rate will be no more
          than the rate for the immediately prior period, excluding
          promotional or discount pricing, unless we notify you of a rate
          change beforehand as described in Section 5.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={CreditCardIcon}
        id="st-3"
        title="3. Payment Method"
      >
        <p>
          Payment is charged, via our payment processor Adyen, to the payment
          method you submit at the time of purchase — both for the initial
          US$0.99 trial charge and for each subsequent US$25 monthly renewal.
          By starting a trial or subscription, you authorize us to charge the
          applicable fees to that payment method on an ongoing basis until you
          cancel. If a renewal payment fails, a retry mechanism applies as
          described in Section 7.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Cancel01Icon} id="st-4" title="4. Cancellation">
        <p>You may cancel your trial or subscription at any time:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>In your account settings, under Subscription.</li>
          <li>
            By emailing{" "}
            <a
              className="text-[var(--pv-brand-red,#f12c23)]"
              href="mailto:support@pdfvault.ai"
            >
              support@pdfvault.ai
            </a>{" "}
            before your next renewal date.
          </li>
        </ul>
        <p className="mt-3">
          Cancelling disables automatic renewal. If you cancel during your
          7-day trial, you will not be charged the monthly fee, but the
          US$0.99 trial charge is not refunded except as described in our{" "}
          <Link href={ROUTES.LEGAL.REFUND}>Refund Policy</Link> or where
          required by law. If you cancel after conversion to a paid
          subscription, cancellation takes effect at the end of the current
          billing period: you keep access to subscription features for the
          remainder of the period you already paid for, and we do not prorate
          or refund the unused portion of that period, except as set out in
          the Refund Policy or required by law.
        </p>

        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          4.1 Content Access After Cancellation
        </p>
        <p>
          If your account is closed or your access to the Service ends, you
          may no longer be able to access Content you have stored with us.
          Where we close or suspend your account on our own initiative, we
          will try to notify you beforehand so you have a chance to download
          anything you want to keep, except where we are not permitted by
          law to give that notice. It is your responsibility to download any
          Content you wish to retain before your account is closed; Content
          still on our servers at that point may be permanently deleted.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Tag01Icon} id="st-5" title="5. Price Changes">
        <p>
          To the maximum extent permitted by applicable law, we may change
          subscription fees. We will give you reasonable advance notice of any
          pricing change by email or another prominent method before the
          change takes effect. If you do not agree to a new price, you can
          cancel before the change takes effect; continued use after the
          change takes effect constitutes acceptance of the new price.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={MoneyReceive02Icon} id="st-6" title="6. Refunds">
        <p>
          Charges made under these Subscription Terms are subject to our{" "}
          <Link href={ROUTES.LEGAL.REFUND}>Refund Policy</Link>, which
          includes a 14-day money-back guarantee on your first monthly
          subscription charge and describes the additional withdrawal rights
          available to EU, EEA, and UK residents (see also Section 8 below).
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={AlertCircleIcon}
        id="st-7"
        title="7. Failed Payments"
      >
        <p>
          If a renewal payment fails due to insufficient funds, expired card
          details, or other processing issues, we may make several attempts to
          process the renewal using the same payment method, and may suspend
          access to premium features until payment succeeds. We will notify
          you by email if this happens. If all attempts fail, your
          subscription will be automatically cancelled and access suspended
          until a valid payment method is provided.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={ShoppingBag01Icon}
        id="st-8"
        title="8. Right of Withdrawal (EU, EEA and UK Residents)"
      >
        <p>
          If you are a resident of the European Union, European Economic
          Area, or United Kingdom, you have{" "}
          <strong>14 days from the date you subscribe</strong> to withdraw
          from your contract with us, without giving any reason and without
          cost, subject to the exception below. To exercise the right of
          withdrawal, notify us of your decision by email at{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a> before
          the withdrawal period expires; it is sufficient to send your notice
          before the 14 days elapse. A model withdrawal form is included in
          the <Link href={ROUTES.LEGAL.TERMS}>Terms and Conditions</Link>.
        </p>
        <p className="mt-3">
          If you withdraw, we will reimburse all payments received from you
          without undue delay, and in any event no later than 14 days from
          the day you informed us of your decision, using the same payment
          method as the original transaction, at no extra cost to you.
        </p>
        <p className="mt-4 rounded-lg border border-[var(--pv-brand-red,#f12c23)] bg-[var(--pv-brand-red,#f12c23)]/10 p-4 text-[14px] italic">
          If you asked us to begin providing the download or service
          immediately during the withdrawal period and acknowledged that you
          would lose your right of withdrawal by doing so, then — unless the
          Service is defective — you will not be eligible for a refund of
          digital content already delivered, and will only be eligible for a
          proportional refund of any digital service used up until you
          notified us.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Mail01Icon} id="st-9" title="9. Contact">
        <p>
          FLUTTWINGS INVESTMENTS LIMITED
          <br />
          Dimostheni Severi 12, 6th floor, Flat/Office 601, 1080, Nicosia,
          Cyprus.
          <br />
          Email:{" "}
          <a
            className="text-[var(--pv-brand-red,#f12c23)]"
            href="mailto:support@pdfvault.ai"
          >
            support@pdfvault.ai
          </a>
        </p>
      </LegalSectionCard>
    </>
  );
}
