import { redirect } from "next/navigation";

// Legacy marketing landing page — this URL now forwards straight into the
// PDF composer with the Edit Text tool preselected. QA 2026-08-27:
// consolidating on a single upload screen (the composer's own drop-zone)
// eliminates the double-upload confusion the marketing hero introduced.
export default function EditLandingPage() {
  redirect("/pdf-composer?fresh=1&tool=edit");
}
