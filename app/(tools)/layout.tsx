import {
  Allura,
  Dancing_Script,
  Great_Vibes,
  Pacifico,
  Sacramento,
} from "next/font/google";

import { ToolsFontBodyEffect } from "./tools-font-body-effect";

/**
 * Route-group layout for `(tools)/*` — loads the five signature-tab
 * fonts consumed by `<SignatureModal />` (Dancing Script, Great Vibes,
 * Allura, Sacramento, Pacifico). Scoped here (not root `app/layout.tsx`)
 * so landing / marketing pages don't fetch these unused woff2 files on
 * every visit — was measurably hurting landing LCP + total bandwidth
 * (2026-08-30).
 *
 * `next/font/google` handles the `<link rel="preload">` + inline
 * `@font-face` injection for us; we just need to attach each font's
 * `.variable` class somewhere in the DOM tree so the CSS custom
 * property (`--font-great-vibes`, etc.) is available to the
 * `SignatureModal` type-picker. Applying to the wrapper `<div>`
 * scopes the variables to this subtree — landing DOM never sees
 * them, but every tools page (pdf-composer, w-9-form, forms/*) does.
 *
 * `display: swap` matches the original root-layout config so the
 * signature preview canvas renders with a fallback until the
 * webfont paints.
 */
const dancingScript = Dancing_Script({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-dancing-script",
  weight: ["400", "700"],
});

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

export default function ToolsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const variableClasses = `${dancingScript.variable} ${greatVibes.variable} ${allura.variable} ${sacramento.variable} ${pacifico.variable}`;

  return (
    <div className={`contents ${variableClasses}`}>
      {/* Mirror the same variable classes onto document.body so HeroUI
          / React Aria portals (SignatureModal, etc.) can resolve the
          `--font-*` custom properties. Portals render outside the
          wrapper `<div>` and would otherwise fall back to the default
          sans (QA 2026-09-07: only Dancing Script rendered because
          it's the only value the `:root` global fallback covers). */}
      <ToolsFontBodyEffect classNames={variableClasses} />
      {children}
    </div>
  );
}
