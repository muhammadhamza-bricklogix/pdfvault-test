import { LegalCallout } from "@/components/sections/legal/legal-callout";
import { LegalSectionCard } from "@/components/sections/legal/legal-section-card";
import type { LegalTocEntry } from "@/components/sections/legal/legal-toc";

import {
  Alert01Icon,
  CreditCardIcon,
  Mail01Icon,
  MoneyReceive02Icon,
  RefreshIcon,
  SparklesIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

export const refundTocEntries: LegalTocEntry[] = [
  { id: "r-5-1", label: "5.1 Our Commitment" },
  { id: "r-5-2", label: "5.2 14-Day Money-Back Guarantee" },
  { id: "r-5-3", label: "5.3 Renewal Payments" },
  { id: "r-5-4", label: "5.4 Exceptional Circumstances" },
  { id: "r-5-5", label: "5.5 How to Request a Refund" },
  { id: "r-5-6", label: "5.6 Chargebacks" },
  { id: "r-5-7", label: "5.7 Lifetime Plan" },
];

export function RefundPolicyContent() {
  return (
    <>
      <LegalSectionCard icon={SparklesIcon} id="r-5-1" title="5.1 Our Commitment">
        <p>
          We want you to be satisfied with the PDF Edits App. Our refund policy
          is designed to be <strong>fair and transparent</strong>.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Tick02Icon} id="r-5-2" title="5.2 14-Day Money-Back Guarantee">
        <LegalCallout variant="success">
          <p className="font-semibold">
            Full refund, no questions asked — within 14 days of your first
            subscription payment.
          </p>
        </LegalCallout>
        <p className="mt-4">
          We offer a 14-day money-back guarantee on all first-time subscriptions
          (Monthly and Annual plans). If you are not satisfied within 14 days of
          your initial subscription payment, contact us for a full refund — no
          questions asked.
        </p>
        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          This guarantee applies to:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Your first Monthly plan payment.</li>
          <li>Your first Annual plan payment.</li>
        </ul>
        <p className="mt-4 font-semibold text-[var(--legal-burgundy)]">
          This guarantee does not apply to:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Subscription renewals (i.e., your second payment onwards).</li>
          <li>Lifetime plan purchases after 14 days.</li>
          <li>
            Cases where the account has been suspended for Terms of Service
            violations.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard icon={RefreshIcon} id="r-5-3" title="5.3 Renewal Payments">
        <p>
          For monthly and annual renewal payments, we do not offer automatic
          refunds. However, if a renewal charge occurs and you cancel within{" "}
          <strong>48 hours</strong>, contact us and we will consider a refund on
          a case-by-case basis.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Alert01Icon} id="r-5-4" title="5.4 Exceptional Circumstances">
        <p>We will issue refunds outside the standard policy at our discretion in cases such as:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            A technical fault on our end that prevented you from using a paid
            feature for more than <strong>72 hours</strong>.
          </li>
          <li>Duplicate charges due to a billing error.</li>
          <li>Documented fraudulent charges.</li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard icon={Mail01Icon} id="r-5-5" title="5.5 How to Request a Refund">
        <LegalCallout variant="emphasis">
          <p>
            Email{" "}
            <a href="mailto:support@pdfeditsapp.com">support@pdfeditsapp.com</a>{" "}
            with subject line &quot;Refund Request&quot;, your account email,
            the date and amount of the charge, and (optional) your reason.
          </p>
        </LegalCallout>
        <p className="mt-4">
          We will process approved refunds within <strong>5–10 business days</strong>
          . Refunds are returned to the original payment method.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={CreditCardIcon} id="r-5-6" title="5.6 Chargebacks">
        <p>
          We strongly encourage you to contact us before initiating a chargeback
          with your bank or card provider. Chargebacks result in significant fees
          and administrative burden. If a chargeback is filed against a valid
          charge, your account may be suspended pending resolution.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={MoneyReceive02Icon}
        id="r-5-7"
        title="5.7 Lifetime Plan"
      >
        <p>
          The Lifetime plan is refundable within 14 days of purchase. After 14
          days, all Lifetime plan purchases are final.
        </p>
      </LegalSectionCard>
    </>
  );
}
