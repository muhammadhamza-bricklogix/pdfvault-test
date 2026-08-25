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
          <strong>Updated date:</strong> 24 August 2026.
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
        <p className="mt-3">
          This Cookie Policy forms part of, and should be read together with,
          our Privacy Policy, which describes more generally how we process
          personal data.
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
          include authentication and security cookies. The legal basis for
          these cookies is our legitimate interest in operating a secure,
          functioning Service; consent is not required for strictly necessary
          cookies.
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
            {
              name: "__cf_bm",
              provider: "Cloudflare",
              purpose:
                "Bot-management cookie that distinguishes legitimate visitors from automated traffic, to protect the Service against abuse.",
              expiry: "30 minutes",
            },
            {
              name: "_cfuvid",
              provider: "Cloudflare",
              purpose:
                "Used alongside __cf_bm to distinguish individual visitors sharing an IP address, supporting rate-limiting and security.",
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
          convenient to use. These are set only with your consent where
          required by applicable law.
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
            {
              name: "csrf",
              provider: "Trustpilot",
              purpose:
                "Security token that protects the Trustpilot review widget against cross-site request forgery.",
              expiry: "Session",
            },
            {
              name: "_iidt",
              provider: "Trustpilot",
              purpose:
                "Recognizes a returning visitor across sessions for fraud-prevention purposes.",
              expiry: "~13 months",
            },
            {
              name: "jwt",
              provider: "Trustpilot",
              purpose:
                "Authentication token used internally by the Trustpilot widget.",
              expiry: "Session",
            },
            {
              name: "OptanonAlertBoxClosed",
              provider: "Trustpilot (via OneTrust)",
              purpose:
                "Records that a visitor has dismissed Trustpilot's own cookie banner within the widget.",
              expiry: "1 year",
            },
            {
              name: "OptanonConsent",
              provider: "Trustpilot (via OneTrust)",
              purpose:
                "Stores the visitor's cookie consent choices made within the Trustpilot widget.",
              expiry: "1 year",
            },
            {
              name: "tp-consumer-id",
              provider: "Trustpilot",
              purpose:
                "Identifies the visitor to Trustpilot for review-collection purposes.",
              expiry: "Not confirmed",
            },
            {
              name: "TP.uuid",
              provider: "Trustpilot",
              purpose:
                "Unique identifier assigned by Trustpilot to the visitor's browser.",
              expiry: "Not confirmed",
            },
          ]}
        />

        <p className="mt-6 font-semibold text-[var(--legal-burgundy)]">
          Analytics cookies
        </p>
        <p>
          Help us understand how visitors use the Service so we can improve it.
          These cookies assign a pseudonymous identifier to your browser; we
          use the resulting data to produce aggregated statistics and do not
          use it to identify you by name. Analytics cookies are set only with
          your consent where required by applicable law.
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
          We do not display third-party advertisements on the Service. However,
          we advertise PDFVault through Google Ads, and we use Google
          advertising cookies and pixels on the Service to measure the
          performance of those campaigns (conversion tracking) and, where
          enabled, to build audiences for remarketing. These cookies are set
          only with your consent where required by applicable law, and you can
          withdraw consent at any time via the &ldquo;Cookie Settings&rdquo;
          link (see Section 5). Under some US state privacy laws, this activity
          may constitute a &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of
          personal information, and the opt-out rights described in Section 5
          and in our Privacy Policy apply to it.
        </p>
        <CookieTable
          rows={[
            {
              name: "_gcl_au",
              provider: "Google Ads (via Google tag)",
              purpose:
                "Stores ad-click information to measure conversions from our Google Ads campaigns.",
              expiry: "90 days",
            },
            {
              name: "_gcl_aw",
              provider: "Google Ads",
              purpose:
                "Stores the click identifier (GCLID) when you arrive via a Google ad, for conversion attribution.",
              expiry: "90 days",
            },
            {
              name: "IDE",
              provider: "doubleclick.net (Google)",
              purpose:
                "Used by Google advertising services for ad measurement and, where enabled, remarketing.",
              expiry:
                "Up to 13 months (EEA/UK) / up to 2 years elsewhere",
            },
            {
              name: "test_cookie",
              provider: "doubleclick.net (Google)",
              purpose: "Checks whether your browser supports cookies.",
              expiry: "15 minutes",
            },
          ]}
        />
        <p className="mt-3 text-[13px] italic text-[var(--pv-text-tertiary)]">
          The exact cookies set may vary with how the Google tag is configured;
          we review and update this table when our configuration changes.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Share01Icon}
        id="c-4-4"
        title="Third-Party Cookies"
      >
        <p>
          Some third-party services we use may set their own cookies, including
          Clerk (authentication), Adyen (fraud prevention during checkout),
          Zendesk (customer support), CloudConvert (file conversion), Google
          LLC (analytics and sign-in) and Trustpilot (online review platform).
          These providers&rsquo; own privacy and cookie policies apply to their
          processing.
        </p>

        <p className="mt-6 font-semibold text-[var(--legal-burgundy)]">
          Cookies associated with Google sign-in
        </p>
        <p>
          The only Google integration on the Service is the optional
          &ldquo;Sign in with Google&rdquo; feature (provided via Clerk) on our
          sign-in and sign-up pages. No page on the Service automatically loads
          Google-owned scripts, and Google cookies are not set for visitors who
          do not use Google sign-in.
        </p>
        <p className="mt-3">
          If you choose to sign in with Google, the sign-in flow redirects
          through accounts.google.com, where Google LLC may set or refresh its
          own account cookies (for example SID, HSID, SSID, APISID, SAPISID,
          and their __Secure-1P / __Secure-3P variants) on the google.com
          domain. These cookies are set by Google on its own domain, not by us;
          we cannot set, read, or control them. They are used by Google to
          authenticate your Google Account and protect it from unauthorized
          access, and are governed by Google&rsquo;s own Privacy Policy. If you
          are already signed in to a Google Account in your browser,
          Google&rsquo;s cookies may be present on your device independently of
          the Service.
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
          at any time via the &ldquo;Cookie Settings&rdquo; link in the footer
          of the Service. Withdrawing consent does not affect the lawfulness of
          processing before withdrawal.
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
          Some browsers offer a &ldquo;Do Not Track&rdquo; (DNT) signal. There
          is currently no accepted industry standard for responding to DNT
          signals, and our website does not currently respond to them. We do,
          however, honor Global Privacy Control (GPC) signals as described in
          Section 5.
        </p>
      </LegalSectionCard>

      <LegalSectionCard
        icon={Globe02Icon}
        id="c-4-6"
        title="Changes to This Policy"
      >
        <p>
          We may update this Cookie Policy periodically, including to reflect
          changes in the cookies we use. Material changes will be announced via
          a notice on the Service, and the &ldquo;Updated date&rdquo; above
          will be revised accordingly.
        </p>
      </LegalSectionCard>

      <LegalSectionCard icon={Mail01Icon} id="c-4-7" title="Contact">
        <p>
          Questions about this Cookie Policy:{" "}
          <a href="mailto:dpo@pdfvault.ai">dpo@pdfvault.ai</a>.
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
