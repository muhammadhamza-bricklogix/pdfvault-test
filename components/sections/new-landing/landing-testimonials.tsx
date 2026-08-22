import Script from "next/script";

import { SectionHeading } from "./section-heading";

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

            The Micro TrustScore template renders at a fixed internal
            size; Trustpilot's own CSS caps the layout at ~20px tall.
            `transform: scale(...)` on the outer wrapper makes the whole
            widget visually larger without breaking its interactivity.
            Because a transform doesn't reserve layout space, we set an
            explicit inline height on the wrapper so the surrounding
            section spacing accounts for the scaled size (otherwise the
            "Frequently Asked Questions" section below would overlap).
          */}
          <div
            className="origin-center scale-[1.35] sm:scale-[1.7]"
            style={{ height: 44, width: "min(480px, 100%)" }}
          >
            <div
              className="trustpilot-widget"
              data-businessunit-id="6a5635cc9545fd0a55b8cee6"
              data-locale="en-US"
              data-style-height="30px"
              data-style-width="100%"
              data-template-id="5419b637fa0340045cd0c936"
              data-token="dc81dabd-6956-4355-88a6-3004f4c39da3"
            >
              <a
                href="https://www.trustpilot.com/review/pdfvault.ai"
                rel="noopener"
                target="_blank"
              >
                Trustpilot
              </a>
            </div>
          </div>
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
        src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
        strategy="afterInteractive"
      />
    </section>
  );
}
