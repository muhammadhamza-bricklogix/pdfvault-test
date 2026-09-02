/// <reference types="bun" />
import { beforeAll, describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

import {
  COUNTRY_TO_LOCALE,
  DEFAULT_LOCALE,
  PREFIXED_LOCALES,
  resolveLocaleFromCountry,
} from "@/lib/shared/constants/locale-map";

// CloudFront Function ships as CJS to satisfy the CloudFront JS 2.0
// runtime. Load it via `createRequire` so the CJS `module.exports`
// shape works inside the Bun ESM test harness.
const require = createRequire(import.meta.url);
const geo = require("../../infra/cloudfront-functions/geo-redirect.js") as {
  handler: (event: CloudFrontEvent) => CloudFrontRequest | CloudFrontResponse;
  _internal: {
    setEnabled: (value: boolean) => void;
    isEnabled: () => boolean;
  };
};

type CloudFrontHeader = { value: string };
type CloudFrontCookie = { value: string; attributes?: string };
type CloudFrontRequest = {
  uri: string;
  querystring?: string;
  method?: string;
  headers: Record<string, CloudFrontHeader>;
  cookies: Record<string, CloudFrontCookie>;
};
type CloudFrontResponse = {
  statusCode: number;
  statusDescription: string;
  headers: Record<string, CloudFrontHeader>;
  cookies?: Record<string, CloudFrontCookie>;
};
type CloudFrontEvent = { request: CloudFrontRequest };

function makeRequest(overrides: Partial<CloudFrontRequest> = {}) {
  return {
    uri: "/",
    querystring: "",
    method: "GET",
    headers: {},
    cookies: {},
    ...overrides,
  } satisfies CloudFrontRequest;
}

function invoke(
  overrides: Partial<CloudFrontRequest> = {},
): CloudFrontRequest | CloudFrontResponse {
  return geo.handler({ request: makeRequest(overrides) });
}

function isResponse(
  result: CloudFrontRequest | CloudFrontResponse,
): result is CloudFrontResponse {
  return (result as CloudFrontResponse).statusCode !== undefined;
}

beforeAll(() => {
  geo._internal.setEnabled(true);
});

describe("locale-map constants", () => {
  test("EN is the default", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  test("all mapped values are supported prefixed locales OR EN", () => {
    const allowed = new Set([...PREFIXED_LOCALES, DEFAULT_LOCALE]);

    for (const country of Object.keys(COUNTRY_TO_LOCALE)) {
      expect(allowed.has(COUNTRY_TO_LOCALE[country])).toBe(true);
    }
  });

  test("Gulf countries currently map to EN pending RTL sign-off", () => {
    const gulf = ["SA", "AE", "EG", "JO", "KW", "QA", "BH", "OM", "IQ", "LB"];

    for (const country of gulf) {
      expect(resolveLocaleFromCountry(country)).toBe("en");
    }
  });

  test("resolveLocaleFromCountry falls back to EN for unknown countries", () => {
    expect(resolveLocaleFromCountry("JP")).toBe("en");
    expect(resolveLocaleFromCountry(null)).toBe("en");
    expect(resolveLocaleFromCountry(undefined)).toBe("en");
    expect(resolveLocaleFromCountry("")).toBe("en");
  });
});

describe("CloudFront geo-redirect handler", () => {
  test("kill switch off = always pass through", () => {
    geo._internal.setEnabled(false);
    const result = invoke({
      uri: "/",
      headers: { "cloudfront-viewer-country": { value: "DE" } },
    });

    expect(isResponse(result)).toBe(false);
    geo._internal.setEnabled(true);
  });

  test("DE IP on / issues 302 to /de with lang_pref cookie + no-store", () => {
    const result = invoke({
      uri: "/",
      headers: { "cloudfront-viewer-country": { value: "DE" } },
    });

    expect(isResponse(result)).toBe(true);
    if (!isResponse(result)) return;
    expect(result.statusCode).toBe(302);
    expect(result.headers.location.value).toBe("/de");
    expect(result.headers["cache-control"].value).toBe("no-store");
    expect(result.cookies?.lang_pref?.value).toBe("de");
  });

  test("FR IP on /edit issues 302 to /fr/edit", () => {
    const result = invoke({
      uri: "/edit",
      headers: { "cloudfront-viewer-country": { value: "FR" } },
    });

    expect(isResponse(result)).toBe(true);
    if (!isResponse(result)) return;
    expect(result.statusCode).toBe(302);
    expect(result.headers.location.value).toBe("/fr/edit");
  });

  test("US IP on / passes through (EN root, no redirect)", () => {
    const result = invoke({
      uri: "/",
      headers: { "cloudfront-viewer-country": { value: "US" } },
    });

    expect(isResponse(result)).toBe(false);
  });

  test("Locale-prefixed URL is never redirected even from a foreign country", () => {
    const result = invoke({
      uri: "/de/edit",
      headers: { "cloudfront-viewer-country": { value: "US" } },
    });

    expect(isResponse(result)).toBe(false);
  });

  test("lang_pref cookie overrides geo header", () => {
    const result = invoke({
      uri: "/",
      headers: { "cloudfront-viewer-country": { value: "DE" } },
      cookies: { lang_pref: { value: "fr" } },
    });

    expect(isResponse(result)).toBe(true);
    if (!isResponse(result)) return;
    expect(result.statusCode).toBe(302);
    expect(result.headers.location.value).toBe("/fr");
  });

  test("lang_pref = en on DE IP stays on EN root (no redirect)", () => {
    const result = invoke({
      uri: "/",
      headers: { "cloudfront-viewer-country": { value: "DE" } },
      cookies: { lang_pref: { value: "en" } },
    });

    expect(isResponse(result)).toBe(false);
  });

  test("Googlebot from DE IP is never redirected", () => {
    const result = invoke({
      uri: "/",
      headers: {
        "cloudfront-viewer-country": { value: "DE" },
        "user-agent": { value: "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      },
    });

    expect(isResponse(result)).toBe(false);
  });

  test("Bingbot from DE IP is never redirected", () => {
    const result = invoke({
      uri: "/edit",
      headers: {
        "cloudfront-viewer-country": { value: "DE" },
        "user-agent": {
          value: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
        },
      },
    });

    expect(isResponse(result)).toBe(false);
  });

  test("robots.txt passes through even for DE IP", () => {
    const result = invoke({
      uri: "/robots.txt",
      headers: { "cloudfront-viewer-country": { value: "DE" } },
    });

    expect(isResponse(result)).toBe(false);
  });

  test("sitemap.xml passes through even for DE IP", () => {
    const result = invoke({
      uri: "/sitemap.xml",
      headers: { "cloudfront-viewer-country": { value: "DE" } },
    });

    expect(isResponse(result)).toBe(false);
  });

  test("API routes pass through", () => {
    const result = invoke({
      uri: "/api/documents/upload",
      headers: { "cloudfront-viewer-country": { value: "DE" } },
    });

    expect(isResponse(result)).toBe(false);
  });

  test("Next.js internals pass through", () => {
    const result = invoke({
      uri: "/_next/static/chunks/main.js",
      headers: { "cloudfront-viewer-country": { value: "DE" } },
    });

    expect(isResponse(result)).toBe(false);
  });

  test("Auth entry pages are exempt (never geo-redirected)", () => {
    const authPaths = [
      "/sign-in",
      "/sign-up",
      "/login",
      "/signup",
      "/forgot-password",
    ];

    for (const uri of authPaths) {
      const result = invoke({
        uri,
        headers: { "cloudfront-viewer-country": { value: "DE" } },
      });

      expect(isResponse(result)).toBe(false);
    }
  });

  test("Clerk callbacks are exempt", () => {
    const callbackPaths = ["/oauth-callback", "/sso-callback"];

    for (const uri of callbackPaths) {
      const result = invoke({
        uri,
        headers: { "cloudfront-viewer-country": { value: "DE" } },
      });

      expect(isResponse(result)).toBe(false);
    }
  });

  test("Authenticated content routes are exempt from geo-redirect", () => {
    const authedPaths = [
      "/dashboard",
      "/dashboard/settings/billing",
      "/pdf-composer",
      "/pdf-composer?id=abc123",
      "/pdf-editor",
      "/w-9-form",
      "/w9-form",
      "/forms/w-9",
      "/share/some-token",
    ];

    for (const uri of authedPaths) {
      const [path, querystring] = uri.split("?");
      const result = invoke({
        uri: path,
        querystring: querystring ?? "",
        headers: { "cloudfront-viewer-country": { value: "DE" } },
      });

      expect(isResponse(result)).toBe(false);
    }
  });

  test("Query string is preserved on redirect", () => {
    const result = invoke({
      uri: "/edit",
      querystring: "id=abc123&fresh=1",
      headers: { "cloudfront-viewer-country": { value: "DE" } },
    });

    expect(isResponse(result)).toBe(true);
    if (!isResponse(result)) return;
    expect(result.headers.location.value).toBe("/de/edit?id=abc123&fresh=1");
  });

  test("Every country in the map produces a valid redirect target", () => {
    for (const country of Object.keys(COUNTRY_TO_LOCALE)) {
      const expected = COUNTRY_TO_LOCALE[country];
      const result = invoke({
        uri: "/",
        headers: { "cloudfront-viewer-country": { value: country } },
      });

      if (expected === "en") {
        expect(isResponse(result)).toBe(false);
      } else {
        expect(isResponse(result)).toBe(true);
        if (!isResponse(result)) continue;
        expect(result.statusCode).toBe(302);
        expect(result.headers.location.value).toBe(`/${expected}`);
      }
    }
  });
});
