import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";

import { ClerkProvider } from "@clerk/nextjs";
import { Playfair_Display } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import Script from "next/script";

import { WeglotLoader } from "@/components/shared/navigation/weglot-loader";

const playfairDisplay = Playfair_Display({
  display: "swap",
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

export const metadata: Metadata = {
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
    siteName: "pdfvault.ai",
    title: "pdfvault.ai — PDF tools that work",
    type: "website",
    url: "https://pdfvault.ai",
  },
  twitter: {
    card: "summary_large_image",
    description:
      "Edit, compress, convert, sign and secure your PDFs online. Fast, private, no installs.",
    images: ["/og.png"],
    title: "pdfvault.ai — PDF tools that work",
  },
  // Weglot serves translated versions at `<lang>.pdfvault.ai` subdomains.
  // The alternates block emits the `<link rel="alternate" hreflang="...">`
  // tags Google needs to index each language variant. `x-default` points
  // at the canonical English origin.
  alternates: {
    canonical: "https://pdfvault.ai",
    languages: {
      "x-default": "https://pdfvault.ai",
      en: "https://pdfvault.ai",
      ar: "https://ar.pdfvault.ai",
      fr: "https://fr.pdfvault.ai",
      de: "https://de.pdfvault.ai",
      pt: "https://pt.pdfvault.ai",
      es: "https://es.pdfvault.ai",
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      lang="en"
    >
      {/*
        Preconnect ONLY to third-party origins that fire during initial
        landing render — Lighthouse warns above 4 preconnects because
        each holds a socket in the browser's limited pool. Dropped
        2026-08-30:
          - `clerk.pdfvault.ai` — Clerk SDK is lazy-loaded now
            (AuthModal cards via next/dynamic); the SDK self-preconnects
            when it finally loads on user interaction, so a landing-time
            preconnect just wastes a socket.
          - `cdn.charge-auth.com` — Solidgate payment iframe only
            appears deep in the paywall flow (user has clicked
            Download, gone through auth, hit a paywalled export).
            Wasting a landing socket for it hurt LCP more than the
            50ms it saved on paywall open.
        Kept as `dns-prefetch` only (cheaper — resolves DNS but
        doesn't hold a socket).
      */}
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
      <link
        crossOrigin="anonymous"
        href="https://cdn-cookieyes.com"
        rel="preconnect"
      />
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
      {/* DNS prefetch (no socket) for origins we DID drop from
          preconnect but still hit later. Cheaper than preconnect;
          saves ~20-50ms on first Clerk / Solidgate request. */}
      <link href="https://clerk.pdfvault.ai" rel="dns-prefetch" />
      <link href="https://cdn.charge-auth.com" rel="dns-prefetch" />

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
      <Script id="weglot-lang-pref" strategy="beforeInteractive">
        {`
          try {
            const lang = window.localStorage.getItem("pdfvault:weglot-lang");
            if (lang) window.__WEGLOT_PREFERRED_LANG__ = lang;
          } catch (e) {
            // ignore private-mode / storage-disabled
          }
        `}
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
          src="https://cdn-cookieyes.com/client_data/58169a75924fda4d5b767aed398b099c/script.js"
          type="text/javascript"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-5R5LRTTD');`,
          }}
        />
        {trustpilotInviteId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,r,n){w.TrustpilotObject=n;w[n]=w[n]||function(){(w[n].q=w[n].q||[]).push(arguments)};a=d.createElement(s);a.async=1;a.src=r;a.type='text/java'+s;f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(a,f)})(window,document,'script','https://invitejs.trustpilot.com/tp.min.js','tp');tp('register', '${trustpilotInviteId}');`,
            }}
          />
        ) : null}
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
        <WeglotLoader />
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
