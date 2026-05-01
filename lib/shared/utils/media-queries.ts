import {
  BREAKPOINTS_PX,
  type BreakpointKey,
} from "@/lib/shared/constants/breakpoints";

/**
 * Subtracted from a `min-width` boundary to build a non-overlapping
 * `max-width` query. Mirrors Bootstrap's approach and avoids the inclusive
 * edge case where `(max-width: 1024px)` and `(min-width: 1024px)` both match
 * at exactly 1024px.
 */
const BOUNDARY_OFFSET_PX = 0.02;

/** Build a `(max-width: ...)` query that ends just below the given breakpoint. */
export const mediaBelow = (key: BreakpointKey): string =>
  `(max-width: ${BREAKPOINTS_PX[key] - BOUNDARY_OFFSET_PX}px)`;

/** Default media query for "mobile/tablet" — anything narrower than `lg`. */
export const MOBILE_MEDIA_QUERY = mediaBelow("lg");
