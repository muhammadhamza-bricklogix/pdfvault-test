import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";

import { ClerkProvider } from "@clerk/nextjs";
import {
  Allura,
  Dancing_Script,
  Great_Vibes,
  Pacifico,
  Playfair_Display,
  Sacramento,
} from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import Script from "next/script";

import { WeglotLoader } from "@/components/shared/navigation/weglot-loader";

const dancingScript = Dancing_Script({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-dancing-script",
  weight: ["400", "700"],
});

const playfairDisplay = Playfair_Display({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-legal-serif",
  weight: ["400", "600", "700"],
});

// Signature-tab fonts. Loaded here (with display:swap) so the Type signature
// preview canvas can use them without a runtime fetch.
const greatVibes = Great_Vibes({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-great-vibes",
  weight: ["400"],
});

const allura = Allura({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-allura",
  weight: ["400"],
});

const sacramento = Sacramento({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-sacramento",
  weight: ["400"],
});

const pacifico = Pacifico({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-pacifico",
  weight: ["400"],
});

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
      className={`${dancingScript.variable} ${playfairDisplay.variable} ${greatVibes.variable} ${allura.variable} ${sacramento.variable} ${pacifico.variable}`}
      lang="en"
    >
      {/*
        Preconnect to critical third-party origins so the TCP + TLS handshakes
        happen in parallel with HTML parsing rather than on demand.
      */}
      <link
        crossOrigin="anonymous"
        href="https://clerk.pdfvault.ai"
        rel="preconnect"
      />
      <link href="https://clerk.pdfvault.ai" rel="dns-prefetch" />
      <link
        crossOrigin="anonymous"
        href="https://cdn.weglot.com"
        rel="preconnect"
      />
      <link href="https://cdn.weglot.com" rel="dns-prefetch" />
      <link
        crossOrigin="anonymous"
        href="https://cdn.charge-auth.com"
        rel="preconnect"
      />
      <link href="https://cdn.charge-auth.com" rel="dns-prefetch" />
      <link
        crossOrigin="anonymous"
        href="https://consent.cookiebot.com"
        rel="preconnect"
      />
      <link href="https://consent.cookiebot.com" rel="dns-prefetch" />
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

      {/*
        Cookiebot consent banner. Must load in <head> before any other
        third-party scripts so `data-blockingmode="auto"` can rewrite
        cookie-setting <script> tags before they execute. `beforeInteractive`
        is the only Next.js strategy that guarantees head placement during
        SSR — `afterInteractive` injects post-hydration, which lets other
        scripts race Cookiebot and drop cookies before consent is captured.
      */}
      <Script
        data-blockingmode="auto"
        data-cbid="6175cf10-0b87-4966-a8c2-aab9628f2492"
        id="Cookiebot"
        src="https://consent.cookiebot.com/uc.js"
        strategy="beforeInteractive"
        type="text/javascript"
      />
      {/*
        Cookiebot customiser + persistence guard.
        - Overwrites the banner body text with our exact copy (Cookiebot's
          dashboard-configured text is ignored / empty on this template).
        - Renames "Allow all" → "Accept All" and "Deny" → "Reject".
        - Hides the redundant "Allow selection" button (only Customize /
          Reject / Accept All should be visible).
        - Re-invokes `Cookiebot.show()` on every load if the user has no
          recorded response, so the banner persists until an explicit
          Accept / Reject / Customize+Save.
      */}
      <Script id="cookiebot-customize" strategy="afterInteractive">
        {`
          (function () {
            var TEXT_HTML =
              'We use cookies and similar technologies to improve your experience and serve personalized ads. ' +
              '<a href="/privacy">Privacy Policy</a> and <a href="/cookies">Cookie Policy</a>.';

            function setText() {
              // Inject a dedicated text node right before the buttons.
              // We create our own element (id "pv-cookie-banner-text")
              // rather than reusing Cookiebot's own text node, because
              // some templates omit that node entirely, and even when it
              // exists, Cookiebot's runtime CSS often collapses or hides
              // it. Our element carries a unique id so our overrides win.
              var buttons =
                document.getElementById("CybotCookiebotDialogBodyButtonsWrapper") ||
                document.getElementById("CybotCookiebotDialogBodyButtons");
              if (!buttons || !buttons.parentNode) return;
              var el = document.getElementById("pv-cookie-banner-text");
              if (!el) {
                el = document.createElement("div");
                el.id = "pv-cookie-banner-text";
                buttons.parentNode.insertBefore(el, buttons);
              } else if (el.nextSibling !== buttons) {
                buttons.parentNode.insertBefore(el, buttons);
              }
              if (el.innerHTML !== TEXT_HTML) el.innerHTML = TEXT_HTML;
              // Suppress Cookiebot's own (empty / duplicate) text node
              // if it's present, so we don't end up with two paragraphs.
              var native = document.getElementById("CybotCookiebotDialogBodyContentText");
              if (native) native.style.display = "none";
            }
            function relabel(id, label) {
              var el = document.getElementById(id);
              if (el && el.textContent !== label) el.textContent = label;
            }
            function hideNode(id) {
              var el = document.getElementById(id);
              if (el && el.style.display !== "none") el.style.display = "none";
            }
            function apply() {
              setText();
              relabel("CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll", "Accept All");
              relabel("CybotCookiebotDialogBodyButtonAccept", "Accept All");
              relabel("CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll", "Reject");
              relabel("CybotCookiebotDialogBodyButtonDecline", "Reject");
              relabel("CybotCookiebotDialogBodyLevelButtonCustomize", "Customize");
              // Remove the "Allow selection" button — redundant with
              // "Accept All" when the inline category toggles are hidden.
              hideNode("CybotCookiebotDialogBodyLevelButtonAccept");
              hideNode("CybotCookiebotDialogBodyLevelButtonAcceptWrapper");
            }
            function ensureVisible() {
              try {
                var cb = window.Cookiebot;
                if (!cb || cb.hasResponse) return;
                if (typeof cb.show === "function") cb.show();
              } catch (e) {}
            }

            window.addEventListener("CookiebotOnDialogInit", function () {
              apply();
              ensureVisible();
            });
            window.addEventListener("CookiebotOnDialogDisplay", apply);
            window.addEventListener("CookiebotOnLoad", function () {
              apply();
              ensureVisible();
            });

            // Belt-and-braces: watch for Cookiebot re-renders and reapply.
            var mo = new MutationObserver(function () {
              try {
                apply();
                var cb = window.Cookiebot;
                if (!cb || cb.hasResponse) return;
                var el = document.getElementById("CybotCookiebotDialog");
                if (!el || el.offsetParent === null) {
                  if (typeof cb.show === "function") cb.show();
                }
              } catch (e) {}
            });
            function startObserver() {
              if (!document.body) return;
              mo.observe(document.body, { childList: true, subtree: true });
            }
            if (document.body) startObserver();
            else document.addEventListener("DOMContentLoaded", startObserver);
          })();
        `}
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
        Trustpilot Automatic Feedback Service loader. Exposes a global
        `tp('createInvitation', {...})` API and serves as Trustpilot's
        own domain-verification probe.

        MUST use `next/script` with `strategy="beforeInteractive"` — the
        `beforeInteractive` strategy is the only one Next.js guarantees
        to inline into `<head>` during SSR. Raw `<script>` at `<html>`
        root gets hoisted to `<body>` by React, and Trustpilot's verifier
        only scans `<head>` for the `tp('register', ...)` call, so any
        `<body>`-placed variant fails domain verification even when the
        snippet is present in view-source. `afterInteractive` also fails
        because it can inject client-side after hydration, which a
        non-JS crawler never sees.
      */}
      {/*
        Explicit `<head>` wrapper so we can place a raw `<script>` inside
        it — Next.js App Router only auto-hoists `<link>` / `<meta>` etc.
        to `<head>`; bare `<script>` tags at the `<html>` root end up in
        `<body>`. Trustpilot's verifier crawler ONLY inspects `<head>`
        contents for the raw `tp('register', ...)` call, and rejects the
        Next.js Script-component wrapper (which stringifies the payload
        into `(self.__next_s).push([...])` — the register call is inside
        a JSON string, not an executable pattern the crawler matches).
      */}
      {trustpilotInviteId ? (
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,r,n){w.TrustpilotObject=n;w[n]=w[n]||function(){(w[n].q=w[n].q||[]).push(arguments)};a=d.createElement(s);a.async=1;a.src=r;a.type='text/java'+s;f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(a,f)})(window,document,'script','https://invitejs.trustpilot.com/tp.min.js','tp');tp('register', '${trustpilotInviteId}');`,
            }}
          />
        </head>
      ) : null}
      <body className="min-h-screen bg-[var(--color-background)] font-sans text-[var(--color-foreground)] antialiased">
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
