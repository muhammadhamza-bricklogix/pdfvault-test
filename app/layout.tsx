import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";

import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";
import { Playfair_Display } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import Script from "next/script";

import { ClerkBlockDiagnostics } from "@/components/shared/clerk-block-diagnostics";
import { WeglotBoot } from "@/components/shared/navigation/weglot-boot";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type Locale,
  LOCALE_HEADER,
  OG_LOCALE_TAG,
  parseLocalePrefix,
  PATHNAME_HEADER,
  RTL_LOCALES,
  SUPPORTED_LOCALES,
} from "@/lib/shared/constants/locale-map";

const playfairDisplay = Playfair_Display({
  display: "swap",
  // Only used on /privacy, /terms, /cookies etc. legal-hero components.
  // Setting `preload: false` skips the <link rel="preload"> so landing +
  // marketing routes don't fetch the woff2 during the LCP window; legal
  // pages still get it (loads on demand + swaps via Georgia fallback).
  preload: false,
  subsets: ["latin"],
  variable: "--font-legal-serif",
  weight: ["400", "600", "700"],
});

// Signature-tab fonts (Dancing_Script, Great_Vibes, Allura,
// Sacramento, Pacifico) were previously loaded here at root. Moved
// 2026-08-30 to `app/(tools)/layout.tsx` because they're ONLY used
// by the signature type-picker inside `SignatureModal` (PDF
// composer + W-9 form) — landing / marketing pages were fetching
// 5 unused woff2 files on every visit, adding ~50-80 KB to the
// critical bandwidth and delaying LCP. Grep for `--font-great-vibes`
// to see the consumers.

import { Providers } from "./providers";

const CANONICAL_HOST = "https://pdfvault.ai";

function buildLocaleUrl(locale: Locale, effectivePath: string): string {
  const path = effectivePath === "/" ? "" : effectivePath;

  if (locale === DEFAULT_LOCALE) return `${CANONICAL_HOST}${path || "/"}`;

  return `${CANONICAL_HOST}/${locale}${path}`;
}

async function readLocaleContext(): Promise<{
  locale: Locale;
  effectivePath: string;
  originalPathname: string;
}> {
  const headerList = await headers();
  const headerLocale = headerList.get(LOCALE_HEADER);
  const originalPathname = headerList.get(PATHNAME_HEADER) ?? "/";
  const locale = isSupportedLocale(headerLocale)
    ? headerLocale
    : DEFAULT_LOCALE;
  const parsed = parseLocalePrefix(originalPathname);
  const effectivePath = parsed ? parsed.rest : originalPathname;

  return { effectivePath, locale, originalPathname };
}

