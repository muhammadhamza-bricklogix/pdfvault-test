import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";

import { ClerkProvider } from "@clerk/nextjs";
import { Dancing_Script } from "next/font/google";

const dancingScript = Dancing_Script({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-dancing-script",
  weight: ["400", "700"],
});

import { SiteNavbar } from "@/components/shared/navigation/site-navbar";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "PDFForge",
    template: "%s | PDFForge",
  },
  description:
    "PDFForge is a cloud-based PDF tools platform currently being built as a focused, single-page frontend foundation.",
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
    <html suppressHydrationWarning className={dancingScript.variable} lang="en">
      <body className="min-h-screen font-sans antialiased">
        <ClerkProvider>
          <Providers
            themeProps={{
              attribute: "data-theme",
              defaultTheme: "system",
              enableSystem: true,
            }}
          >
            <div className="flex min-h-screen flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
              <SiteNavbar />
              <main className="mx-auto flex w-full max-w-7xl flex-1 px-6 py-10 sm:px-8 sm:py-12">
                {children}
              </main>
            </div>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
