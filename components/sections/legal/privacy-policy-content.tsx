import { LegalSubsection } from "@/components/sections/legal/legal-subsection";

export function PrivacyPolicyContent() {
  return (
    <>
      <LegalSubsection title="3.1 Introduction">
        <p>
          PDF Viewer App (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
          is committed to protecting your privacy. This Privacy Policy explains
          how we collect, use, disclose, and protect your personal information
          when you use our Service at pdfedits.io.
        </p>
      </LegalSubsection>

      <LegalSubsection title="3.2 Information We Collect">
        <p className="font-medium text-[var(--color-foreground)]">
          Information you provide directly:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Account registration details (name, email address, password hash).
          </li>
          <li>
            Payment information (processed and stored by our payment processor;
            we do not store full card details).
          </li>
          <li>Communications you send us (support tickets, emails).</li>
        </ul>
        <p className="font-medium text-[var(--color-foreground)]">
          Information collected automatically:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Log data: IP address, browser type, pages visited, timestamps,
            referring URLs.
          </li>
          <li>
            Device information: operating system, screen resolution, language
            settings.
          </li>
          <li>
            Usage data: features used, file types processed (not file
            contents), session duration.
          </li>
          <li>
            Cookies and similar tracking technologies (see Cookie Policy).
          </li>
        </ul>
        <p className="font-medium text-[var(--color-foreground)]">
          Information we do NOT collect:
        </p>
        <p>
          The contents of your uploaded files. Files are processed in memory and
          not permanently stored beyond the session unless you explicitly save
          them to your account.
        </p>
      </LegalSubsection>

      <LegalSubsection title="3.3 How We Use Your Information">
        <p>We use your information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide, maintain, and improve the Service.</li>
          <li>Process payments and manage subscriptions.</li>
          <li>
            Send transactional emails (receipts, renewal reminders, service
            updates).
          </li>
          <li>Respond to support requests.</li>
          <li>
            Analyze usage patterns to improve user experience (using
            anonymized/aggregated data).
          </li>
          <li>Comply with legal obligations.</li>
          <li>Detect and prevent fraud or abuse.</li>
        </ul>
      </LegalSubsection>

      <LegalSubsection title="3.4 Legal Basis for Processing (GDPR)">
        <p>
          For users in the European Economic Area, our legal bases for processing
          are:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Performance of a contract: to provide you with the Service.
          </li>
          <li>
            Legitimate interests: for security, fraud prevention, and service
            improvement.
          </li>
          <li>Legal obligation: to comply with applicable laws.</li>
          <li>
            Consent: for marketing communications and non-essential cookies
            (which you may withdraw at any time).
          </li>
        </ul>
      </LegalSubsection>

      <LegalSubsection title="3.5 Data Sharing and Disclosure">
        <p>We do not sell your personal data. We may share data with:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Service providers (payment processors, email providers, hosting
            providers) who are contractually bound to protect your data.
          </li>
          <li>Analytics providers (using anonymized data only).</li>
          <li>
            Law enforcement or regulatory authorities when required by law.
          </li>
          <li>
            Successors in the event of a merger, acquisition, or sale of assets
            (with advance notice to you).
          </li>
        </ul>
      </LegalSubsection>

      <LegalSubsection title="3.6 Data Retention">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Account data is retained for as long as your account is active.
          </li>
          <li>
            Uploaded file data is not retained beyond the processing session
            (unless explicitly saved to your account).
          </li>
          <li>
            Payment records are retained as required by financial and tax
            regulations.
          </li>
          <li>Log data is retained for up to 90 days.</li>
        </ul>
        <p>
          You may request deletion of your account and associated data at any
          time (see Your Rights).
        </p>
      </LegalSubsection>

      <LegalSubsection title="3.7 International Data Transfers">
        <p>
          Your data may be processed in countries outside your own. Where we
          transfer data internationally, we ensure appropriate safeguards
          (e.g., Standard Contractual Clauses for EEA transfers) are in place.
        </p>
      </LegalSubsection>

      <LegalSubsection title="3.8 Your Rights">
        <p>Depending on your location, you may have the right to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Access: request a copy of the personal data we hold about you.
          </li>
          <li>Rectification: correct inaccurate or incomplete data.</li>
          <li>
            Erasure: request deletion of your personal data (&quot;right to be
            forgotten&quot;).
          </li>
          <li>Restriction: request that we limit how we process your data.</li>
          <li>
            Portability: receive your data in a machine-readable format.
          </li>
          <li>Object: object to processing based on legitimate interests.</li>
          <li>
            Withdraw consent: for processing based on consent, at any time.
          </li>
          <li>Lodge a complaint: with your local data protection authority.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{" "}
          <a
            className="font-medium text-[var(--color-accent)] underline underline-offset-2"
            href="mailto:support@pdfeditsapp.com"
          >
            support@pdfeditsapp.com
          </a>
          . We will respond within 30 days.
        </p>
      </LegalSubsection>

      <LegalSubsection title="3.9 Children&apos;s Privacy">
        <p>
          The Service is not directed to children under 16. We do not knowingly
          collect personal information from children under 16. If you believe we
          have inadvertently collected such information, please contact us
          immediately.
        </p>
      </LegalSubsection>

      <LegalSubsection title="3.10 Security">
        <p>
          We implement industry-standard security measures including TLS
          encryption in transit, hashed passwords, access controls, and regular
          security audits. No system is completely secure; we cannot guarantee
          absolute security.
        </p>
      </LegalSubsection>
    </>
  );
}
