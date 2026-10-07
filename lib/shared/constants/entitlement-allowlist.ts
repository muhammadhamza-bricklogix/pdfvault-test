/**
 * Hardcoded entitlement bypass. Any signed-in user whose primary email
 * (or any verified email) matches one of these gets `entitled === true`
 * on the frontend without a real subscription — used for internal
 * accounts, comp accounts, and end-to-end paywall regression testing
 * on prod without burning a real card.
 *
 * NOTE: this only bypasses the FRONTEND paywall gate + axios request
 * interceptor. Backend endpoints (download / export / convert routes)
 * still check the caller's subscription state
 * server-side. If a real backend gate rejects the request, the frontend
 * bypass won't rescue it — the same email must also be allowlisted in
 * the backend's entitlement resolver.
 */
export const ENTITLEMENT_ALLOWLIST: ReadonlySet<string> = new Set([
  "huzaifa@pdfvault.ai",
  "vifaq.zafar@brickslogix.com",
  "julleerizz@pdfvault.ai",
  "jasper@pdfvault.ai",
  "eisha.fatima@brickslogix.com",
  "nazia.ali@brickslogix.com",
]);

export function isAllowlistedEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  return ENTITLEMENT_ALLOWLIST.has(email.trim().toLowerCase());
}
