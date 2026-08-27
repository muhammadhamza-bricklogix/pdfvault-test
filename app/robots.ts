import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Public marketing routes — allow indexing.
        allow: [
          "/",
          "/about",
          "/all-tools",
          "/pricing",
          "/contact",
          "/privacy",
          "/terms-and-conditions",
          "/refund-policy",
          "/subscription-terms",
          "/cookies",
          "/do-not-sell",
          "/convert/",
        ],
        // App, auth, and share routes — keep private.
        disallow: [
          "/dashboard/",
          "/pdf-editor",
          "/pdf-composer",
          "/sign-in",
          "/sign-up",
          "/share/",
          "/api/",
        ],
        userAgent: "*",
      },
    ],
    sitemap: "https://pdfvault.ai/sitemap.xml",
  };
}
