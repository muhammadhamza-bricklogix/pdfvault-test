export const footerShellClass =
  "border-t border-default-200/80 bg-transparent dark:border-default-100/20";

export const footerInnerContainerClass =
  "px-6 pb-4 pt-14 sm:px-10 sm:pb-5 sm:pt-16";

export const footerAsideColumnTitleClass =
  "flex flex-col gap-2 text-lg font-bold tracking-tight text-[var(--color-accent)]";

export const footerSubsectionIconWrapClass =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-sm";

export const footerSubsectionHeadingClass =
  "text-lg font-bold tracking-tight text-[var(--color-accent)]";

export const footerSubsectionTitleStackClass = "flex flex-col gap-2";

export const footerLinkClass =
  "text-base font-medium leading-tight text-[var(--color-foreground)] transition-colors hover:text-[var(--color-accent)]";

export const footerLinkViewAllClass =
  "text-base font-medium leading-tight text-blue-600 underline decoration-blue-600/70 underline-offset-2 transition-colors hover:text-blue-700 dark:text-blue-400 dark:decoration-blue-400/70 dark:hover:text-blue-300";

/** One row on large screens: three product columns + Help + Account. */
export const footerMainColumnsGridClass =
  "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-5 lg:items-start lg:gap-x-4 lg:gap-y-0 xl:gap-x-6";

export const footerLinkColumnListClass = "mt-2 space-y-1";

export const footerLegalStripBlockClass =
  "mt-8 border-t border-default-200/80 pt-6 text-center text-sm leading-snug text-default-600 dark:text-default-400 sm:text-base";

export const footerLegalStripLinkClass =
  "font-medium text-default-800 underline-offset-[3px] hover:underline dark:text-default-200";

export const footerPostCopyrightNavClass =
  "mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-default-700 dark:text-default-300 sm:text-base";

export const footerAffiliationDisclaimerClass =
  "mx-auto mt-4 max-w-[min(100%,90rem)] text-center text-default-500 dark:text-default-500";

export const footerAffiliationDisclaimerTextClass =
  "m-0 text-pretty text-xs leading-snug text-default-500 dark:text-default-500 sm:text-[13px] sm:leading-snug md:text-sm";

export const footerPaymentStripClass =
  "mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-default-200/80 pb-0 pt-6";

/** Uniform slot for payment marks — same box for every brand. */
export const footerPaymentLogoSlotClass =
  "flex h-12 w-20 shrink-0 items-center justify-center sm:h-14 sm:w-24";

/**
 * Each SVG is constrained to the slot via max-w/max-h:full + object-contain so
 * every brand mark renders inside an identical box. Aspect ratios differ
 * naturally; this ensures the visual footprint stays uniform across brands.
 */
export const footerPaymentIconClass =
  "max-h-full max-w-full shrink-0 object-contain [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:w-auto [&_svg_path]:fill-current";

export const footerLogoRowClass =
  "mt-8 flex justify-center border-t border-default-200/80 pt-6";

export const footerLogoLinkClass = "flex items-center gap-3";

export const footerLogoWordmarkClass =
  "text-xl font-semibold tracking-tight sm:text-2xl";

export const footerLogoAccentClass = "text-[var(--color-accent)]";

export const footerLogoRestClass = "text-[var(--color-foreground)]";

export const footerLegalMiniFooterLinkClass =
  "font-medium text-[var(--legal-burgundy)] underline-offset-2 hover:underline";
