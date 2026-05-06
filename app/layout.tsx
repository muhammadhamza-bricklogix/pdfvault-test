import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";

import { ClerkProvider } from "@clerk/nextjs";
import { Dancing_Script, Playfair_Display } from "next/font/google";

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

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "PDFedits",
    template: "%s | PDFedits",
  },
  description:
    "PDFedits is a cloud-based PDF tools platform currently being built as a focused, single-page frontend foundation.",
  icons: {
    icon: "/favicon.ico",
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
        <ClerkProvider>
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
