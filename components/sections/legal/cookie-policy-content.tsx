import type { LegalTocEntry } from "@/components/sections/legal/legal-toc";

import {
  ArrowReloadHorizontalIcon,
  CookieIcon,
  FingerPrintCheckIcon,
  Globe02Icon,
  Mail01Icon,
  Settings02Icon,
  Share01Icon,
} from "@hugeicons/core-free-icons";

import { LegalSectionCard } from "@/components/sections/legal/legal-section-card";

export const cookieTocEntries: LegalTocEntry[] = [
  { id: "c-4-1", label: "What Are Cookies" },
  { id: "c-4-2", label: "Who Sets Cookies on This Site" },
  { id: "c-4-3", label: "Categories of Cookies We Use" },
  { id: "c-4-4", label: "Third-Party Cookies" },
  { id: "managing-cookies", label: "Your Choices and Consent" },
  { id: "c-4-5", label: "Do Not Track" },
  { id: "c-4-6", label: "Changes to This Policy" },
  { id: "c-4-7", label: "Contact" },
];

/**
 * Table used across the "Categories of Cookies We Use" section. Small
 * scoped component so the four category tables stay visually
 * consistent without leaking styling into every consumer.
 */
function CookieTable({
  rows,
}: {
  rows: { name: string; provider: string; purpose: string; expiry: string }[];
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-[var(--legal-border-subtle)] text-left">
            <th className="py-2 pr-3 font-semibold text-[#121212]">Cookie</th>
            <th className="py-2 pr-3 font-semibold text-[#121212]">Provider</th>
            <th className="py-2 pr-3 font-semibold text-[#121212]">Purpose</th>
            <th className="py-2 font-semibold text-[#121212]">Expiry</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.name}
              className="border-b border-[var(--legal-border-subtle)] align-top"
            >
              <td className="py-2 pr-3 font-mono text-[13px]">{r.name}</td>
              <td className="py-2 pr-3">{r.provider}</td>
              <td className="py-2 pr-3">{r.purpose}</td>
              <td className="py-2 whitespace-nowrap">{r.expiry}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CookiePolicyContent() {
  return (
    <>
      <div className="mb-6" id="c-meta">
        <p>
          <strong>Updated date:</strong> 22 July 2026.
        </p>
        <p className="mt-2">
          <strong>Address:</strong> Dimostheni Severi 12, 6th floor, Flat/Office
          601, 1080, Nicosia, Cyprus.
        </p>
      </div>

      <LegalSectionCard icon={CookieIcon} id="c-4-1" title="What Are Cookies">
        <p>
          Cookies are small text files placed on your device by websites you
          visit. They are widely used to make websites work, improve user
          experience, and provide information to site owners. We also use
          similar technologies such as web beacons, pixels, and local storage;
          references to &ldquo;cookies&rdquo; in this Policy include these
          technologies. Session cookies expire when you close your browser;
          persistent cookies remain until a set expiration date or until you
          delete them.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Share01Icon}
        id="c-4-2"
        title="Who Sets Cookies on This Site"
      >
        <p>
          This Cookie Policy is issued by FLUTTWINGS INVESTMENTS LIMITED, the
          operator of pdfvault.ai. First-party cookies are set by us;
          third-party cookies are set by our service providers (see Section 4).
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Settings02Icon}
        id="c-4-3"
        title="Categories of Cookies We Use"
      >
        <p className="font-semibold text-[var(--legal-burgundy)]">
          Strictly necessary cookies
        </p>
        <p>
          Essential for the Service to function; they cannot be disabled. They
          include authentication and security cookies.
        </p>
        <CookieTable
          rows={[
            {
              name: "__client_uat",
              provider: "Clerk (authentication)",
              purpose:
                "Records whether a user is currently signed in and keeps session state in sync.",
              expiry: "Up to 1 year",
            },
            {
              name: "__clerk_db_jwt",
              provider: "Clerk (authentication)",
              purpose:
                "Authentication / session token used to keep you signed in.",
              expiry: "Session",
            },
          ]}
        />
        <p className="mt-3 text-[13px] italic text-[var(--pv-text-tertiary)]">
          Clerk may set environment-specific variants of the two Clerk cookies
          above (for example, with a suffix identifying the application
          instance); these serve the same authentication purpose and are not
          separately listed.
        </p>

        <p className="mt-6 font-semibold text-[var(--legal-burgundy)]">
          Functional cookies
        </p>
        <p>
          Remember your preferences and choices to make the Service more
          convenient to use.
        </p>
        <CookieTable
          rows={[
            {
              name: "cookie_consent",
              provider: "PDFVault (first-party)",
              purpose:
                "Stores your cookie consent choices so the banner is not shown again.",
              expiry: "1 year",
            },
            {
              name: "ui_theme",
              provider: "PDFVault (first-party)",
              purpose: "Remembers your light / dark mode display preference.",
              expiry: "1 year",
            },
            {
              name: "pdfvault:weglot-lang",
              provider: "PDFVault (first-party, local storage)",
              purpose:
                "Stores your selected language so the translation service can restore it across pages.",
              expiry: "Until cleared",
            },
          ]}
        />

        <p className="mt-6 font-semibold text-[var(--legal-burgundy)]">
          Analytics cookies
        </p>
        <p>
          Help us understand how visitors use the Service so we can improve it.
          Data is aggregated and does not identify you individually.
        </p>
        <CookieTable
          rows={[
            {
              name: "_ga",
              provider: "Google Analytics",
              purpose:
                "Distinguishes unique visitors by assigning a randomly generated identifier.",
              expiry: "2 years",
            },
            {
              name: "_gid",
              provider: "Google Analytics",
              purpose: "Distinguishes visitors for short-term usage analysis.",
              expiry: "24 hours",
            },
          ]}
        />

        <p className="mt-6 font-semibold text-[var(--legal-burgundy)]">
          Marketing and advertising cookies
        </p>
        <p>
          We do not currently serve advertising. If we introduce advertising in
          the future, we will update this Policy and obtain fresh consent before
          setting any advertising cookies.
        </p>

        <p className="mt-6 font-semibold text-[var(--legal-burgundy)]">
          Cookies observed from google.com
        </p>
        <p>
          A July 2026 scan of the <code>/terms</code> page also showed the
          following cookies associated with google.com. This set includes Google
          account-linked cookies rather than standard anonymous analytics
          cookies, so depending on the answer it must be reclassified and
          disclosed above as an analytics, advertising, or sign-in integration,
          and gated behind consent accordingly before this Policy is finalized.
        </p>
        <CookieTable
          rows={[
            {
              name: "SID, HSID, SSID",
              provider: "google.com",
              purpose:
                "Google account authentication — helps protect user data and Google Account sign-in from unauthorized access.",
              expiry: "2 years",
            },
            {
              name: "APISID, SAPISID",
              provider: "google.com",
              purpose:
                "Google account authentication — used to verify Google Account identity for signed-in requests.",
              expiry: "2 years",
            },
            {
              name: "__Secure-1PSID, __Secure-1PAPISID, __Secure-1PSIDCC, __Secure-1PSIDTS",
              provider: "google.com",
              purpose:
                "Secure (first-party) variants of the account-authentication cookies above.",
              expiry: "2 years",
            },
            {
              name: "__Secure-3PSID, __Secure-3PAPISID, __Secure-3PSIDCC, __Secure-3PSIDTS",
              provider: "google.com",
              purpose:
                "Secure cross-site variants of the account-authentication cookies above.",
              expiry: "1 year",
            },
            {
              name: "NID",
              provider: "google.com",
              purpose:
                "Per Google, used to store preferences and, where applicable, ad-personalization settings.",
              expiry: "—",
            },
            {
              name: "AEC",
              provider: "google.com",
              purpose:
                "Per Google, used for security purposes, including protecting against abusive requests.",
              expiry: "—",
            },
            {
              name: "__Secure-ENID",
              provider: "google.com",
              purpose:
                "Per Google, used for ad personalization and measurement.",
              expiry: "—",
            },
            {
              name: "__Secure-BUCKET",
              provider: "google.com",
              purpose: "Per Google, used for experiment / feature bucketing.",
              expiry: "Session",
            },
            {
              name: "SEARCH_SAMESITE, S",
              provider: "google.com",
              purpose:
                "Per Google, session and site-compatibility cookies; the “S” cookie observed referenced a Google billing UI component.",
              expiry: "Session",
            },
          ]}
        />
      </LegalSectionCard>

      <LegalSectionCard
        icon={Share01Icon}
        id="c-4-4"
        title="Third-Party Cookies"
      >
        <p>
          Some third-party services we use may set their own cookies, including
          Clerk (authentication), Adyen (fraud prevention during checkout),
          GoDaddy (hosting and email), Zendesk (customer support), CloudConvert
          (file conversion), and Google LLC (analytics). These providers&rsquo;
          own privacy and cookie policies apply to their processing.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={ArrowReloadHorizontalIcon}
        id="managing-cookies"
        title="Your Choices and Consent"
      >
        <p>
          <strong>EEA and UK visitors:</strong> on your first visit you will see
          a cookie consent banner allowing you to accept or reject non-essential
          cookies before they are set. You can change or withdraw your consent
          at any time via the &ldquo;Cookie Settings&rdquo; link in the footer.
        </p>
        <p className="mt-3">
          <strong>US visitors:</strong> where state law grants you the right to
          opt out of &ldquo;sales,&rdquo; &ldquo;sharing,&rdquo; or targeted
          advertising via cookies, you may do so via the &ldquo;Cookie
          Settings&rdquo; link. We honor Global Privacy Control (GPC) browser
          signals where required by law.
        </p>
        <p className="mt-3">
          You can also control cookies through your browser settings (Chrome,
          Firefox, Safari, and Edge each provide cookie controls under their
          privacy settings). Disabling strictly necessary cookies will prevent
          the Service from functioning.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={FingerPrintCheckIcon}
        id="c-4-5"
        title="Do Not Track"
      >
        <p>
          Our website does not currently respond to DNT signals but honors GPC.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Globe02Icon}
        id="c-4-6"
        title="Changes to This Policy"
      >
        <p>
          We may update this Cookie Policy periodically. Material changes will
          be announced via a notice on the Service, and the &ldquo;Effective
          date&rdquo; above will be updated.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Mail01Icon} id="c-4-7" title="Contact">
        <p>
          Questions about this Cookie Policy:{" "}
          <a href="mailto:support@pdfvault.ai">support@pdfvault.ai</a>.
        </p>
        <p className="mt-3">
          FLUTTWINGS INVESTMENTS LIMITED
          <br />
          Dimostheni Severi 12, 6th floor, Flat/Office 601, 1080, Nicosia,
          Cyprus.
        </p>
      </LegalSectionCard>
    </>
  );
}
