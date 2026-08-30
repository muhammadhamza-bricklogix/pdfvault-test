import Script from "next/script";

import { SectionHeading } from "./section-heading";
import { TrustpilotWidget } from "./trustpilot-widget";

/**
 * Landing-page testimonial section — powered by a Trustpilot TrustBox
 * widget. Trustpilot's bootstrap script (`tp.widget.bootstrap.min.js`)
 * finds every `.trustpilot-widget` div on the page and populates it
 * with reviews pulled live from Trustpilot's CDN, so nothing here
 * queries an API or ships static review data.
 *
 * Template + business-unit IDs are the values Trustpilot generated in
 * Share & promote → Widgets. Both are public (they ship in the HTML
 * to every visitor), so hardcoding is fine — no env-var indirection.
 *
 * The `data-token` value is Trustpilot's per-widget install token, also
 * public. If we ever regenerate the widget (different template, extra
 * anti-abuse settings) Trustpilot issues a new one — update it here.
 */
export function LandingTestimonials() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="bg-white pt-20 pb-6 sm:pt-24 sm:pb-8"
    >
      <div className="pv-container">
        <SectionHeading
          title={
            <span id="testimonials-heading">
              See what people are saying about PDFVault.
            </span>
          }
        />

        <div className="mt-10 flex justify-center">
          {/*
            TrustBox div — Trustpilot's bootstrap script mutates this
            container on load and injects the live widget. Don't add
            children here beyond the fallback link required by TrustBox
            (it renders when JS is disabled or the CDN is unreachable).

            The Mini template renders natively at 150px tall — no CSS
            scale hacks needed. Container is capped so the widget sits
            centered under the heading instead of stretching edge-to-
            edge on wide viewports.
          */}
          <TrustpilotWidget
            businessUnitId="6a5635cc9545fd0a55b8cee6"
            locale="en-US"
            maxWidth={320}
            reviewUrl="https://www.trustpilot.com/review/pdfvault.ai"
            skeletonHeight={150}
            styleHeight="150px"
            styleWidth="100%"
            templateId="53aa8807dec7e10d38f59f32"
            token="c01f8854-2bd8-4b15-a02b-506a0cab7737"
          />
        </div>
      </div>

      {/*
        Bootstrap script that scans for `.trustpilot-widget` divs and
        renders them. `afterInteractive` is fine — the widget renders
        client-side and doesn't need to be in initial HTML (unlike the
        AFS invite loader in root layout, which is a crawler probe).
      */}
      <Script
        async
        id="trustpilot-bootstrap"
        src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
        strategy="lazyOnload"
      />
    </section>
  );
}
