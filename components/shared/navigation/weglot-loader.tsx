"use client";

import Script from "next/script";

const WEGLOT_API_KEY = process.env.NEXT_PUBLIC_WEGLOT_API_KEY ?? "";

export function WeglotLoader() {
  return (
    <Script
      src="https://cdn.weglot.com/weglot.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        window.Weglot.initialize({
          api_key: WEGLOT_API_KEY,
          originalLanguage: "en",
          destinationLanguages: "es",
        });
        window.dispatchEvent(new CustomEvent("weglot:initialized"));
      }}
    />
  );
}
