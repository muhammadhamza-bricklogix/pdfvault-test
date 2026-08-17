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
