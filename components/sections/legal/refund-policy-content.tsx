import { LegalSubsection } from "@/components/sections/legal/legal-subsection";

export function RefundPolicyContent() {
  return (
    <>
      <LegalSubsection title="5.1 Our Commitment">
        <p>
          We want you to be satisfied with the PDF Edits App. Our refund policy
          is designed to be fair and transparent.
        </p>
      </LegalSubsection>

      <LegalSubsection title="5.2 14-Day Money-Back Guarantee">
        <p>
          We offer a 14-day money-back guarantee on all first-time subscriptions
          (Monthly and Annual plans). If you are not satisfied within 14 days of
          your initial subscription payment, contact us for a full refund — no
          questions asked.
        </p>
        <p className="font-medium text-[var(--color-foreground)]">
          This guarantee applies to:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Your first Monthly plan payment.</li>
          <li>Your first Annual plan payment.</li>
        </ul>
        <p className="font-medium text-[var(--color-foreground)]">
          This guarantee does not apply to:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Subscription renewals (i.e., your second payment onwards).
          </li>
          <li>Lifetime plan purchases after 14 days.</li>
          <li>
            Cases where the account has been suspended for Terms of Service
            violations.
          </li>
        </ul>
      </LegalSubsection>

      <LegalSubsection title="5.3 Renewal Payments">
        <p>
          For monthly and annual renewal payments, we do not offer automatic
          refunds. However, if a renewal charge occurs and you cancel within 48
          hours, contact us and we will consider a refund on a case-by-case
          basis.
        </p>
      </LegalSubsection>

      <LegalSubsection title="5.4 Exceptional Circumstances">
        <p>
          We will issue refunds outside the standard policy at our discretion in
          cases such as:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            A technical fault on our end that prevented you from using a paid
            feature for more than 72 hours.
          </li>
          <li>Duplicate charges due to a billing error.</li>
          <li>Documented fraudulent charges.</li>
        </ul>
      </LegalSubsection>

      <LegalSubsection title="5.5 How to Request a Refund">
        <p>
          Email{" "}
          <a
            className="font-medium text-[var(--color-accent)] underline underline-offset-2"
            href="mailto:support@pdfeditsapp.com"
          >
            support@pdfeditsapp.com
          </a>{" "}
          with:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Subject line: &quot;Refund Request&quot;</li>
          <li>Your account email address.</li>
          <li>The date and amount of the charge.</li>
          <li>Your reason for requesting a refund (optional but helpful).</li>
        </ul>
        <p>
          We will process approved refunds within 5–10 business days. Refunds
          are returned to the original payment method.
        </p>
      </LegalSubsection>

      <LegalSubsection title="5.6 Chargebacks">
        <p>
          We strongly encourage you to contact us before initiating a chargeback
          with your bank or card provider. Chargebacks result in significant fees
          and administrative burden. If a chargeback is filed against a valid
          charge, your account may be suspended pending resolution.
        </p>
      </LegalSubsection>

      <LegalSubsection title="5.7 Lifetime Plan">
        <p>
          The Lifetime plan is refundable within 14 days of purchase. After 14
          days, all Lifetime plan purchases are final.
        </p>
      </LegalSubsection>
    </>
  );
}
