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
  { id: "r-5-3", label: "Lifetime Plan" },
  { id: "r-5-4", label: "Renewals" },
  { id: "r-5-5", label: "Exceptional Circumstances" },
  { id: "r-5-6", label: "EU and UK Consumers; Right of Withdrawal" },
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
          <strong>Updated date:</strong> 22 July 2026.
        </p>
        <p className="mt-2">
          <strong>Address:</strong> Dimostheni Severi 12, 6th floor, Flat/Office
          601, 1080, Nicosia, Cyprus.
        </p>
      </div>

      <LegalSectionCard icon={SparklesIcon} id="r-5-1" title="Overview">
        <p>
          This Refund Policy applies to purchases of PDFVault subscriptions and
          paid features made on pdfvault.ai and forms part of our{" "}
          <Link href={ROUTES.LEGAL.TERMS}>Terms and Conditions</Link>. Nothing
          in this Policy limits any non-waivable statutory rights you have in
          your country of residence.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Tick02Icon}
        id="r-5-2"
        title="14-Day Money-Back Guarantee"
      >
        <p>
          We offer a full refund, no questions asked, within 14 days of your
          first subscription payment. This guarantee applies to your first
          Monthly plan payment and your first Annual plan payment. It does not
          apply to subscription renewals (your second payment onward), which are
          addressed in Section 4, or to Lifetime plan purchases, which are
          addressed in Section 3. The guarantee applies once per customer and
          does not apply where an account has been suspended for violation of
          the Terms and Conditions.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={MoneyReceive02Icon}
        id="r-5-3"
        title="Lifetime Plan"
      >
        <p>
          The Lifetime plan is refundable within 14 days of purchase. After 14
          days, all Lifetime plan purchases are final.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={RefreshIcon} id="r-5-4" title="Renewals">
        <p>
          Subscriptions renew automatically (see{" "}
          <Link href={ROUTES.LEGAL.TERMS}>Terms and Conditions</Link>). We do
          not offer automatic refunds for monthly or annual renewal payments.
          However, if a renewal charge occurs and you cancel within 48 hours of
          that charge, contact us and we will consider a refund on a
          case-by-case basis. To avoid a renewal charge altogether, cancel
          before the renewal date.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Alert01Icon}
        id="r-5-5"
        title="Exceptional Circumstances"
      >
        <p>
          We may issue refunds outside this Policy at our discretion in
          circumstances such as:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            A technical fault on our end that prevented you from using a paid
            feature for more than 72 hours.
          </li>
          <li>Duplicate charges caused by a billing error.</li>
          <li>Documented fraudulent charges.</li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Globe02Icon}
        id="r-5-6"
        title="EU and UK Consumers; Right of Withdrawal"
      >
        <p>
          If you are a consumer in the EU or UK, you have a statutory 14-day
          right to withdraw from a contract for digital services. By starting to
          use the paid Service immediately, you request immediate performance
          and acknowledge that, once the service has been fully performed, you
          lose the right of withdrawal; where you withdraw during the 14-day
          period after use has begun, we may deduct a proportionate amount for
          the service already provided.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Mail01Icon}
        id="r-5-7"
        title="How to Request a Refund"
      >
        <p>
          Email <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>{" "}
          with the subject line &ldquo;Refund Request,&rdquo; your account email
          address, the date and amount of the charge, and optionally, your
          reason for the request. We process approved refunds within 5&ndash;10
          business days to the original payment method via our payment processor
          [Adyen]; your bank or card issuer may take additional time to post the
          credit.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={CancelCircleIcon} id="r-5-8" title="Exclusions">
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Charges older than the applicable refund window, except where
            required by law.
          </li>
          <li>
            Subscription renewal payments outside the 48-hour window in Section
            4.
          </li>
          <li>Lifetime plan purchases more than 14 days after purchase.</li>
          <li>
            Accounts suspended or terminated for violation of the Terms and
            Conditions.
          </li>
          <li>
            Purchases made through third-party platforms or resellers; request
            refunds via the platform of purchase.
          </li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard icon={CreditCardIcon} id="r-5-9" title="Chargebacks">
        <p>
          Please contact us before initiating a chargeback with your bank or
          card provider; chargebacks carry significant fees and administrative
          burden and are usually slower to resolve than contacting us directly.
          If a chargeback is filed against a valid charge, we may suspend your
          account pending resolution.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Mail01Icon} id="r-5-10" title="Contact">
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
