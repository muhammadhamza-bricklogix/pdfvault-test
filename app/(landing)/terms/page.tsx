import { redirect } from "next/navigation";

/**
 * Legacy alias — the Terms and conditions page lives at
 * `/terms-and-conditions`. Any bookmark or external link that still
 * points at `/terms` is forwarded permanently so nothing 404s.
 */
export default function TermsRedirectPage() {
  redirect("/terms-and-conditions");
}