/**
 * Emits per-URL metadata:
 *   - Self-referencing canonical (never canonical to EN root from a
 *     non-EN page).
 *   - Reciprocal + self-referencing hreflang for all 6 locales.
 *   - `x-default` → EN root at `https://pdfvault.ai/`.
 *   - `og:locale` matches the current page; `og:locale:alternate`
 *     lists the other 5.
 *
 * This runs on EVERY request through the app because the whole route
 * tree lives under this layout — the middleware supplies the
 * `x-pdfvault-locale` and `x-pdfvault-pathname` headers so we can
 * compute the canonical route path without duplicating routes under a
 * `[locale]` segment.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { locale, effectivePath } = await readLocaleContext();
  const canonical = buildLocaleUrl(locale, effectivePath);

  const languages: Record<string, string> = {
    "x-default": buildLocaleUrl(DEFAULT_LOCALE, effectivePath),
  };

  for (const l of SUPPORTED_LOCALES) {
    languages[l] = buildLocaleUrl(l, effectivePath);
  }

  const localeAlternates = SUPPORTED_LOCALES.filter((l) => l !== locale).map(
    (l) => OG_LOCALE_TAG[l],
  );

  return {
    // Anchor every relative asset URL (openGraph.images, twitter.images,
    // icons) to the production origin. Without this, Next.js falls back
    // to `http://localhost:3000` when a crawler / static analyzer can't
    // resolve a request origin — exactly what QA saw when Slack refused
    // to unfurl a `pdfvault.ai` link because the meta tag emitted
    // `og:image=http://localhost:3000/og.png`.
    metadataBase: new URL("https://pdfvault.ai"),
    title: {
      default: "pdfvault.ai",
      template: "%s | pdfvault.ai",
    },
    description:
      "pdfvault.ai — Edit, compress, convert, sign and secure your PDFs online. Fast, private, no installs.",
    icons: {
      apple: "/PDFVault_stacked_layers.png",
      icon: "/PDFVault_stacked_layers.png",
      shortcut: "/PDFVault_stacked_layers.png",
    },
    openGraph: {
      description:
        "Edit, compress, convert, sign and secure your PDFs online. Fast, private, no installs.",
      images: [{ height: 630, url: "/og.png", width: 1200 }],
      locale: OG_LOCALE_TAG[locale],
      alternateLocale: localeAlternates,
      siteName: "pdfvault.ai",
      title: "pdfvault.ai — PDF tools that work",
      type: "website",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      description:
        "Edit, compress, convert, sign and secure your PDFs online. Fast, private, no installs.",
      images: ["/og.png"],
      title: "pdfvault.ai — PDF tools that work",
    },
    alternates: {
      canonical,
      languages,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale } = await readLocaleContext();
  const dir = (RTL_LOCALES as readonly Locale[]).includes(locale)
    ? "rtl"
    : "ltr";

  // Trustpilot AFS invitation register key. Public — safe to bake into
  // the client bundle (it ships to every visitor anyway, so it's not a
  // secret). Hardcoded fallback ensures the loader fires in every
  // environment even without explicit env config; setting
  // NEXT_PUBLIC_TRUSTPILOT_INVITE_ID overrides for key rotation without
  // a code change. Dev is still skipped by the NODE_ENV guard so local
  // work doesn't spam Trustpilot's crawler with test hits.
  const TRUSTPILOT_INVITE_ID_DEFAULT = "8RKmNv4GASChIZiA";
  const envInviteId = process.env.NEXT_PUBLIC_TRUSTPILOT_INVITE_ID?.trim();
  // `||` (not `??`) so an empty-string env var also falls back to the
  // hardcoded default — Railway config often stores unset keys as `""`
  // rather than truly undefined, which silently disabled the loader.
  const trustpilotInviteId =
    process.env.NODE_ENV === "development"
      ? envInviteId
      : envInviteId || TRUSTPILOT_INVITE_ID_DEFAULT;

  return (
    <html
      suppressHydrationWarning
      className={playfairDisplay.variable}
      dir={dir}
      lang={locale}
    >
      {/*
        Preconnect to critical third-party origins so the TCP + TLS
        handshakes happen in parallel with HTML parsing rather than
        on demand. Lighthouse warns >4 preconnects, but Clerk SDK is
        loaded on EVERY page via ClerkProvider in root — dropping its
        preconnect (attempted 2026-08-30) cost more than the warning
        saved (Lighthouse dropped from 90 → 80). Keeping it in.
        `cdn.charge-auth.com` stays as dns-prefetch only — it's
        genuinely paywall-flow-only, and downgrading it saves 1 socket.
      */}
      <link
        crossOrigin="anonymous"
        href="https://clerk.pdfvault.ai"
        rel="preconnect"
      />
      <link href="https://clerk.pdfvault.ai" rel="dns-prefetch" />
      {/* Weglot CDN preconnect — re-added 2026-09-02 with WeglotBoot.
          Remove again once CloudFront Reverse Proxy behaviors handle
          translation server-side. */}
      <link
        crossOrigin="anonymous"
        href="https://cdn.weglot.com"
        rel="preconnect"
      />
      <link href="https://cdn.weglot.com" rel="dns-prefetch" />
      <link
        crossOrigin="anonymous"
        href="https://www.googletagmanager.com"
        rel="preconnect"
      />
      <link href="https://www.googletagmanager.com" rel="dns-prefetch" />
      {/* CookieYes preconnect dropped 2026-08-30 — the script loads
          `async` and doesn't affect LCP. dns-prefetch is the cheaper
          alternative that doesn't consume a socket in the browser's
          limited preconnect pool (Lighthouse warns >4). */}
      <link href="https://cdn-cookieyes.com" rel="dns-prefetch" />
      {trustpilotInviteId ? (
        <>
          <link
            crossOrigin="anonymous"
            href="https://invitejs.trustpilot.com"
            rel="preconnect"
          />
          <link href="https://invitejs.trustpilot.com" rel="dns-prefetch" />
        </>
      ) : null}
      {/* DNS prefetch only — Solidgate payment iframe is deep in the
          paywall flow, not needed at landing time. */}
      <link href="https://cdn.charge-auth.com" rel="dns-prefetch" />
      <link href="https://www.clarity.ms" rel="dns-prefetch" />

      {/* Google tag (gtag.js) — GA4 (G-K6PVB4B39T) + Ads (AW-18226423046) */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-K6PVB4B39T"
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-K6PVB4B39T');
gtag('config', 'AW-18226423046');`}
      </Script>
      {/*
        Single explicit <head> block. React errors if <head> is rendered
        more than once inside the same tree, so all raw inline <script>
        tags that must ship in <head> during SSR live together here:

        1. Google Tag Manager (GTM-5R5LRTTD) — raw <script>, NOT
           next/script. next/script (any strategy) serializes the payload
           into `(self.__next_s).push([...])`, so the GTM snippet ends up
           inside a JSON string, not as executable inline JS in the
           initial HTML source. Google Tag Assistant + Preview/Debug
           detect containers by scanning the raw HTML source for the
           inline snippet — the serialized form fails detection and
           Preview mode won't attach, even though the container loads at
           runtime after hydration. Same failure mode as Trustpilot below.
           Placing a raw <script> inside an explicit <head> is the only
           way to guarantee the snippet ships as executable inline in
           <head> during SSR.

        2. Trustpilot Automatic Feedback Service loader. Exposes a
           global `tp('createInvitation', {...})` API and serves as
           Trustpilot's own domain-verification probe. Trustpilot's
           verifier crawler ONLY inspects <head> contents for the raw
           `tp('register', ...)` call, and rejects the Next.js
           Script-component wrapper (which stringifies the payload into
           `(self.__next_s).push([...])` — the register call is inside a
           JSON string, not an executable pattern the crawler matches).
           `afterInteractive` also fails because it can inject client-side
           after hydration, which a non-JS crawler never sees.
      */}
      <head>
        {/* CookieYes consent banner. `async` + preconnect above keep it
            off the critical path; CookieYes' dashboard-side auto-blocker
            gates downstream trackers regardless of load order. */}
        <script
          async
          id="cookieyes"
          src="https://cdn-cookieyes.com/client_data/98d78886fe30030f1080cdeb0a6c0a25/script.js"
          type="text/javascript"
        />
        {/* GTM loader — marked cookieyes-necessary so CookieYes' auto-blocker
            does NOT wrap the tag in `type="text/plain"` when the user rejects
            cookies. This is compliance-safe ONLY IF the GTM container has
            Consent Mode v2 configured (analytics_storage/ad_storage gated on
            granted consent). Without Consent Mode, GTM will fire GA + Ads
            tags regardless of user choice → GDPR/ePrivacy violation. Audit
            in Tag Assistant before assuming this is compliant. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-5R5LRTTD');`,
          }}
          data-cookieyes="cookieyes-necessary"
        />
        {trustpilotInviteId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,r,n){w.TrustpilotObject=n;w[n]=w[n]||function(){(w[n].q=w[n].q||[]).push(arguments)};a=d.createElement(s);a.async=1;a.src=r;a.type='text/java'+s;f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(a,f)})(window,document,'script','https://invitejs.trustpilot.com/tp.min.js','tp');tp('register', '${trustpilotInviteId}');`,
            }}
            data-cookieyes="cookieyes-functional"
          />
        ) : null}
        {/* Microsoft Clarity — user-behaviour analytics. Raw inline in
            <head> for parity with GTM/Trustpilot so the snippet ships in
            the SSR HTML (Clarity's setup checker inspects source).
            Marked cookieyes-necessary per user request 2026-09-09 — this is
            NOT strictly compliant (Clarity always tracks on load). Safer
            categorization is `cookieyes-performance`; switch if Consent
            Mode / dedicated Clarity consent wiring is not in place. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "ych70e11tb");`,
          }}
          data-cookieyes="cookieyes-necessary"
        />
      </head>
      <body className="min-h-screen bg-[var(--color-background)] font-sans text-[var(--color-foreground)] antialiased">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            height="0"
            src="https://www.googletagmanager.com/ns.html?id=GTM-5R5LRTTD"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
            width="0"
          />
        </noscript>
        <NextTopLoader color="#DF3A38" showSpinner={false} />
        {/* CookieYes/Clerk block diagnostic — ships one CloudWatch event
            per page load with clerk script + cookie survival state. Grep
            `diag.cookie_gate` to see which users are cookie-gated. */}
        <ClerkBlockDiagnostics />
        {/* Re-added 2026-09-02: apex DNS moved off Weglot's Cloudflare
            proxy to stop 429 quota exhaustion, so the SDK is now the
            only translation path until the CloudFront Reverse Proxy
            behaviors ship. Remove again once /de|fr|es|pt|ar/* routes
            through the Weglot origin at CloudFront to avoid the
            React #418 double-init. */}
        <WeglotBoot />
        <ClerkProvider
          signInFallbackRedirectUrl="/dashboard"
          signInUrl="/sign-in"
          signUpFallbackRedirectUrl="/dashboard"
          signUpUrl="/sign-up"
        >
          <Providers
            themeProps={{
              attribute: ["data-theme", "class"],
              defaultTheme: "light",
              enableSystem: false,
              forcedTheme: "light",
            }}
          >
            {children}
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
