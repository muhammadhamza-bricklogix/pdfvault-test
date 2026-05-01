/**
 * Breakpoint pixel values, kept in sync with Tailwind v4's default screen
 * scale so runtime checks (e.g. `matchMedia`) align with our Tailwind
 * utility classes.
 *
 * @see https://tailwindcss.com/docs/responsive-design
 */
export const BREAKPOINTS_PX = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS_PX;
