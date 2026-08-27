import { redirect } from "next/navigation";

export default function OrganizePdfLandingPage() {
  redirect("/pdf-composer?fresh=1&tool=manage");
}
