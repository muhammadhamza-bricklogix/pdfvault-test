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
  Tag01Icon,
  Timer01Icon,
} from "@hugeicons/core-free-icons";

import { LegalSectionCard } from "@/components/sections/legal/legal-section-card";
import { ROUTES } from "@/lib/shared/constants/routes";

export const subscriptionTermsTocEntries: LegalTocEntry[] = [
  { id: "st-1", label: "Trial" },
  { id: "st-2", label: "Subscription" },
  { id: "st-3", label: "Payment Method" },
  { id: "st-4", label: "Cancellation" },
  { id: "st-5", label: "Price Changes" },
  { id: "st-6", label: "Refunds" },
  { id: "st-7", label: "Failed Payments" },
  { id: "st-eu", label: "Note for EU, EEA & UK Residents" },
  { id: "st-support", label: "Got Questions?" },
];

export function SubscriptionTermsContent() {
  return (
    <>
      <div className="mb-6" id="st-meta">
        <p>
          <strong>Last updated:</strong> July 2026.
        </p>
        <p className="mt-2 italic text-[var(--pv-text-muted)]">
          The terms that govern your PDFVault trial and monthly subscription.
        </p>
      </div>

      <LegalSectionCard icon={Timer01Icon} id="st-1" title="1. Trial">
        <p>
          Certain features of the Service — including downloading a completed
          file — require a paid trial. When you start a trial, you will be
          charged <strong>$0.99 today for 7 days</strong> of full access to
          premium download and editing features. Unless you cancel before the
          end of the 7-day trial period, your trial will automatically convert
          into a recurring monthly subscription and you will be charged the
          subscription price shown at checkout.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={CalendarSetting01Icon}
        id="st-2"
        title="2. Subscription"
      >
        <p>
          After your trial, your subscription renews automatically at{" "}
          <strong>$25 per month</strong> until you cancel. Each renewal charges
          your payment method for another 30-day period. You will continue to
          have access to all subscription features for as long as your
          subscription remains active.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={CreditCardIcon}
        id="st-3"
        title="3. Payment Method"
      >
        <p>
          Payment is charged to the payment method you submit at the time of
          purchase, both for the initial $0.99 trial charge and for each
          subsequent $25 monthly renewal. By starting a trial or subscription,
          you authorize us to charge the applicable fees to that payment method
          on an ongoing basis until you cancel.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Cancel01Icon} id="st-4" title="4. Cancellation">
        <p>You may cancel your trial or subscription at any time:</p>
        <ul>
          <li>In your account settings, under Subscription.</li>
          <li>
            By emailing{" "}
            <a href="mailto:billing@pdfvault.ai">billing@pdfvault.ai</a> before
            your next renewal date.
          </li>
        </ul>
        <p>
          Cancelling disables automatic renewal. If you cancel during your 7-day
          trial, you will not be charged the $25 monthly fee, but the $0.99
          trial charge is not refunded except as described in our{" "}
          <Link href={ROUTES.LEGAL.REFUND}>Refund Policy</Link>. If you cancel
          after conversion to a paid subscription, you keep access to
          subscription features for the remainder of the period you already paid
          for — we do not prorate or refund the unused portion of that period.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Tag01Icon} id="st-5" title="5. Price Changes">
        <p>
          To the maximum extent permitted by applicable law, we may change
          subscription fees at any time. We will give you reasonable advance
          notice of any pricing change by posting the new price on the Service,
          sending an email notification, or another prominent method. If you do
          not agree to a new price, you can cancel before the change takes
          effect.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={MoneyReceive02Icon} id="st-6" title="6. Refunds">
        <p>
          Charges made under these Subscription Terms are subject to our{" "}
          <Link href={ROUTES.LEGAL.REFUND}>Refund Policy</Link>, including the
          additional withdrawal rights available to EU, EEA, and UK residents.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={AlertCircleIcon}
        id="st-7"
        title="7. Failed Payments"
      >
        <p>
          If a renewal payment fails, we may retry the charge and/or suspend
          access to premium features until payment succeeds. We will notify you
          by email if this happens.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={ShoppingBag01Icon}
        id="st-eu"
        title="Note for EU, EEA & UK Residents"
      >
        <p>
          If you are a resident of the European Union, European Economic Area,
          or United Kingdom, you have{" "}
          <strong>14 days from the date you subscribe</strong> to withdraw from
          your contract with us, without giving any reason and without cost,
          subject to the exception below.
        </p>
        <p>
          To exercise the right of withdrawal, notify us of your decision by
          email at <a href="mailto:billing@pdfvault.ai">billing@pdfvault.ai</a>{" "}
          before the withdrawal period expires. It is sufficient to send your
          notice before the 14 days elapse.
        </p>
        <p>
          If you withdraw, we will reimburse all payments received from you
          without undue delay, and in any event no later than 14 days from the
          day you informed us of your decision, using the same payment method as
          the original transaction, at no extra cost to you.
        </p>
        <p className="mt-4 rounded-lg border border-[var(--pv-hairline)] bg-[var(--pv-brand-red)]/5 p-4 text-[14px] italic">
          If you asked us to begin providing the download or service immediately
          during the withdrawal period and acknowledged that you would lose your
          right of withdrawal by doing so, then — unless the Service is
          defective — you will not be eligible for a refund of digital content
          already delivered, and will only be eligible for a proportional refund
          of any digital service used up until you notified us.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Mail01Icon}
        id="st-support"
        title="Got Questions?"
      >
        <p>Our support team is here to help.</p>
        <ul>
          <li>
            Email: <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>
          </li>
          <li>
            <Link href={ROUTES.LEGAL.CONTACT}>Contact Us</Link>
          </li>
        </ul>
      </LegalSectionCard>
    </>
  );
}
