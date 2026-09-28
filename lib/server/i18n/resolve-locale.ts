import { cookies, headers } from "next/headers";

import {
  LANG_PREF_COOKIE,
  parseLocalePrefix,
  SUPPORTED_LOCALES,
} from "@/lib/shared/constants/locale-map";

/**
 * Server-side locale resolver used by tool pages (composer, W-9, etc.)
 * that render outside the `/de/`, `/fr/`, `/es/`, `/pt/`, `/ar/`
 * subdirectory tree. These routes always sit at bare paths like
 * `/pdf-composer`, so client-side `usePathname()` cannot infer the
 * user's locale and the composer previously flashed English on the
 * first paint before re-rendering from the `lang_pref` cookie
 * (QA F-63 2026-09).
 *
 * Resolution order (matches `ComposerI18nProvider` verbatim):
 *   1. URL `x-next-pathname` header locale prefix (`/de/tool` → "de").
 *      Middleware forwards the original path here; the app router
 *      route is always `/pdf-composer`, but the request URL may still
 *      have been `/de/pdf-composer` on the CDN edge.
 *   2. `lang_pref` cookie (set by middleware + LangPrefHonor on every
 *      locale-prefixed visit).
 *   3. `"en"` default.
 *
 * Returns a plain string so the caller can pass it directly through a
 * client boundary as a serialisable prop. Never throws — a missing
 * `next/headers` context degrades to `"en"`.
 */
export async function resolveComposerLocale(): Promise<string> {
  try {
    const hdrs = await headers();
    const pathname =
      hdrs.get("x-next-pathname") ??
      hdrs.get("x-invoke-path") ??
      hdrs.get("x-pathname") ??
      "/";
    const parsed = parseLocalePrefix(pathname);

    if (parsed) return parsed.locale;

    const cookieStore = await cookies();
    const langCookie = cookieStore.get(LANG_PREF_COOKIE)?.value;

    if (
      langCookie &&
      langCookie !== "en" &&
      (SUPPORTED_LOCALES as readonly string[]).includes(langCookie)
    ) {
      return langCookie;
    }
  } catch {
    // Some runtimes (edge or streaming) can throw during
    // headers()/cookies() reads. Falling through to "en" is safe —
    // the client-side provider will still re-resolve on hydrate.
  }

  return "en";
}
