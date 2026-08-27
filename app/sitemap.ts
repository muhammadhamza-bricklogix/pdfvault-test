import type { MetadataRoute } from "next";

const BASE_URL = "https://pdfvault.ai";

const CONVERT_TOOLS = [
  "pdf-to-word",
  "pdf-to-excel",
  "pdf-to-ppt",
  "pdf-to-jpg",
  "word-to-pdf",
  "excel-to-pdf",
  "ppt-to-pdf",
  "jpg-to-pdf",
  "png-to-pdf",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { changeFrequency: "weekly", priority: 1, url: BASE_URL },
    { changeFrequency: "monthly", priority: 0.8, url: `${BASE_URL}/about` },
    { changeFrequency: "weekly", priority: 0.9, url: `${BASE_URL}/all-tools` },
    { changeFrequency: "monthly", priority: 0.7, url: `${BASE_URL}/pricing` },
    { changeFrequency: "monthly", priority: 0.5, url: `${BASE_URL}/contact` },
    { changeFrequency: "monthly", priority: 0.4, url: `${BASE_URL}/privacy` },
    {
      changeFrequency: "monthly",
      priority: 0.4,
      url: `${BASE_URL}/terms-and-conditions`,
    },
    {
      changeFrequency: "monthly",
      priority: 0.4,
      url: `${BASE_URL}/refund-policy`,
    },
    {
      changeFrequency: "monthly",
      priority: 0.4,
      url: `${BASE_URL}/subscription-terms`,
    },
    { changeFrequency: "monthly", priority: 0.3, url: `${BASE_URL}/cookies` },
    {
      changeFrequency: "monthly",
      priority: 0.3,
      url: `${BASE_URL}/do-not-sell`,
    },
  ];

  const convertRoutes: MetadataRoute.Sitemap = CONVERT_TOOLS.map((tool) => ({
    changeFrequency: "monthly" as const,
    priority: 0.8,
    url: `${BASE_URL}/convert/${tool}`,
  }));

  return [...staticRoutes, ...convertRoutes];
}
