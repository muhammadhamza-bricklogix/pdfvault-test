"use client";

import type { CSSProperties } from "react";

import { useEffect, useRef, useState } from "react";

/**
 * Trustpilot widget host with a shimmer skeleton overlay.
 *
 * The Trustpilot bootstrap script (`tp.widget.bootstrap.min.js`,
 * loaded once at the page level) scans for `.trustpilot-widget`
 * divs and injects an `<iframe>` populated from Trustpilot's CDN.
 * That download + injection typically takes 300–1500 ms on a cold
 * cache, during which the div is empty and the layout looks broken.
 *
 * This component reserves the widget's final footprint, paints a
 * shimmer skeleton behind the div, and swaps the skeleton out once
 * the iframe appears (MutationObserver + a defensive interval, since
 * Trustpilot's script sometimes replaces the entire node subtree).
 */
type TrustpilotWidgetProps = {
  businessUnitId: string;
  locale: string;
  templateId: string;
  token: string;
  styleHeight: string;
  styleWidth: string;
  reviewUrl: string;
  /** Reserved skeleton box in px — should match the widget's rendered height. */
  skeletonHeight: number;
  /** Optional max width for the outer wrapper (matches previous inline style caps). */
  maxWidth?: number | string;
  className?: string;
  style?: CSSProperties;
};

export function TrustpilotWidget({
  businessUnitId,
  locale,
  templateId,
  token,
  styleHeight,
  styleWidth,
  reviewUrl,
  skeletonHeight,
  maxWidth,
  className,
  style,
}: TrustpilotWidgetProps) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const node = widgetRef.current;

    if (!node) return;

    const isReady = () => node.querySelector("iframe") !== null;

    if (isReady()) {
      setLoaded(true);

      return;
    }

    const observer = new MutationObserver(() => {
      if (isReady()) {
        setLoaded(true);
        observer.disconnect();
        window.clearInterval(pollId);
      }
    });

    observer.observe(node, { childList: true, subtree: true });

    // Defensive poll — Trustpilot's script occasionally swaps the
    // node subtree in a way MutationObserver misses on first paint.
    const pollId = window.setInterval(() => {
      if (isReady()) {
        setLoaded(true);
        observer.disconnect();
        window.clearInterval(pollId);
      }
    }, 300);

    // Hard timeout so the skeleton never spins forever on a widget
    // outage — after 8 s we hide it and let the fallback link show.
    const timeoutId = window.setTimeout(() => {
      setLoaded(true);
      observer.disconnect();
      window.clearInterval(pollId);
    }, 8000);

    return () => {
      observer.disconnect();
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  const wrapperStyle: CSSProperties = {
    ...(maxWidth !== undefined ? { maxWidth, width: "100%" } : null),
    ...style,
  };

  return (
    <div className={`relative ${className ?? ""}`.trim()} style={wrapperStyle}>
      {!loaded ? (
        <div
          aria-hidden
          className="pv-tp-skeleton pointer-events-none absolute inset-0 rounded-md"
          style={{ height: skeletonHeight }}
        />
      ) : null}
      <div
        ref={widgetRef}
        className="trustpilot-widget"
        data-businessunit-id={businessUnitId}
        data-locale={locale}
        data-style-height={styleHeight}
        data-style-width={styleWidth}
        data-template-id={templateId}
        data-token={token}
        style={{ minHeight: skeletonHeight }}
      >
        <a href={reviewUrl} rel="noopener" target="_blank">
          Trustpilot
        </a>
      </div>
    </div>
  );
}
