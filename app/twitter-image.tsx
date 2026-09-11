/**
 * Twitter card image — reuses the same design as `opengraph-image.tsx`
 * so the branded thumbnail is identical across Twitter/X and every
 * other platform. Twitter uses the `summary_large_image` card (set in
 * `app/layout.tsx → metadata.twitter.card`), which shares the 1200×630
 * aspect ratio with Open Graph, so no separate render is needed.
 */

export { default, alt, size, contentType, runtime } from "./opengraph-image";
