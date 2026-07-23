import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";

import { ClerkProvider } from "@clerk/nextjs";
import { Dancing_Script, Playfair_Display } from "next/font/google";
import Script from "next/script";

import { WeglotLoader } from "@/components/shared/navigation/weglot-loader";

import { Providers } from "./providers";

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

export const metadata: Metadata = {
  title: {
    default: "pdfvault.ai",
    template: "%s | pdfvault.ai",
  },
  description:
    "pdfvault.ai is a cloud-based PDF tools platform currently being built as a focused, single-page frontend foundation.",
  icons: {
    apple: "/PDFVault_stacked_layers.png",
    icon: "/PDFVault_stacked_layers.png",
    shortcut: "/PDFVault_stacked_layers.png",
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
      className={`${dancingScript.variable} ${playfairDisplay.variable}`}
      lang="en"
    >
      {/*
        Read the persisted Weglot language as early as possible (before the
        page becomes interactive) so WeglotLoader can switch to it
        immediately after initialization. This minimizes the English flash
        on first load and keeps the chosen language when the browser drops
        Weglot's own cookie across route groups.
      */}
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
              enableSystem: true,
            }}
          >
            {children}
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
