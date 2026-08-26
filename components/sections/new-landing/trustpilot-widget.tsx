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
 *
 * Module-scope cache: once the iframe is rendered, we snapshot its DOM
 * on unmount and re-attach it on the next mount (SPA navigation return),
 * so the skeleton doesn't re-flash for 300–1500 ms every visit.
 */
type CachedWidget = { nodes: ChildNode[] };
const widgetCache = new Map<string, CachedWidget>();

const hasIframe = (nodes: readonly ChildNode[]) =>
  nodes.some(
    (n) =>
      n.nodeName === "IFRAME" ||
      (n.nodeType === 1 && (n as Element).querySelector("iframe") !== null),
  );

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
  /** When true, drops the fallback anchor AND blocks clicks on the injected iframe so nothing redirects to Trustpilot. */
  disableLink?: boolean;
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
  disableLink = false,
  className,
  style,
}: TrustpilotWidgetProps) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const cacheKey = `${templateId}|${businessUnitId}|${locale}|${token}|${styleHeight}|${styleWidth}`;
  const [loaded, setLoaded] = useState(() => {
    const entry = widgetCache.get(cacheKey);

    return entry ? hasIframe(entry.nodes) : false;
  });

  useEffect(() => {
    const node = widgetRef.current;

    if (!node) return;

    const isReady = () => node.querySelector("iframe") !== null;

    // Cache hit — re-attach the previously rendered iframe DOM into the
    // fresh widget div. The iframe stays live across the move in
    // Chromium/WebKit (same-document appendChild), so no reload happens
    // and the widget appears instantly on route return.
    const cached = widgetCache.get(cacheKey);

    if (cached && hasIframe(cached.nodes)) {
      while (node.firstChild) node.removeChild(node.firstChild);
      for (const child of cached.nodes) node.appendChild(child);

      return () => {
        widgetCache.set(cacheKey, { nodes: Array.from(node.childNodes) });
      };
    }

    if (isReady()) {
      return () => {
        widgetCache.set(cacheKey, { nodes: Array.from(node.childNodes) });
      };
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
      if (isReady()) {
        widgetCache.set(cacheKey, { nodes: Array.from(node.childNodes) });
      }
    };
  }, [cacheKey]);

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
        className={`trustpilot-widget${disableLink ? " pointer-events-none" : ""}`}
        data-businessunit-id={businessUnitId}
        data-locale={locale}
        data-style-height={styleHeight}
        data-style-width={styleWidth}
        data-template-id={templateId}
        data-token={token}
        style={{ minHeight: skeletonHeight }}
      >
        {disableLink ? (
          <span>Trustpilot</span>
        ) : (
          <a href={reviewUrl} rel="noopener" target="_blank">
            Trustpilot
          </a>
        )}
      </div>
    </div>
  );
}
