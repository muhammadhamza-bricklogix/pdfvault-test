/**
 * Bumped whenever the negative-option disclaimer copy changes. Stored
 * on every `ConsentRecord` so the finance / legal team can prove
 * exactly which wording the user was shown at the moment of consent.
 *
 * Never remove old versions from history — this is the audit trail.
 */
export const DISCLAIMER_VERSION = "2026-07-12.v1";

/**
 * Verbatim copy required immediately adjacent to the pay button per
 * the compliance spec. Placeholders `{today}`, `{renew}`, `{cycle}`
 * are interpolated from the checkout intent so the numbers always
 * mirror the actual charge.
 */
export const DISCLAIMER_TEMPLATE =
  "By continuing, you agree you will be charged {today} today for a 7-day trial and {renew} automatically every {cycle} thereafter unless you cancel before your trial ends. You can cancel auto-renewing charges through your online account, by emailing payments@pdfvault.ai before your next monthly renewal date. Prices may change. See our Subscription Policy and Refund Policy for full details.";
