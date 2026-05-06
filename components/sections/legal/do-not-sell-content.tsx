import { LegalSubsection } from "@/components/sections/legal/legal-subsection";

export function DoNotSellContent() {
  return (
    <>
      <LegalSubsection title="6.1 Your Rights Under CCPA/CPRA">
        <p>
          If you are a California resident, the California Consumer Privacy Act
          (CCPA), as amended by the California Privacy Rights Act (CPRA), gives
          you the right to opt out of the &quot;sale&quot; or
          &quot;sharing&quot; of your personal information as those terms are
          defined under California law.
        </p>
      </LegalSubsection>

      <LegalSubsection title="6.2 Our Current Practices">
        <p>
          PDF Viewer App does not sell your personal information to third
          parties for monetary compensation.
        </p>
        <p>
          However, under the broad definitions of the CCPA/CPRA, certain data
          practices — such as sharing information with analytics providers or
          advertising networks — may be considered &quot;sharing&quot; personal
          information for cross-context behavioral advertising purposes. We want
          to be transparent about this.
        </p>
      </LegalSubsection>

      <LegalSubsection title="6.3 Categories of Information That May Be Shared">
        <p>
          The following categories of personal information may be shared for
          analytics or service improvement purposes:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Identifiers (IP address, cookie identifiers).</li>
          <li>
            Internet or network activity (pages visited, features used, session
            data).
          </li>
          <li>Geolocation data (country-level only, derived from IP address).</li>
        </ul>
      </LegalSubsection>

      <LegalSubsection title="6.4 How to Opt Out">
        <p>
          You have the right to opt out of the sharing of your personal
          information for cross-context behavioral advertising at any time. You
          may exercise this right by:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Using the &quot;Cookie Settings&quot; link in the footer of our website
            to disable analytics and advertising cookies.
          </li>
          <li>
            Emailing us at{" "}
            <a
              className="font-medium text-[var(--color-accent)] underline underline-offset-2"
              href="mailto:support@pdfeditsapp.com?subject=CCPA%20Opt-Out%20Request"
            >
              support@pdfeditsapp.com
            </a>{" "}
            with subject line &quot;CCPA Opt-Out Request&quot; and your account
            email address.
          </li>
          <li>
            Using a Global Privacy Control (GPC) signal in your browser — we honor
            GPC signals automatically.
          </li>
        </ul>
      </LegalSubsection>

      <LegalSubsection title="6.5 Other California Privacy Rights">
        <p>As a California resident, you also have the right to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Know what personal information we collect, use, share, or sell.
          </li>
          <li>
            Delete personal information we have collected about you (subject to
            certain exceptions).
          </li>
          <li>Correct inaccurate personal information.</li>
          <li>
            Limit the use and disclosure of sensitive personal information.
          </li>
          <li>
            Non-discrimination: we will not discriminate against you for
            exercising your privacy rights.
          </li>
        </ul>
      </LegalSubsection>

      <LegalSubsection title="6.6 Authorized Agents">
        <p>
          You may designate an authorized agent to submit a request on your
          behalf. We may require written proof of authorization and may verify the
          identity of the requestor.
        </p>
      </LegalSubsection>

      <LegalSubsection title="6.7 Response Time">
        <p>
          We will acknowledge your opt-out request within 10 business days and
          fulfill it within 15 business days. We will confirm once the opt-out is
          effective.
        </p>
      </LegalSubsection>

      <LegalSubsection title="6.8 Contact">
        <p>
          For privacy rights requests or questions:{" "}
          <a
            className="font-medium text-[var(--color-accent)] underline underline-offset-2"
            href="mailto:support@pdfeditsapp.com"
          >
            support@pdfeditsapp.com
          </a>
        </p>
      </LegalSubsection>

      <LegalSubsection title="6.9 Rights for Residents of Other States">
        <p>
          Residents of Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA),
          Utah (UCPA), and other states with privacy laws have similar rights. We
          honor opt-out and deletion requests from users in all such
          jurisdictions. Contact us at{" "}
          <a
            className="font-medium text-[var(--color-accent)] underline underline-offset-2"
            href="mailto:support@pdfeditsapp.com"
          >
            support@pdfeditsapp.com
          </a>{" "}
          to exercise your rights.
        </p>
      </LegalSubsection>
    </>
  );
}
