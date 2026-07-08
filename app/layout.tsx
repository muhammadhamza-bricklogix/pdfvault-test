import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";

import { ClerkProvider } from "@clerk/nextjs";
import { Dancing_Script, Playfair_Display } from "next/font/google";

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
    default: "PDFedits.io",
    template: "%s | PDFedits.io",
  },
  description:
    "PDFedits.io is a cloud-based PDF tools platform currently being built as a focused, single-page frontend foundation.",
  icons: {
    apple: "/logo.svg",
    icon: "/logo.svg",
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
      <body className="min-h-screen bg-[var(--color-background)] font-sans text-[var(--color-foreground)] antialiased">
        <WeglotLoader />
        <ClerkProvider
          signInFallbackRedirectUrl="/dashboard"
          signInUrl="/login"
          signUpFallbackRedirectUrl="/dashboard"
          signUpUrl="/signup"
        >
          <Providers
            themeProps={{
              attribute: "data-theme",
              defaultTheme: "system",
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
