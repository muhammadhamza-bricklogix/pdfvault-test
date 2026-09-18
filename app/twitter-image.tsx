/**
 * Twitter card image — reuses the same rendered component as
 * `opengraph-image.tsx` so the branded thumbnail is identical across
 * Twitter/X and every other platform. Twitter uses the
 * `summary_large_image` card (set in `app/layout.tsx →
 * metadata.twitter.card`), which shares the 1200×630 aspect ratio
 * with Open Graph, so no separate render is needed.
 *
 * Route Segment Config fields (`runtime`, `alt`, `size`, `contentType`)
 * must be DECLARED INLINE per Next's file-based metadata convention —
 * re-exporting them from another module throws a compile error. So we
 * duplicate the constants and re-export only the default component.
 */

export { default } from "./opengraph-image";

export const runtime = "nodejs";
export const alt = "PDFVault — PDF tools that work";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
