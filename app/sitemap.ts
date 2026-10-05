import type { MetadataRoute } from "next";

import {
  DEFAULT_LOCALE,
  type Locale,
  SUPPORTED_LOCALES,
} from "@/lib/shared/constants/locale-map";

const BASE_URL = "https://pdfvault.ai";

// Excel + PowerPoint routes hidden from the sitemap 2026-08-28 while
// the corresponding conversion pipelines are parked. Do not remove;
// re-enable by uncommenting once the tools ship.
const CONVERT_TOOLS = [
  "pdf-to-word",
  // "pdf-to-excel",
  // "pdf-to-ppt",
  "pdf-to-jpg",
  "word-to-pdf",
  // "excel-to-pdf",
  // "ppt-to-pdf",
  "jpg-to-pdf",
  "png-to-pdf",
];

// Tool landing pages under app/(landing)/. Each has a locale variant
// at pdfvault.ai/<locale>/<slug> served by the middleware rewrite.
const TOOL_SLUGS = [
  "edit",
  "compress",
  "delete-pages",
  "extract-images",
  "organize-pdf",
  "password-protect-pdf",
  "remove-annotations",
  "rotate-pdf",
  "sign-pdf",
  "split-pdf",
  "unlock-pdf",
  "watermark-pdf",
];

/**
 * Info + legal pages. Priority stays low so tool pages dominate the
 * ranking budget, but each locale variant is still listed so Google
 * indexes the localized version.
 */
type StaticRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
};

const STATIC_ROUTES: StaticRoute[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/all-tools", changeFrequency: "weekly", priority: 0.9 },
  { path: "/forms/w-9", changeFrequency: "monthly", priority: 0.8 },
  { path: "/forms/1099-nec", changeFrequency: "monthly", priority: 0.8 },
  { path: "/forms/ds-11", changeFrequency: "monthly", priority: 0.8 },
  { path: "/forms/ds-82", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.4 },
  { path: "/terms-and-conditions", changeFrequency: "monthly", priority: 0.4 },
  { path: "/refund-policy", changeFrequency: "monthly", priority: 0.4 },
  { path: "/subscription-terms", changeFrequency: "monthly", priority: 0.4 },
  { path: "/cookies", changeFrequency: "monthly", priority: 0.3 },
  { path: "/do-not-sell", changeFrequency: "monthly", priority: 0.3 },
];

function localeUrl(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return `${BASE_URL}${path || "/"}`;

  return `${BASE_URL}/${locale}${path}`;
}

/**
 * Reciprocal + self-referencing hreflang map for a given app path
 * (locale-agnostic, e.g. `/edit`). Emits every locale plus
 * `x-default` = EN root.
 */
function localeAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {
    "x-default": localeUrl(DEFAULT_LOCALE, path),
  };

  for (const locale of SUPPORTED_LOCALES) {
    languages[locale] = localeUrl(locale, path);
  }

  return languages;
}

function emitPerLocale(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  priority: number,
): MetadataRoute.Sitemap {
  const languages = localeAlternates(path);

  return SUPPORTED_LOCALES.map((locale) => ({
    changeFrequency,
    priority,
    url: localeUrl(locale, path),
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = STATIC_ROUTES.flatMap((route) =>
    emitPerLocale(route.path, route.changeFrequency, route.priority),
  );

  const toolEntries = TOOL_SLUGS.flatMap((slug) =>
    emitPerLocale(`/${slug}`, "monthly", 0.9),
  );

  const convertEntries = CONVERT_TOOLS.flatMap((tool) =>
    emitPerLocale(`/convert/${tool}`, "monthly", 0.8),
  );

  return [...staticEntries, ...toolEntries, ...convertEntries];
}
