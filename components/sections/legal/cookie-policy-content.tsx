import { LegalSubsection } from "@/components/sections/legal/legal-subsection";

export function CookiePolicyContent() {
  return (
    <>
      <LegalSubsection title="4.1 What Are Cookies">
        <p>
          Cookies are small text files placed on your device by websites you
          visit. They are widely used to make websites work, improve user
          experience, and provide information to site owners.
        </p>
      </LegalSubsection>

      <LegalSubsection title="4.2 How We Use Cookies">
        <p>
          PDF Viewer App uses cookies and similar technologies (web beacons,
          pixels, local storage) on pdfedits.io. We use four categories of
          cookies:
        </p>
        <p className="font-medium text-[var(--color-foreground)]">
          Strictly necessary cookies
        </p>
        <p>
          These cookies are essential for the Service to function. They cannot
          be disabled. They include session authentication, security tokens, and
          load-balancing cookies.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            session_id — Maintains your login session (expires: session)
          </li>
          <li>
            csrf_token — Protects against cross-site request forgery (expires:
            session)
          </li>
        </ul>
        <p className="font-medium text-[var(--color-foreground)]">
          Functional cookies
        </p>
        <p>
          These cookies remember your preferences and settings to improve your
          experience.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>ui_theme — Remembers light/dark mode preference (expires: 1 year)</li>
          <li>language_pref — Stores your language selection (expires: 1 year)</li>
        </ul>
        <p className="font-medium text-[var(--color-foreground)]">
          Analytics cookies
        </p>
        <p>
          These cookies help us understand how users interact with the Service.
          Data is aggregated and anonymized.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            _ga, _gid — Google Analytics (expires: up to 2 years)
          </li>
          <li>
            Internal usage tracking — feature adoption and error monitoring
            (expires: 90 days)
          </li>
        </ul>
        <p className="font-medium text-[var(--color-foreground)]">
          Marketing and advertising cookies
        </p>
        <p>
          We do not currently serve advertising. If we introduce advertising in
          the future, we will update this policy and obtain fresh consent.
        </p>
      </LegalSubsection>

      <LegalSubsection title="4.3 Third-Party Cookies">
        <p>
          Some third-party services we use may set their own cookies, including:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Payment processors (for fraud prevention during checkout).</li>
          <li>Google Analytics (for anonymized usage analytics).</li>
          <li>Customer support tools (if you initiate a support chat).</li>
        </ul>
      </LegalSubsection>

      <LegalSubsection id="managing-cookies" title="4.4 Managing Cookies">
        <p>
          On your first visit, you will see a cookie consent banner allowing you
          to accept or decline non-essential cookies. You can also change your
          preferences at any time via the Cookie Settings link in the footer.
        </p>
        <p>You can also control cookies through your browser settings:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Chrome: Settings &gt; Privacy and Security &gt; Cookies</li>
          <li>Firefox: Options &gt; Privacy and Security &gt; Cookies</li>
          <li>Safari: Preferences &gt; Privacy</li>
          <li>Edge: Settings &gt; Privacy, Search, and Services</li>
        </ul>
        <p>
          Note: disabling strictly necessary cookies will prevent the Service
          from functioning.
        </p>
      </LegalSubsection>

      <LegalSubsection title="4.5 Do Not Track">
        <p>
          We honor Do Not Track (DNT) browser signals. When DNT is enabled, we
          disable all non-essential tracking.
        </p>
      </LegalSubsection>

      <LegalSubsection title="4.6 Cookie Policy Updates">
        <p>
          We may update this Cookie Policy periodically. Material changes will be
          announced via a notice on the Service.
        </p>
      </LegalSubsection>
    </>
  );
}
